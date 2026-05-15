"""Application factory for the PageSpeed Insights Monitor.

Creates the Flask app, wires dependency injection, registers blueprints,
and sets up the APScheduler with user-configured triggers and centralized
error handlers.
"""

import logging
import os
import sys
import tempfile
import atexit
from datetime import datetime, timedelta, timezone

from flask import Flask, Response, jsonify, send_from_directory
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

# Load .env BEFORE importing config — config reads env vars at module
# load time, so dotenv must populate os.environ first or every .env
# value silently falls back to its default.
load_dotenv()

# Configure logging so APScheduler errors are visible in Railway logs
# (APScheduler catches job exceptions and logs them — without this config
# those messages are silently dropped by Python's default NullHandler).
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
)
logging.getLogger('apscheduler').setLevel(logging.DEBUG)

from config import (
    APPLITOOLS_HELPER_TOKEN,
    ASANA_PAT,
    ASANA_PROJECT_MAP,
    BLAZEMETER_API_KEY_ID,
    BLAZEMETER_API_SECRET,
    BLAZEMETER_WORKSPACE_ID,
    DEVOPS_ORCHESTRATOR_PIPELINE_ID,
    DEVOPS_ORGANIZATION,
    DEVOPS_PAT,
    DEVOPS_PIPELINE_MAP,
    DEVOPS_PROJECT,
    GITHUB_WEBHOOK_SECRET,
    JIRA_BASE_URL,
    JIRA_DEFAULT_PROJECTS,
    JIRA_JQL_QUERIES,
    JIRA_PAT,
    OBSIDIAN_VAULT_ROOT,
    PAGESPEED_API_KEY,
    PORT,
    VAULT_ACTIVE_HOURS_END,
    VAULT_ACTIVE_HOURS_START,
    VAULT_ACTIVE_HOURS_TZ,
    VAULT_BOT_TOKEN,
    VAULT_COMMITTER_EMAIL,
    VAULT_COMMITTER_NAME,
    VAULT_REPO_URL,
)
from data_access import (
    ApplitoolsBatchRepository,
    BlazemeterPresetRepository,
    BlazemeterRunRepository,
    ConnectionManager,
    JiraUserCacheRepository,
    QaCycleRepository,
    QaReportCacheRepository,
    QaTestCaseCacheRepository,
    SiteRepository,
    SnapshotRepository,
    UrlRepository,
    TestResultRepository,
    TriggerRepository,
    PresetRepository,
)
from exceptions import (
    AuthenticationError,
    DatabaseError,
    ExternalAPIError,
    RateLimitError,
    SchedulerError,
    ValidationError,
)
from services.applitools_storage import ApplitoolsBatchStore
from services.blazemeter_client import BlazemeterClient
from services.blazemeter_queue import BlazemeterQueueService
from services.migration_dashboard_service import MigrationDashboardService
from services.obsidian_sync_service import ObsidianSyncService, SyncAlreadyRunning
from services.obsidian_sync.vault_reader import VaultReader
from services.qa_testing_service import QaTestingReportService
from services.requirement_kb_service import RequirementKbService
from services.scheduling_window import ActiveHoursWindow
from services.snapshot_service import SnapshotService
from services.pagespeed_client import PageSpeedClient
from services.vault_git_service import VaultGitService
from routes import register_blueprints
from services.site_service import SiteService
from services.testing_service import TestingService
from services.trigger_service import TriggerService


