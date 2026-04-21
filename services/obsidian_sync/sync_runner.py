"""Library-callable wrappers around the Jira and Asana sync scripts.

The underlying scripts (`jira_sync.py`, `asana_sync.py`) are still usable as
standalone CLI tools. This module exposes `run_jira_sync()` and
`run_asana_sync()` so the Flask layer can invoke a sync in-process, override
credentials and vault path at call time, and stream progress back to the
caller via a callback.
"""

from __future__ import annotations

import contextlib
import io
import sys
import threading
from dataclasses import dataclass
from typing import Callable, Dict, Iterable, List, Optional

from . import asana_sync, jira_sync


ProgressCallback = Callable[[str], None]


@dataclass
class SyncResult:
    """Outcome of a single sync run."""

    success: bool
    lines: List[str]
    error: Optional[str] = None

    @property
    def output(self) -> str:
        return "\n".join(self.lines)


class _CallbackStream(io.TextIOBase):
    """File-like object that forwards line-buffered writes to a callback."""

    def __init__(self, callback: ProgressCallback) -> None:
        super().__init__()
        self._callback = callback
        self._buffer = ""
        self._lock = threading.Lock()

    def writable(self) -> bool:  # pragma: no cover — trivial
        return True

    def write(self, s: str) -> int:
        if not s:
            return 0
        with self._lock:
            self._buffer += s
            while "\n" in self._buffer:
                line, self._buffer = self._buffer.split("\n", 1)
                self._callback(line)
        return len(s)

    def flush(self) -> None:
        with self._lock:
            if self._buffer:
                self._callback(self._buffer)
                self._buffer = ""


@contextlib.contextmanager
def _capture_stdout(callback: ProgressCallback):
    """Temporarily redirect stdout to the given progress callback."""
    stream = _CallbackStream(callback)
    old_stdout = sys.stdout
    sys.stdout = stream
    try:
        yield
    finally:
        try:
            stream.flush()
        finally:
            sys.stdout = old_stdout


def _tee_callback(progress_callback: Optional[ProgressCallback]) -> tuple[List[str], ProgressCallback]:
    """Return a buffer list and a callback that appends to it + forwards."""
    buffer: List[str] = []
    forward = progress_callback or (lambda _line: None)

    def tee(line: str) -> None:
        buffer.append(line)
        forward(line)

    return buffer, tee


def run_jira_sync(
    vault_root: str,
    pat: str,
    base_url: str,
    projects: Iterable[str],
    full_refresh: bool = False,
    progress_callback: Optional[ProgressCallback] = None,
) -> SyncResult:
    """Run the Jira → Obsidian sync for the given projects.

    Never raises. Always returns a SyncResult.
    """
    if not pat:
        return SyncResult(success=False, lines=[], error="Missing Jira PAT")
    if not vault_root:
        return SyncResult(success=False, lines=[], error="Missing vault root")

    jira_sync.VAULT_ROOT = vault_root
    jira_sync.JIRA_PAT = pat
    jira_sync.JIRA_BASE_URL = base_url

    buffer, tee = _tee_callback(progress_callback)

    try:
        with _capture_stdout(tee):
            print(f"🔌 Connecting to {base_url}...")
            session = jira_sync.jira_session()
            me = session.get(f"{base_url}/rest/api/2/myself")
            me.raise_for_status()
            user = me.json()
            print(f"   Authenticated as: {user.get('displayName', user.get('name', '?'))}")
            print(f"   Vault root: {vault_root}")

            project_list = list(projects)
            print(f"   Projects:   {', '.join(project_list)}")
            if full_refresh:
                print("   Mode:       --full (forced complete refresh)")
            print()

            for project_key in project_list:
                jira_sync.sync_project(session, project_key, force_full=full_refresh)

            print("🏁 All projects synced!")
        return SyncResult(success=True, lines=buffer)
    except SystemExit as exc:
        return SyncResult(success=False, lines=buffer, error=f"Sync aborted (exit {exc.code})")
    except Exception as exc:  # noqa: BLE001 — library boundary
        return SyncResult(success=False, lines=buffer, error=str(exc))


