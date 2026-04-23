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
        self._last_auto_refresh_ts: Optional[float] = None
        self._last_auto_refresh_ok: Optional[bool] = None
        self._last_auto_refresh_head: Optional[str] = None

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
            # Strategy: replay the sync's on-disk output as a fresh commit
            # on top of origin/main. Avoids `git pull --rebase`, which
            # conflicts unresolvably whenever the orchestrator touches
            # files under the same paths sync is about to write.
            #
            # 1. Fetch the remote tip.
            # 2. `git reset --mixed origin/main` — moves HEAD and the
            #    index to origin's tree but leaves the working tree
            #    (where the sync just wrote its files) untouched.
            # 3. Stage everything — now git sees only the delta between
            #    sync output and origin's tree, cleanly.
            # 4. Commit + push. Sync output wins on files it touched;
            #    origin's content is preserved everywhere else (most
            #    notably in wiki/, which only the orchestrator writes).
            self._cleanup_rebase_state()
            self._run(["git", "fetch", self._REMOTE, self._BRANCH])
            self._run(["git", "reset", "--mixed", f"{self._REMOTE}/{self._BRANCH}"])

            self._run(["git", "add", "-A"])
            changed_files = self._pending_changes()
            if not changed_files:
                logger.info("Vault clean and in sync with origin (label=%s)", label)
                return

            message = f"[sync] {label} — {len(changed_files)} file(s)"
            self._run(["git", "commit", "-m", message])
            logger.info("Vault commit created: %s", message)
            self._run(["git", "push", self._REMOTE, self._BRANCH])
            logger.info("Vault push succeeded (label=%s)", label)
        except VaultGitError as exc:
            logger.error("Vault push failed (label=%s): %s", label, exc.message)
        except Exception:
            logger.exception("Vault push raised unexpectedly (label=%s)", label)

    def pending_for_orchestration(self) -> dict:
        """Summarize what the next orchestrator run will process.

        Walks from HEAD back to the most recent ``[orchestrate]`` commit
        and reports the raw-file delta in between — i.e. everything
        Railway synced that the local orchestrator hasn't turned into
        wiki updates yet. If HEAD itself is the last ``[orchestrate]``
        commit (no new syncs since), counts are zero.

        Returns ``{}`` if this vault isn't a git repo (legacy seed-only
        mode); the API layer should render an empty state in that case.
        """
        if not self.is_git_repo:
            return {}

        # Find the most recent [orchestrate] commit by SUBJECT ONLY —
        # avoid matching body mentions of [orchestrate] (the same guard
        # the orchestrator prompt uses).
        log = self._run(
            ["git", "log", "--format=%H%x09%ct%x09%s", "-500"],
            capture=True,
        )
        last_orch_hash: Optional[str] = None
        last_orch_ts: Optional[int] = None
        last_orch_subject: Optional[str] = None
        last_sync_hash: Optional[str] = None
        last_sync_ts: Optional[int] = None
        last_sync_subject: Optional[str] = None
        for line in log.splitlines():
            parts = line.split("\t", 2)
            if len(parts) != 3:
                continue
            h, ts_s, subj = parts
            try:
                ts = int(ts_s)
            except ValueError:
                continue
            if last_orch_hash is None and subj.startswith("[orchestrate]"):
                last_orch_hash, last_orch_ts, last_orch_subject = h, ts, subj
            if last_sync_hash is None and subj.startswith("[sync]"):
                last_sync_hash, last_sync_ts = h, ts
                last_sync_subject = subj
            if last_orch_hash and last_sync_hash:
                break

        head = self._run(["git", "rev-parse", "HEAD"], capture=True).strip()

        # When we have no [orchestrate] anchor yet, treat the whole raw
        # tree as pending — common on first boot before the orchestrator
        # has committed anything.
        if last_orch_hash is None:
            name_status_out = self._run(
                ["git", "ls-files", "raw"],
                capture=True,
            )
            files = [
                {"path": p, "change": "A"}
                for p in name_status_out.splitlines()
                if p.strip()
            ]
            pending_sync_commits = _count_sync_commits(self._run, None)
            return {
                "hasOrchestrateAnchor": False,
                "lastOrchestrate": None,
                "lastSync": _commit_meta(last_sync_hash, last_sync_ts, last_sync_subject),
                "head": head,
                "pendingSyncCommits": pending_sync_commits,
                **_summarize_files(files),
            }

        # Diff between last [orchestrate] and HEAD, scoped to raw/ —
        # that's the input the orchestrator will process on its next run.
        name_status_out = self._run(
            ["git", "diff", "--name-status", f"{last_orch_hash}..HEAD", "--", "raw"],
            capture=True,
        )
        files: List[dict] = []
        for row in name_status_out.splitlines():
            if not row.strip():
                continue
            cols = row.split("\t")
            change = cols[0][0] if cols[0] else "?"
            path = cols[-1]
            files.append({"path": path, "change": change})

        return {
            "hasOrchestrateAnchor": True,
            "lastOrchestrate": _commit_meta(last_orch_hash, last_orch_ts, last_orch_subject),
            "lastSync": _commit_meta(last_sync_hash, last_sync_ts, last_sync_subject),
            "head": head,
            "pendingSyncCommits": _count_sync_commits(self._run, last_orch_hash),
            **_summarize_files(files),
        }

    def diagnose_state(self) -> dict:
        """Report the vault clone's current git state for debugging.

        Read-only — runs ``git status``, counts commits ahead/behind
        ``origin/main``, lists the most recent subjects, and reports
        whether any leftover rebase directories are blocking the push
        pipeline. Used by the diagnostic endpoint so we can see what the
        Railway clone looks like without running a full sync.
        """
        if not self.is_git_repo:
            return {"isGitRepo": False}

        git_dir = self._vault_root / ".git"
        state: dict = {
            "isGitRepo": True,
            "vaultRoot": str(self._vault_root),
            "rebaseMergePresent": (git_dir / "rebase-merge").exists(),
            "rebaseApplyPresent": (git_dir / "rebase-apply").exists(),
        }

        try:
            state["head"] = self._run(
                ["git", "rev-parse", "HEAD"], capture=True
            ).strip()
            status_out = self._run(
                ["git", "status", "--porcelain"], capture=True
            )
            status_lines = [ln for ln in status_out.splitlines() if ln.strip()]
            state["workingTreeDirty"] = bool(status_lines)
            state["workingTreeCount"] = len(status_lines)
            state["workingTreeSample"] = status_lines[:20]

            self._run(["git", "fetch", self._REMOTE, self._BRANCH])
            ahead = self._run(
                ["git", "rev-list", "--count", f"{self._REMOTE}/{self._BRANCH}..HEAD"],
                capture=True,
            ).strip()
            behind = self._run(
                ["git", "rev-list", "--count", f"HEAD..{self._REMOTE}/{self._BRANCH}"],
                capture=True,
            ).strip()
            state["ahead"] = int(ahead or "0")
            state["behind"] = int(behind or "0")

            log_out = self._run(
                ["git", "log", "--format=%h %s", "-10"], capture=True
            )
            state["recentCommits"] = [
                ln for ln in log_out.splitlines() if ln.strip()
            ]

            remote_tip = self._run(
                ["git", "rev-parse", f"{self._REMOTE}/{self._BRANCH}"],
                capture=True,
            ).strip()
            state["remoteTip"] = remote_tip
        except VaultGitError as exc:
            state["error"] = exc.message

        return state

    def reset_to_origin(self) -> dict:
        """Hard-reset the clone to ``origin/main`` and clean the tree.

        Diagnostic recovery path for when the clone is wedged in a
        rebase-in-progress state. Aborts any active rebase, fetches
        origin, hard-resets HEAD, and removes untracked files (except
        ``.git``). Destructive — discards uncommitted sync output and
        any local-only commits, so the caller must accept that data is
        gone. Safe here only because the canonical source of truth is
        either the remote repo or the Jira/Asana APIs, both of which a
        subsequent Full Refresh will re-fetch.
        """
        if not self.is_git_repo:
            return {"ok": False, "error": "vault is not a git repo"}

        import io as _io

        buffer = _io.StringIO()
        handler = logging.StreamHandler(buffer)
        handler.setLevel(logging.DEBUG)
        handler.setFormatter(
            logging.Formatter("%(levelname)s %(name)s: %(message)s")
        )
        root_logger = logging.getLogger()
        root_logger.addHandler(handler)
        previous_level = root_logger.level
        if previous_level > logging.INFO:
            root_logger.setLevel(logging.INFO)

        pre_state = self.diagnose_state()
        steps: List[dict] = []

        def _step(name: str, argv: List[str]) -> None:
            try:
                out = self._run(argv, capture=True)
                steps.append({"step": name, "ok": True, "output": out.strip()[:500]})
            except VaultGitError as exc:
                steps.append({"step": name, "ok": False, "error": exc.message})

        try:
            # Abort any stuck rebase before we touch anything else.
            git_dir = self._vault_root / ".git"
            if (git_dir / "rebase-merge").exists() or (git_dir / "rebase-apply").exists():
                _step("rebase-abort", ["git", "rebase", "--abort"])

            _step("fetch", ["git", "fetch", self._REMOTE, self._BRANCH])
            _step("reset-hard", ["git", "reset", "--hard", f"{self._REMOTE}/{self._BRANCH}"])
            _step("clean", ["git", "clean", "-fdx", "-e", ".health"])
        finally:
            root_logger.removeHandler(handler)
            root_logger.setLevel(previous_level)

        post_state = self.diagnose_state()
        return {
            "ok": all(s["ok"] for s in steps),
            "preState": pre_state,
            "postState": post_state,
            "steps": steps,
            "log": buffer.getvalue().splitlines(),
        }

    def ping(self) -> dict:
        """End-to-end smoke test of the commit-and-push pipeline.

        Writes a throwaway timestamped file under ``.health/`` and runs
        :meth:`commit_and_push`. Captures the logger output emitted by
        that method so the caller can see whether the commit was made,
        whether the push succeeded, and what git said along the way.

        Returns a dict with the pre/post git state and the captured log
        lines. Meant for manual diagnostics — not a scheduled job.
        """
        if not self.is_git_repo:
            return {"ok": False, "error": "vault is not a git repo"}

        import time as _time
        import io as _io

        health_dir = self._vault_root / ".health"
        health_dir.mkdir(exist_ok=True)
        ts = int(_time.time())
        ping_file = health_dir / f"ping-{ts}.txt"
        ping_file.write_text(
            f"vault-git-service ping at {ts}\n",
            encoding="utf-8",
        )

        buffer = _io.StringIO()
        handler = logging.StreamHandler(buffer)
        handler.setLevel(logging.DEBUG)
        handler.setFormatter(
            logging.Formatter("%(levelname)s %(name)s: %(message)s")
        )
        root_logger = logging.getLogger()
        root_logger.addHandler(handler)
        previous_level = root_logger.level
        if previous_level > logging.INFO:
            root_logger.setLevel(logging.INFO)

        pre_state = self.diagnose_state()
        try:
            self.commit_and_push(f"ping test {ts}")
        finally:
            root_logger.removeHandler(handler)
            root_logger.setLevel(previous_level)

        post_state = self.diagnose_state()
        captured = buffer.getvalue().splitlines()
        return {
            "ok": True,
            "pingFile": str(ping_file.relative_to(self._vault_root)),
            "preState": pre_state,
            "postState": post_state,
            "log": captured,
        }

    def auto_refresh(self) -> dict:
        """Periodic pull + record a timestamp.

        Wraps :meth:`pull_latest` so a scheduled job can keep the Railway
        vault clone in lockstep with what the orchestrator pushes to
        ``origin/main`` between user-triggered syncs. The timestamp is
        exposed via :meth:`auto_refresh_status` so the UI can show when
        the dashboard data was last pulled without the user doing
        anything. Never raises.
        """
        import time as _time

        if not self.is_git_repo:
            self._last_auto_refresh_ts = _time.time()
            self._last_auto_refresh_ok = False
            return {"ok": False, "error": "vault is not a git repo"}

        ok = True
        head: Optional[str] = None
        try:
            self.pull_latest()
            try:
                head = self._run(["git", "rev-parse", "HEAD"], capture=True).strip()
            except VaultGitError:
                head = None
        except Exception:  # noqa: BLE001 — scheduled job must not propagate
            logger.exception("Vault auto-refresh failed")
            ok = False

        self._last_auto_refresh_ts = _time.time()
        self._last_auto_refresh_ok = ok
        self._last_auto_refresh_head = head
        return {"ok": ok, "head": head, "timestamp": self._last_auto_refresh_ts}

    def auto_refresh_status(self) -> dict:
        """Return the last-pull timestamp for UI display."""
        return {
            "lastRefreshedAt": self._last_auto_refresh_ts,
            "lastRefreshedOk": self._last_auto_refresh_ok,
            "lastRefreshedHead": self._last_auto_refresh_head,
        }

    def pull_latest(self) -> None:
        """Hard-reset the clone to the remote tip at boot.

        The vault clone holds no durable human work — sync output is
        regenerated each cycle from Jira/Asana, and anything committed
        locally has either already pushed or is being re-synced. So at
        boot we discard whatever weird mid-rebase/dirty-tree state the
        previous process may have left and force parity with origin.
        Mirrors the pattern the orchestrator's ``run-orchestrator.sh``
        uses for the same reason.

        ``.health/`` is preserved so diagnostic ping files survive a
        restart — they're useful breadcrumbs when debugging.

        Uses ``clean -fd`` (not ``-fdx``) so ignored files survive. The
        Jira/Asana sync pipelines store their ``last_sync`` timestamps
        in gitignored ``.jira_sync_state.json`` / ``.asana_sync_state.json``
        markers; wiping those on every pull forces the next sync to run
        as a full refresh instead of a delta.
        """
        if not self.is_git_repo:
            return
        try:
            self._cleanup_rebase_state()
            self._run(["git", "fetch", self._REMOTE, self._BRANCH])
            self._run(["git", "reset", "--hard", f"{self._REMOTE}/{self._BRANCH}"])
            self._run(["git", "clean", "-fd", "-e", ".health"])
            logger.info("Vault reset to %s/%s at boot", self._REMOTE, self._BRANCH)
        except Exception:
            logger.exception("Vault pull_latest failed — continuing with local state")

    # ── Internals ────────────────────────────────────────────────────

    def _cleanup_rebase_state(self) -> None:
        """Abort any leftover rebase-in-progress on the vault clone.

        A prior ``git pull --rebase`` that aborted mid-conflict (or got
        SIGKILLed) leaves ``.git/rebase-merge/`` or ``.git/rebase-apply/``
        sitting around. Every subsequent rebase then fails with ``fatal:
        It seems that there is already a rebase-merge directory`` — which
        silently strands sync commits on the Railway clone.
        """
        git_dir = self._vault_root / ".git"
        if not ((git_dir / "rebase-merge").exists() or (git_dir / "rebase-apply").exists()):
            return
        logger.warning("Vault has leftover rebase state; aborting before pull")
        try:
            self._run(["git", "rebase", "--abort"])
        except VaultGitError as exc:
            logger.error("git rebase --abort failed: %s — continuing", exc.message)

    def _pull_rebase(self) -> None:
        self._cleanup_rebase_state()
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


