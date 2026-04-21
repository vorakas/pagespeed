"""In-memory registry and runner for Obsidian vault sync jobs.

Single Responsibility: spawn Jira/Asana vault sync jobs and track their
status and streamed log output. Delegates the actual sync work to
:func:`~services.obsidian_sync.sync_runner.run_jira_sync` and
:func:`~services.obsidian_sync.sync_runner.run_asana_sync`.

State is held in-process and resets on restart — acceptable for the
single-process Railway deployment. Only one sync runs at a time;
concurrent requests raise :class:`SyncAlreadyRunning`.
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence

from services.obsidian_sync.sync_runner import (
    SyncResult,
    run_asana_sync,
    run_jira_jql_sync,
    run_jira_sync,
)


logger = logging.getLogger(__name__)


# Keep this list in sync with jira_sync.DEFAULT_PROJECTS — duplicated here
# so the service has a self-contained default without reaching into the
# underlying script's module-level constants.
DEFAULT_JIRA_PROJECTS: tuple[str, ...] = (
    "ACE2E",
    "ACEDS",
    "ACAB",
    "ACAQA",
    "ACCMS",
    "ACM",
)


class SyncAlreadyRunning(Exception):
    """Raised when a sync is requested while another is in progress."""


@dataclass
class SyncJob:
    """Snapshot of a single sync run, returned to the API layer."""

    job_id: str
    source: str  # 'jira' | 'asana' | 'both'
    projects_jira: List[str]
    projects_asana: List[str]
    jql_feeds: List[str]
    full_refresh: bool
    status: str = "queued"  # queued | running | succeeded | failed | partial
    started_at: Optional[float] = None
    ended_at: Optional[float] = None
    lines: List[str] = field(default_factory=list)
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "jobId": self.job_id,
            "source": self.source,
            "projectsJira": list(self.projects_jira),
            "projectsAsana": list(self.projects_asana),
            "jqlFeeds": list(self.jql_feeds),
            "fullRefresh": self.full_refresh,
            "status": self.status,
            "startedAt": self.started_at,
            "endedAt": self.ended_at,
            "lineCount": len(self.lines),
            "lines": list(self.lines),
            "error": self.error,
        }


class ObsidianSyncService:
    """Runs Jira/Asana vault syncs in a background thread, one at a time.

    Construction-time config is treated as immutable — rotate credentials by
    restarting the process (Railway redeploy). Jobs are stored in a bounded
    LRU-ish history so memory doesn't grow indefinitely.
    """

    _MAX_HISTORY = 50

    def __init__(
        self,
        vault_root: str,
        jira_pat: str,
        jira_base_url: str,
        asana_pat: str,
        asana_project_map: Dict[str, str],
        default_jira_projects: Optional[List[str]] = None,
        jira_jql_queries: Optional[Dict[str, str]] = None,
        on_sync_complete: Optional[Sequence[Callable[[SyncJob], None]]] = None,
    ) -> None:
        self._vault_root: Path = Path(vault_root)
        self._jira_pat: str = jira_pat
        self._jira_base_url: str = jira_base_url
        self._asana_pat: str = asana_pat
        self._asana_project_map: Dict[str, str] = dict(asana_project_map)
        self._default_jira_projects: List[str] = list(
            default_jira_projects or DEFAULT_JIRA_PROJECTS
        )
        self._jira_jql_queries: Dict[str, str] = dict(jira_jql_queries or {})
        self._on_sync_complete: List[Callable[[SyncJob], None]] = list(on_sync_complete or [])
        self._jobs: Dict[str, SyncJob] = {}
        self._job_order: List[str] = []
        self._active_job_id: Optional[str] = None
        self._lock: threading.RLock = threading.RLock()

    # ── Capability checks ─────────────────────────────────────────────

    @property
    def vault_root(self) -> Path:
        return self._vault_root

    def capabilities(self) -> dict:
        """Report which sync sources are configured."""
        return {
            "vaultRoot": str(self._vault_root),
            "vaultExists": self._vault_root.exists(),
            "jiraConfigured": bool(self._jira_pat and self._jira_base_url),
            "asanaConfigured": bool(self._asana_pat and self._asana_project_map),
            "jiraProjects": list(self._default_jira_projects),
            "jiraJqlFeeds": list(self._jira_jql_queries.keys()),
            "asanaProjects": list(self._asana_project_map.keys()),
        }

    # ── Job lifecycle ────────────────────────────────────────────────

    def start_sync(
        self,
        source: str = "both",
        projects_jira: Optional[List[str]] = None,
        projects_asana: Optional[List[str]] = None,
        jql_feeds: Optional[List[str]] = None,
        full_refresh: bool = False,
    ) -> SyncJob:
        """Kick off a sync job in a background thread. Returns the job.

        ``jql_feeds`` restricts which configured JQL feeds run (by name). If
        omitted, all configured feeds run on any Jira-inclusive sync. Unknown
        names are ignored."""
        source_lc = source.lower()
        if source_lc not in {"jira", "asana", "both"}:
            raise ValueError(f"Unknown sync source: {source!r}")

        with self._lock:
            active = self._active_running_locked()
            if active is not None:
                raise SyncAlreadyRunning(active.job_id)

            if jql_feeds is None:
                resolved_jql = list(self._jira_jql_queries.keys())
            else:
                resolved_jql = [name for name in jql_feeds if name in self._jira_jql_queries]

            job = SyncJob(
                job_id=uuid.uuid4().hex[:12],
                source=source_lc,
                projects_jira=list(projects_jira) if projects_jira else list(self._default_jira_projects),
                projects_asana=list(projects_asana) if projects_asana else list(self._asana_project_map.keys()),
                jql_feeds=resolved_jql,
                full_refresh=full_refresh,
            )
            self._register_job_locked(job)
            self._active_job_id = job.job_id

        thread = threading.Thread(
            target=self._run_job,
            args=(job.job_id,),
            name=f"obsidian-sync-{job.job_id}",
            daemon=True,
        )
        thread.start()
        return job

    def get_job(self, job_id: str) -> Optional[SyncJob]:
        with self._lock:
            return self._jobs.get(job_id)

    def active_job(self) -> Optional[SyncJob]:
        with self._lock:
            return self._active_running_locked()

    def list_jobs(self, limit: int = 20) -> List[SyncJob]:
        with self._lock:
            ids = list(reversed(self._job_order))[:limit]
            return [self._jobs[jid] for jid in ids]

    # ── Internals ────────────────────────────────────────────────────

    def _active_running_locked(self) -> Optional[SyncJob]:
        if not self._active_job_id:
            return None
        job = self._jobs.get(self._active_job_id)
        if job and job.status == "running":
            return job
        return None

    def _register_job_locked(self, job: SyncJob) -> None:
        self._jobs[job.job_id] = job
        self._job_order.append(job.job_id)
        while len(self._job_order) > self._MAX_HISTORY:
            oldest = self._job_order.pop(0)
            self._jobs.pop(oldest, None)

    def _run_job(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs[job_id]
            job.status = "running"
            job.started_at = time.time()

        def on_line(line: str) -> None:
            with self._lock:
                job.lines.append(line)

        jira_result: Optional[SyncResult] = None
        asana_result: Optional[SyncResult] = None
        jql_results: List[SyncResult] = []

        try:
            if job.source in {"jira", "both"}:
                if not self._jira_pat:
                    on_line("[jira] skipped — JIRA_PAT not configured")
                else:
                    jira_result = run_jira_sync(
                        vault_root=str(self._vault_root / "raw"),
                        pat=self._jira_pat,
                        base_url=self._jira_base_url,
                        projects=job.projects_jira,
                        full_refresh=job.full_refresh,
                        progress_callback=on_line,
                    )
                    for feed_name in job.jql_feeds:
                        jql = self._jira_jql_queries.get(feed_name)
                        if not jql:
                            on_line(f"[jira-jql] skipped '{feed_name}' — not configured")
                            continue
                        on_line(f"[jira-jql] running feed '{feed_name}'")
                        jql_results.append(run_jira_jql_sync(
                            vault_root=str(self._vault_root / "raw"),
                            pat=self._jira_pat,
                            base_url=self._jira_base_url,
                            jql=jql,
                            output_name=feed_name,
                            full_refresh=job.full_refresh,
                            progress_callback=on_line,
                        ))

            if job.source in {"asana", "both"}:
                if not self._asana_pat:
                    on_line("[asana] skipped — ASANA_PAT not configured")
                elif not self._asana_project_map:
                    on_line("[asana] skipped — no project map configured")
                else:
                    asana_result = run_asana_sync(
                        vault_root=str(self._vault_root / "raw" / "asana"),
                        pat=self._asana_pat,
                        project_map=self._asana_project_map,
                        projects=job.projects_asana,
                        full_refresh=job.full_refresh,
                        progress_callback=on_line,
                    )

            self._finalize(job, jira_result, asana_result, jql_results)
        except Exception as exc:  # noqa: BLE001 — top-level safety net
            logger.exception("Obsidian sync job %s failed unexpectedly", job_id)
            with self._lock:
                job.status = "failed"
                job.error = f"Unexpected error: {exc}"
        finally:
            with self._lock:
                job.ended_at = time.time()
                if self._active_job_id == job_id:
                    self._active_job_id = None
            for hook in self._on_sync_complete:
                try:
                    hook(job)
                except Exception:  # noqa: BLE001 — hooks must not break sync
                    logger.exception("on_sync_complete hook failed for job %s", job_id)

    def _finalize(
        self,
        job: SyncJob,
        jira_result: Optional[SyncResult],
        asana_result: Optional[SyncResult],
        jql_results: Optional[List[SyncResult]] = None,
    ) -> None:
        results = [r for r in (jira_result, asana_result) if r is not None]
        if jql_results:
            results.extend(jql_results)
        with self._lock:
            if not results:
                job.status = "failed"
                job.error = "No sync sources ran (check configuration)"
                return

            failures = [r for r in results if not r.success]
            successes = [r for r in results if r.success]
            if not failures:
                job.status = "succeeded"
            elif not successes:
                job.status = "failed"
                job.error = "; ".join(r.error or "unknown error" for r in failures)
            else:
                job.status = "partial"
                job.error = "; ".join(r.error or "unknown error" for r in failures)