def run_jira_jql_sync(
    vault_root: str,
    pat: str,
    base_url: str,
    jql: str,
    output_name: str,
    full_refresh: bool = False,
    progress_callback: Optional[ProgressCallback] = None,
) -> SyncResult:
    """Run a custom JQL Jira sync into ``<vault_root>/<output_name>/``.

    Mirrors :func:`run_jira_sync` but invokes :func:`jira_sync.sync_jql`
    instead of iterating projects. Used for curated feeds (e.g. the WPM
    hierarchy) that don't map to a single Jira project key.

    Incremental by default: after the first run, the state file in the
    output folder bounds subsequent pulls to issues updated since then.
    Pass ``full_refresh=True`` to re-export everything.
    """
    if not pat:
        return SyncResult(success=False, lines=[], error="Missing Jira PAT")
    if not vault_root:
        return SyncResult(success=False, lines=[], error="Missing vault root")
    if not jql:
        return SyncResult(success=False, lines=[], error="Missing JQL")
    if not output_name:
        return SyncResult(success=False, lines=[], error="Missing output name")

    jira_sync.VAULT_ROOT = vault_root
    jira_sync.JIRA_PAT = pat
    jira_sync.JIRA_BASE_URL = base_url

    buffer, tee = _tee_callback(progress_callback)

    try:
        with _capture_stdout(tee):
            print(f"🔌 Connecting to {base_url}...")
            session = jira_sync.jira_session()
            me = session.get(f"{base_url}/rest/api/2/myself")
            me.raise_for_status()
            user = me.json()
            print(f"   Authenticated as: {user.get('displayName', user.get('name', '?'))}")
            print(f"   Vault root: {vault_root}")
            print(f"   Feed:       {output_name} (custom JQL)")
            if full_refresh:
                print("   Mode:       --full (forced complete refresh)")
            print()

            jira_sync.sync_jql(session, jql, output_name, force_full=full_refresh)

            print(f"🏁 JQL feed '{output_name}' synced!")
        return SyncResult(success=True, lines=buffer)
    except SystemExit as exc:
        return SyncResult(success=False, lines=buffer, error=f"Sync aborted (exit {exc.code})")
    except Exception as exc:  # noqa: BLE001 — library boundary
        return SyncResult(success=False, lines=buffer, error=str(exc))


def run_asana_sync(
    vault_root: str,
    pat: str,
    project_map: Dict[str, str],
    projects: Iterable[str],
    full_refresh: bool = False,
    progress_callback: Optional[ProgressCallback] = None,
) -> SyncResult:
    """Run the Asana → Obsidian sync for the given named projects.

    `project_map` maps human-readable project name (e.g. "LAMPSPLUS") to the
    Asana project GID. Never raises — always returns a SyncResult.
    """
    if not pat:
        return SyncResult(success=False, lines=[], error="Missing Asana PAT")
    if not vault_root:
        return SyncResult(success=False, lines=[], error="Missing vault root")
    if not project_map:
        return SyncResult(success=False, lines=[], error="Empty project map")

    asana_sync.VAULT_ROOT = vault_root
    asana_sync.ASANA_PAT = pat
    asana_sync.PROJECT_MAP = dict(project_map)

    buffer, tee = _tee_callback(progress_callback)

    try:
        with _capture_stdout(tee):
            print("Testing Asana API connection...")
            session = asana_sync.asana_session()
            me = asana_sync.asana_get_single(session, "users/me", {"opt_fields": "name,email"})
            print(f"Authenticated as: {me.get('name', '?')} ({me.get('email', '?')})")

            name_cache = asana_sync.load_user_cache(vault_root)
            cache_start_size = len(name_cache)

            project_list = list(projects)
            synced = 0
            for name in project_list:
                gid = project_map.get(name)
                if not gid:
                    print(f"Skipping unknown project: {name}")
                    continue
                asana_sync.sync_project(
                    session, name, gid, full_refresh, name_cache=name_cache
                )
                synced += 1

            asana_sync.save_user_cache(vault_root, name_cache)
            resolved = sum(1 for v in name_cache.values() if v)
            unresolved = sum(1 for v in name_cache.values() if not v)
            print(
                f"User cache: {resolved} resolved, {unresolved} unresolved "
                f"(total entries: {len(name_cache)}, was {cache_start_size} before run)."
            )

            print(f"All done! Synced {synced} project(s).")
            print(f"Output: {vault_root}")
        return SyncResult(success=True, lines=buffer)
    except SystemExit as exc:
        return SyncResult(success=False, lines=buffer, error=f"Sync aborted (exit {exc.code})")
    except Exception as exc:  # noqa: BLE001 — library boundary
        return SyncResult(success=False, lines=buffer, error=str(exc))
