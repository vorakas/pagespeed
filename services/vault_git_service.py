"""Git-backed persistence for the Obsidian vault.

Single Responsibility: mirror the on-disk vault at ``OBSIDIAN_VAULT_ROOT``
to a remote GitHub repository (``lpadobe-vault``) so that:

1. Railway's sync output lands in version control automatically — every
   completed Jira/Asana sync commits and pushes.
2. A separate orchestration agent (scheduled Claude Code run) can pull,
   rewrite wiki/status pages, and push results back.
3. Local Obsidian on a workstation pulls from the same repo and sees
   both the raw sync output and the orchestrator's edits.

Wired as a post-sync hook on :class:`ObsidianSyncService`. Boot-time
:meth:`ensure_cloned` populates an empty Railway volume from the remote
repo on first deploy, replacing the earlier ``_seed_vault_wiki`` scheme.
"""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path
from typing import List, Optional

from exceptions import VaultGitError


logger = logging.getLogger(__name__)


class VaultGitService:
    """Keeps the on-disk vault synchronized with a remote GitHub repo.

    Encapsulates all git CLI invocations against the vault directory.
    Credentials are injected at construction time and stored inside the
    remote URL written to ``.git/config`` after clone — callers never see
    or handle the raw token.
    """

    _REMOTE = "origin"
    _BRANCH = "main"

    # Filesystem entries to ignore when deciding whether the vault
    # directory is "empty enough" to bootstrap. ``lost+found`` is created
    # automatically by ext4 on a persistent volume; ``.git`` is handled
    # separately by the is_git_repo check.
    _IGNORED_ENTRIES = frozenset({"lost+found", ".git"})

    def __init__(
        self,
        vault_root: str,
        repo_url: str,
        token: str,
        committer_name: str,
        committer_email: str,
    ) -> None:
        if not vault_root:
            raise VaultGitError("vault_root is required")
        if not repo_url:
            raise VaultGitError("repo_url is required")
        if not token:
            raise VaultGitError("token is required")

        self._vault_root: Path = Path(vault_root)
        self._repo_url: str = repo_url
        self._token: str = token
        self._committer_name: str = committer_name
        self._committer_email: str = committer_email

    @property
    def vault_root(self) -> Path:
        return self._vault_root

    @property
    def is_git_repo(self) -> bool:
        return (self._vault_root / ".git").is_dir()

    # ── Public operations ────────────────────────────────────────────

    def ensure_cloned(self) -> None:
        """Bootstrap the vault directory as a clone of the remote repo.

        Idempotent and non-destructive:
        - If ``vault_root`` is already a git repo, no-op.
        - If ``vault_root`` has meaningful content but no ``.git``, skip
          with a warning (protects existing data; cutover requires
          clearing the directory first).
        - Otherwise initialize the directory as a git repo in place and
          reset its tree to the remote's ``main`` branch. In-place init
          instead of ``git clone`` because ``vault_root`` is typically a
          persistent-volume mount point that can't be removed or cloned
          over directly.
        """
        if self.is_git_repo:
            logger.info("Vault at %s already a git repo; skip bootstrap", self._vault_root)
            return

        if self._has_user_content():
            logger.warning(
                "Vault at %s has user content but no .git — skipping bootstrap "
                "to protect existing data. Clear raw/, wiki/, and sentinels to "
                "enable the git-backed vault.",
                self._vault_root,
            )
            return

        self._vault_root.mkdir(parents=True, exist_ok=True)
        logger.info(
            "Bootstrapping vault at %s from %s",
            self._vault_root,
            self._scrub(self._repo_url),
        )
        self._run(["git", "init", "-b", self._BRANCH])
        self._run(["git", "remote", "add", self._REMOTE, self._authenticated_url()])
        self._run(["git", "fetch", self._REMOTE, self._BRANCH])
        self._run(["git", "reset", "--hard", f"{self._REMOTE}/{self._BRANCH}"])
        self._run(["git", "branch", "--set-upstream-to", f"{self._REMOTE}/{self._BRANCH}", self._BRANCH])
        self._configure_committer()
        logger.info("Vault bootstrapped into %s", self._vault_root)

    def _has_user_content(self) -> bool:
        """True if ``vault_root`` has entries other than filesystem artifacts."""
        if not self._vault_root.exists():
            return False
        for entry in self._vault_root.iterdir():
            if entry.name in self._IGNORED_ENTRIES:
                continue
            return True
        return False

    def commit_and_push(self, label: str) -> None:
        """Stage, commit, and push any pending changes in the vault.

        Silently no-ops when the vault isn't a git repo (bot not yet
        configured) or when the working tree is clean. Never raises to
        the caller — failures are logged so the hook chain keeps working.

        Args:
            label: Short description embedded in the commit message after
                the ``[sync]`` prefix (typically the sync job source and id).
        """
        if not self.is_git_repo:
            logger.info("Vault not a git repo; skipping commit/push")
            return

        try:
            # Stage first. git refuses to pull --rebase with unstaged
            # changes, so we must snapshot the sync output into a local
            # commit before trying to incorporate remote history.
            self._run(["git", "add", "-A"])
            changed_files = self._pending_changes()
            if not changed_files:
                logger.info("Vault clean; nothing to push (label=%s)", label)
                return
            message = f"[sync] {label} — {len(changed_files)} file(s)"
            self._run(["git", "commit", "-m", message])
            # Now rebase our commit onto any remote changes (e.g. from
            # the orchestration agent), then push the combined history.
            self._pull_rebase()
            self._run(["git", "push", self._REMOTE, self._BRANCH])
            logger.info("Vault push succeeded: %s", message)
        except VaultGitError as exc:
            logger.error("Vault push failed (label=%s): %s", label, exc.message)
        except Exception:
            logger.exception("Vault push raised unexpectedly (label=%s)", label)

    # ── Internals ────────────────────────────────────────────────────

    def _pull_rebase(self) -> None:
        self._run(["git", "pull", "--rebase", self._REMOTE, self._BRANCH])

    def _pending_changes(self) -> List[str]:
        output = self._run(["git", "status", "--porcelain"], capture=True)
        return [line for line in output.splitlines() if line.strip()]

    def _configure_committer(self) -> None:
        """Set the committer identity for future commits in this repo."""
        self._run(["git", "config", "user.name", self._committer_name])
        self._run(["git", "config", "user.email", self._committer_email])

    def _authenticated_url(self) -> str:
        """Inject the bot token into the repo URL for HTTPS auth."""
        if "://" not in self._repo_url:
            return self._repo_url
        scheme, rest = self._repo_url.split("://", 1)
        if "@" in rest:
            return self._repo_url
        return f"{scheme}://x-access-token:{self._token}@{rest}"

    @staticmethod
    def _scrub(url: str) -> str:
        """Strip any embedded credentials from a URL for logging."""
        if "://" not in url or "@" not in url:
            return url
        scheme, rest = url.split("://", 1)
        _, host = rest.rsplit("@", 1)
        return f"{scheme}://{host}"

    def _run(
        self,
        argv: List[str],
        *,
        cwd: Optional[str] = None,
        capture: bool = False,
    ) -> str:
        """Execute a git command, defaulting cwd to ``vault_root``.

        Raises VaultGitError on non-zero exit or missing git binary so
        the caller can decide whether to log, retry, or propagate.
        """
        working_dir = cwd if cwd is not None else str(self._vault_root)
        try:
            result = subprocess.run(
                argv,
                cwd=working_dir,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or "").strip()
            stdout = (exc.stdout or "").strip()
            detail = stderr or stdout or f"exit {exc.returncode}"
            subcommand = argv[1] if len(argv) > 1 else argv[0]
            raise VaultGitError(f"git {subcommand} failed: {detail}") from exc
        except FileNotFoundError as exc:
            raise VaultGitError("git executable not found on PATH") from exc
        return result.stdout if capture else ""