class SchedulerLease:
    """Best-effort cross-process lease for in-process background jobs.

    APScheduler's in-memory scheduler is safe only when one web worker owns
    it. Gunicorn may import this module in multiple workers, so we take a
    non-blocking file lock before starting scheduled work.
    """

    def __init__(self, path: str | None = None) -> None:
        self.path = path or os.environ.get(
            "PHAROS_SCHEDULER_LOCK",
            os.path.join(tempfile.gettempdir(), "pharos-scheduler.lock"),
        )
        self._handle = None

    def acquire(self) -> bool:
        lock_dir = os.path.dirname(self.path)
        if lock_dir:
            os.makedirs(lock_dir, exist_ok=True)
        handle = open(self.path, "a+", encoding="utf-8")
        try:
            if os.name == "nt":
                import msvcrt

                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

            handle.seek(0)
            handle.truncate()
            handle.write(str(os.getpid()))
            handle.flush()
            self._handle = handle
            return True
        except OSError:
            handle.close()
            return False

    def release(self) -> None:
        if self._handle is None:
            return
        try:
            if os.name == "nt":
                import msvcrt

                self._handle.seek(0)
                msvcrt.locking(self._handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(self._handle.fileno(), fcntl.LOCK_UN)
        finally:
            self._handle.close()
            self._handle = None


def _seed_vault_wiki(vault_root: str) -> None:
    """Populate ``<vault_root>/wiki/`` from the shipped seed on first boot.

    The curated wiki content (workstreams, blockers, status snapshots)
    drives the Launch Command Center dashboard and isn't pulled from
    Jira or Asana. We ship a snapshot in the Docker image at
    ``/app/vault_seed/wiki/`` and copy it onto the Railway volume the
    first time the container starts against an empty volume.

    This only seeds: if ``<vault_root>/wiki/`` already exists (even empty),
    we leave it alone so in-place edits survive subsequent deploys.
    """
    import shutil

    target_wiki = os.path.join(vault_root, "wiki")
    if os.path.isdir(target_wiki):
        return

    seed_source = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault_seed", "wiki")
    if not os.path.isdir(seed_source):
        logging.warning(
            "Vault wiki seed not found at %s — dashboard will be unavailable until wiki is populated.",
            seed_source,
        )
        return

    try:
        os.makedirs(vault_root, exist_ok=True)
        shutil.copytree(seed_source, target_wiki)
        logging.info("Seeded vault wiki from %s → %s", seed_source, target_wiki)
    except Exception:
        logging.exception("Failed to seed vault wiki at %s", target_wiki)


def create_app() -> Flask:
    """Application factory — builds a fully-configured Flask app."""
    flask_app = Flask(__name__)

    # ---- Dependency wiring ----
    conn_mgr = ConnectionManager()
    atexit.register(conn_mgr.close_all)
    conn_mgr.init_schema()

    site_repo = SiteRepository(conn_mgr)
    url_repo = UrlRepository(conn_mgr)
    test_result_repo = TestResultRepository(conn_mgr)
    trigger_repo = TriggerRepository(conn_mgr)
    preset_repo = PresetRepository(conn_mgr)
    blazemeter_preset_repo = BlazemeterPresetRepository(conn_mgr)
    blazemeter_run_repo = BlazemeterRunRepository(conn_mgr)
    applitools_batch_repo = ApplitoolsBatchRepository(conn_mgr, ttl_seconds=24 * 60 * 60)

    pagespeed = PageSpeedClient(api_key=PAGESPEED_API_KEY)

    site_service = SiteService(site_repo, url_repo, test_result_repo)
    testing_service = TestingService(pagespeed, url_repo, test_result_repo)

    # Persist Applitools batches uploaded by the desktop helper so QA
    # uploads survive restarts, redeploys, and future worker scaling.
    applitools_store = ApplitoolsBatchStore(repository=applitools_batch_repo)

    # ---- Scheduler ----
    # Explicit UTC timezone ensures cron expressions fire at the same time
    # regardless of where the server is hosted (Railway, local dev, etc.).
    scheduler = BackgroundScheduler(timezone='UTC')
    scheduler_lease = SchedulerLease()
    scheduler_enabled = scheduler_lease.acquire()
    flask_app.extensions["scheduler_lease"] = scheduler_lease
    flask_app.extensions["scheduler_enabled"] = scheduler_enabled

    trigger_service = TriggerService(trigger_repo, preset_repo, url_repo, testing_service, scheduler)
    if scheduler_enabled:
        atexit.register(scheduler_lease.release)
        scheduler.start()
        logging.info(
            "Scheduler lease acquired at %s; this worker owns background jobs",
            scheduler_lease.path,
        )
        trigger_service.sync_all_jobs()
        scheduler.add_job(
            trigger_service.sync_all_jobs,
            trigger="interval",
            minutes=1,
            id="trigger-job-reconcile",
            replace_existing=True,
            max_instances=1,
        )
    else:
        logging.warning(
            "Scheduler lease held by another worker; this worker will serve requests "
            "without starting background jobs (%s)",
            scheduler_lease.path,
        )

    # ---- BlazeMeter (optional; only wired when env vars are present) ----
    blazemeter_client: BlazemeterClient | None = None
    blazemeter_queue: BlazemeterQueueService | None = None
    if BLAZEMETER_API_KEY_ID and BLAZEMETER_API_SECRET:
        try:
            blazemeter_client = BlazemeterClient(
                api_key_id=BLAZEMETER_API_KEY_ID,
                api_key_secret=BLAZEMETER_API_SECRET,
                workspace_id=BLAZEMETER_WORKSPACE_ID,
            )
            if scheduler_enabled:
                blazemeter_queue = BlazemeterQueueService(
                    blazemeter_client, scheduler, run_repo=blazemeter_run_repo,
                )
                logging.info("BlazeMeter integration enabled")
            else:
                logging.info(
                    "BlazeMeter client enabled; queue polling is owned by the scheduler worker"
                )
        except Exception:
            logging.exception("Failed to initialise BlazeMeter integration")
            blazemeter_client = None
            blazemeter_queue = None
    else:
        logging.info("BlazeMeter env vars not set — load testing disabled")

    # ---- Obsidian bridge + Launch Command Center ----
    # Both services read from the same vault on disk. The dashboard
    # subscribes to the sync service so its cache auto-invalidates
    # whenever a sync completes — no TTL wait.
    #
    # Vault provisioning: when VAULT_REPO_URL + VAULT_BOT_TOKEN are set,
    # the vault is a clone of the lpadobe-vault GitHub repo — every sync
    # commits and pushes, and the orchestrator agent pushes wiki edits
    # back. When unset, fall back to the Docker-image seed (legacy path).
    vault_git: VaultGitService | None = None
    if VAULT_REPO_URL and VAULT_BOT_TOKEN:
        try:
            vault_git = VaultGitService(
                vault_root=OBSIDIAN_VAULT_ROOT,
                repo_url=VAULT_REPO_URL,
                token=VAULT_BOT_TOKEN,
                committer_name=VAULT_COMMITTER_NAME,
                committer_email=VAULT_COMMITTER_EMAIL,
            )
            vault_git.ensure_cloned()
        except Exception:
            logging.exception("Vault git bootstrap failed — falling back to seed")
            vault_git = None

    if vault_git is None:
        _seed_vault_wiki(OBSIDIAN_VAULT_ROOT)

    migration_dashboard_service = MigrationDashboardService(
        vault_root=OBSIDIAN_VAULT_ROOT,
    )
    from services.ai_config_service import AiConfigService

    ai_config_service = AiConfigService(conn_mgr)
    requirement_service = RequirementKbService(conn_mgr, OBSIDIAN_VAULT_ROOT)
    qa_testing_service = QaTestingReportService(
        jira_pat=JIRA_PAT or "",
        jira_base_url=JIRA_BASE_URL,
        test_case_cache_repo=QaTestCaseCacheRepository(conn_mgr),
        user_cache_repo=JiraUserCacheRepository(conn_mgr),
        report_cache_repo=QaReportCacheRepository(conn_mgr),
        cycle_repo=QaCycleRepository(conn_mgr),
    )

    # ---- Migration status snapshots (history + what-changed-today) ----
    snapshot_repo = SnapshotRepository(conn_mgr)
    snapshot_service = SnapshotService(
        repository=snapshot_repo,
        vault_reader=VaultReader(OBSIDIAN_VAULT_ROOT),
    )
    def _post_sync(_job):
        migration_dashboard_service.invalidate_cache()
        # Touch a sentinel so the dashboard's "synced X ago" advances even
        # when an incremental sync found no upstream changes (directory
        # mtimes don't update if no files were written).
        try:
            sentinel = os.path.join(OBSIDIAN_VAULT_ROOT, ".last_sync")
            with open(sentinel, "w", encoding="utf-8") as fh:
                fh.write("")
        except OSError:
            logging.exception("Failed to touch sentinel after sync")
        try:
            snapshot_service.ingest_vault()
        except Exception:
            logging.exception("Snapshot ingest after sync failed")

    def _push_vault(job):
        # Runs after _post_sync, so the .last_sync sentinel is included
        # in the commit. Guard with `if vault_git` so unset env vars
        # leave the hook chain inert.
        if vault_git is None:
            return
        label = f"{job.source} sync — job {job.job_id[:8]}"
        vault_git.commit_and_push(label)

    sync_hooks = [_post_sync, _push_vault]

    obsidian_sync_service = ObsidianSyncService(
        vault_root=OBSIDIAN_VAULT_ROOT,
        jira_pat=JIRA_PAT or '',
        jira_base_url=JIRA_BASE_URL,
        asana_pat=ASANA_PAT or '',
        asana_project_map=ASANA_PROJECT_MAP,
        default_jira_projects=JIRA_DEFAULT_PROJECTS,
        jira_jql_queries=JIRA_JQL_QUERIES,
        on_sync_complete=sync_hooks,
    )
    caps = obsidian_sync_service.capabilities()
    logging.info(
        "Obsidian bridge: vault=%s (exists=%s) jira=%s asana=%s jqlFeeds=%s dashboard=%s",
        caps['vaultRoot'], caps['vaultExists'],
        caps['jiraConfigured'], caps['asanaConfigured'],
        caps['jiraJqlFeeds'],
        migration_dashboard_service.is_available(),
    )

    def _on_vault_refreshed() -> None:
        # Fires after diagnostic refreshes (e.g. reset-to-origin) that
        # update the vault's working tree without going through the
        # sync pipeline. The sync's `_post_sync` already does the same
        # two things — keep these in lockstep so cache and DB stay
        # consistent with the on-disk vault.
        migration_dashboard_service.invalidate_cache()
        try:
            snapshot_service.ingest_vault()
        except Exception:
            logging.exception("Snapshot ingest after vault refresh failed")

    def _run_startup_vault_refresh() -> None:
        """Refresh vault-backed data after the web worker is available."""
        logging.info("Starting deferred vault refresh")
        if vault_git is not None:
            try:
                # Pick up orchestrator commits pushed between syncs without
                # making the web worker wait during application startup.
                vault_git.pull_latest()
                vault_git.refresh_orchestration_marker()
            except Exception:
                logging.exception("Deferred vault pull failed")

        migration_dashboard_service.invalidate_cache()
        try:
            seeded = snapshot_service.ingest_vault()
            if seeded:
                logging.info(
                    "Snapshot ingest refreshed %d dates: %s",
                    len(seeded), ", ".join(seeded),
                )
        except Exception:
            logging.exception("Deferred snapshot ingest failed")

    if scheduler_enabled:
        scheduler.add_job(
            _run_startup_vault_refresh,
            trigger="date",
            run_date=datetime.now(timezone.utc) + timedelta(seconds=5),
            id="startup-vault-refresh",
            replace_existing=True,
            max_instances=1,
        )
    else:
        logging.info("Deferred vault refresh will run in the scheduler-owning worker")

    # Active-hours gate for periodic vault jobs. Both the auto-refresh
    # tick and the Jira/Asana sync tick consult this before doing any
    # real work; outside the window the tick still fires (APScheduler
    # keeps its own cadence) but no-ops at the top so we don't hammer
    # upstream APIs overnight when no human is around to read the
    # output.
    try:
        active_hours = ActiveHoursWindow(
            start_hour=VAULT_ACTIVE_HOURS_START,
            end_hour=VAULT_ACTIVE_HOURS_END,
            timezone=VAULT_ACTIVE_HOURS_TZ,
        )
        logging.info(
            "Vault scheduler active-hours window: %s", active_hours.describe()
        )
    except Exception:
        logging.exception(
            "Invalid VAULT_ACTIVE_HOURS_* config — falling back to 24/7 schedule"
        )
        active_hours = None

    # Schedule a periodic pull from origin so orchestrator commits land
    # on the Railway clone without waiting for the user to click refresh.
    # 10 minutes is responsive enough for hourly orchestration without
    # hammering the git remote. When the pull reports a new HEAD, the
    # same refresh hooks used by reset-to-origin fire so the dashboard
    # cache and snapshot DB follow along automatically.
    if scheduler_enabled and vault_git is not None:
        AUTO_REFRESH_INTERVAL_MIN = int(os.environ.get("VAULT_AUTO_REFRESH_MINUTES", "10"))

        def _vault_auto_refresh_tick() -> None:
            if active_hours is not None and not active_hours.is_open():
                logging.debug(
                    "Vault auto-refresh skipped — outside active-hours window (%s)",
                    active_hours.describe(),
                )
                return
            prev_head = vault_git.auto_refresh_status().get("lastRefreshedHead")
            result = vault_git.auto_refresh()
            if result.get("ok") and result.get("head") and result["head"] != prev_head:
                _on_vault_refreshed()

        scheduler.add_job(
            _vault_auto_refresh_tick,
            trigger="interval",
            minutes=AUTO_REFRESH_INTERVAL_MIN,
            id="vault-auto-refresh",
            replace_existing=True,
            next_run_time=datetime.now(timezone.utc) + timedelta(seconds=30),
        )

    # Hourly Jira/Asana sync, locked to a wall-clock minute via cron.
    #
    # The previous interval schedule (60 min, first fire 2 min after
    # boot) re-armed every container restart, so a busy deploy hour
    # would produce one sync per deploy — and each sync pushes raw
    # files which retriggers the orchestrator. Switching to a cron
    # trigger pins firing to the same wall-clock minute every hour
    # regardless of when we redeploy, so N deploys in an hour produce
    # at most one sync.
    #
    # OBSIDIAN_SYNC_CRON_MINUTE accepts any APScheduler minute
    # expression: "5" (default, fires at :05), "*/30" (every 30 min),
    # "0,30" (top + half), etc. The active-hours gate still applies
    # so overnight ticks no-op even if the cron fires.
    OBSIDIAN_SYNC_CRON_MINUTE = os.environ.get("OBSIDIAN_SYNC_CRON_MINUTE", "5")

    def _obsidian_sync_tick() -> None:
        if active_hours is not None and not active_hours.is_open():
            logging.debug(
                "Obsidian sync skipped — outside active-hours window (%s)",
                active_hours.describe(),
            )
            return
        try:
            obsidian_sync_service.start_sync(source="both")
        except SyncAlreadyRunning:
            logging.info("Skipping scheduled sync — a sync is already running")
        except Exception:
            logging.exception("Scheduled obsidian sync failed to start")

    if scheduler_enabled:
        scheduler.add_job(
            _obsidian_sync_tick,
            trigger="cron",
            minute=OBSIDIAN_SYNC_CRON_MINUTE,
            id="obsidian-hourly-sync",
            replace_existing=True,
        )
        logging.info(
            "Obsidian sync cron registered: minute=%s (cron expression)",
            OBSIDIAN_SYNC_CRON_MINUTE,
        )

    # ---- Blueprints ----
    register_blueprints(
        flask_app, site_service, testing_service, test_result_repo, trigger_service,
        blazemeter_preset_repo=blazemeter_preset_repo,
        blazemeter_run_repo=blazemeter_run_repo,
        blazemeter_client=blazemeter_client,
        blazemeter_queue=blazemeter_queue,
        obsidian_sync_service=obsidian_sync_service,
        vault_git_service=vault_git,
        migration_dashboard_service=migration_dashboard_service,
        snapshot_service=snapshot_service,
        on_vault_refreshed=[_on_vault_refreshed],
        github_webhook_secret=GITHUB_WEBHOOK_SECRET,
        devops_pat=DEVOPS_PAT,
        devops_organization=DEVOPS_ORGANIZATION,
        devops_project=DEVOPS_PROJECT,
        devops_orchestrator_pipeline_id=DEVOPS_ORCHESTRATOR_PIPELINE_ID,
        devops_pipeline_map=DEVOPS_PIPELINE_MAP,
        applitools_store=applitools_store,
        applitools_helper_token=APPLITOOLS_HELPER_TOKEN,
        requirement_service=requirement_service,
        ai_config_service=ai_config_service,
        qa_testing_service=qa_testing_service,
    )

    # ---- Centralized error handlers ----
    @flask_app.errorhandler(ValidationError)
    def handle_validation_error(exc):
        return jsonify({"success": False, "error": exc.message}), 400

    @flask_app.errorhandler(AuthenticationError)
    def handle_auth_error(exc):
        return jsonify({"success": False, "error": str(exc)}), 401

    @flask_app.errorhandler(DatabaseError)
    def handle_db_error(exc):
        return jsonify({"success": False, "error": exc.message}), 500

    @flask_app.errorhandler(RateLimitError)
    def handle_rate_limit_error(exc):
        return jsonify({
            "success": False,
            "error": str(exc),
            "retryAfter": exc.retry_after,
        }), 429

    @flask_app.errorhandler(ExternalAPIError)
    def handle_external_api_error(exc):
        return jsonify({"success": False, "error": str(exc)}), 502

    @flask_app.errorhandler(SchedulerError)
    def handle_scheduler_error(exc):
        return jsonify({"success": False, "error": exc.message}), 500

    # ---- Serve React frontend at / (catch-all after API and legacy routes) ----
    frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend', 'dist')
    logging.info('React frontend dist path: %s (exists: %s)', frontend_dist, os.path.exists(frontend_dist))

    @flask_app.route('/')
    @flask_app.route('/<path:path>')
    def serve_react(path: str = '') -> Response:
        """Serve the React SPA as the primary frontend.

        Static assets (JS, CSS, images) are served from the Vite build
        output directory. All other paths return index.html so React
        Router can handle client-side routing. API routes (/api/*) and
        legacy routes (/legacy/*) are handled by their own blueprints
        and take priority over this catch-all.
        """
        if not os.path.exists(frontend_dist):
            return Response(
                f'Frontend not built. Expected at: {frontend_dist}',
                status=503,
                mimetype='text/plain',
            )
        if path and os.path.isfile(os.path.join(frontend_dist, path)):
            return send_from_directory(frontend_dist, path)
        return send_from_directory(frontend_dist, 'index.html')

    return flask_app


# Module-level instance for Gunicorn (Procfile: app:app)
app = create_app()

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=PORT)