# ── Module helpers for pending_for_orchestration ────────────────────────


def _commit_meta(
    sha: Optional[str],
    ts: Optional[int],
    subject: Optional[str],
) -> Optional[dict]:
    if not sha:
        return None
    return {"hash": sha, "shortHash": sha[:8], "timestamp": ts, "subject": subject}


def _count_sync_commits(runner, since_hash: Optional[str]) -> int:
    """Count ``[sync]`` commits between ``since_hash`` and HEAD (or all)."""
    range_spec = f"{since_hash}..HEAD" if since_hash else "HEAD"
    subjects = runner(
        ["git", "log", "--format=%s", range_spec],
        capture=True,
    )
    return sum(1 for line in subjects.splitlines() if line.startswith("[sync]"))


def _summarize_files(files: List[dict]) -> dict:
    """Derive totals + per-source breakdown from raw/ file paths.

    Paths look like ``raw/jira/ACE2E/…`` or ``raw/asana/LAMPSPLUS/…``;
    group by the slug immediately after ``raw/``.
    """
    adds = sum(1 for f in files if f["change"] == "A")
    mods = sum(1 for f in files if f["change"] == "M")
    dels = sum(1 for f in files if f["change"] == "D")
    by_source: dict = {}
    for f in files:
        parts = f["path"].split("/", 3)
        if len(parts) < 3 or parts[0] != "raw":
            key = "other"
        else:
            key = f"{parts[1]}/{parts[2]}"  # e.g. "jira/ACE2E", "asana/LAMPSPLUS"
        bucket = by_source.setdefault(key, {"added": 0, "modified": 0, "deleted": 0})
        if f["change"] == "A":
            bucket["added"] += 1
        elif f["change"] == "M":
            bucket["modified"] += 1
        elif f["change"] == "D":
            bucket["deleted"] += 1
    # Stable, descending by total-touched count for UI ordering.
    sources = [
        {"key": k, **v, "total": v["added"] + v["modified"] + v["deleted"]}
        for k, v in by_source.items()
    ]
    sources.sort(key=lambda s: (-s["total"], s["key"]))
    return {
        "files": files,
        "added": adds,
        "modified": mods,
        "deleted": dels,
        "total": len(files),
        "bySource": sources,
    }
