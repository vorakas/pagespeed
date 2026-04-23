"""Application factory for the PageSpeed Insights Monitor.

Creates the Flask app, wires dependency injection, registers blueprints,
and sets up the APScheduler with user-configured triggers and centralized
error handlers.
"""

import logging
import os
import sys

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
    ASANA_PAT,
    ASANA_PROJECT_MAP,
    BLAZEMETER_API_KEY_ID,
    BLAZEMETER_API_SECRET,
    BLAZEMETER_WORKSPACE_ID,
    JIRA_BASE_URL,
    JIRA_DEFAULT_PROJECTS,
    JIRA_JQL_QUERIES,
    JIRA_PAT,
    OBSIDIAN_VAULT_ROOT,
    PAGESPEED_API_KEY,
    PORT,
    VAULT_BOT_TOKEN,
    VAULT_COMMITTER_EMAIL,
    VAULT_COMMITTER_NAME,
    VAULT_REPO_URL,
)
from data_access import (
    BlazemeterPresetRepository,
    BlazemeterRunRepository,
    ConnectionManager,
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
from services.blazemeter_client import BlazemeterClient
from services.blazemeter_queue import BlazemeterQueueService
from services.migration_dashboard_service import MigrationDashboardService
from services.obsidian_sync_service import ObsidianSyncService
from services.obsidian_sync.vault_reader import VaultReader
from services.snapshot_service import SnapshotService
from services.pagespeed_client import PageSpeedClient
from services.vault_git_service import VaultGitService
from routes import register_blueprints
from services.site_service import SiteService
from services.testing_service import TestingService
from services.trigger_service import TriggerService


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
    conn_mgr.init_schema()

    site_repo = SiteRepository(conn_mgr)
    url_repo = UrlRepository(conn_mgr)
    test_result_repo = TestResultRepository(conn_mgr)
    trigger_repo = TriggerRepository(conn_mgr)
    preset_repo = PresetRepository(conn_mgr)
    blazemeter_preset_repo = BlazemeterPresetRepository(conn_mgr)
    blazemeter_run_repo = BlazemeterRunRepository(conn_mgr)

    pagespeed = PageSpeedClient(api_key=PAGESPEED_API_KEY)

    site_service = SiteService(site_repo, url_repo, test_result_repo)
    testing_service = TestingService(pagespeed, url_repo, test_result_repo)

    # ---- Scheduler ----
    # Explicit UTC timezone ensures cron expressions fire at the same time
    # regardless of where the server is hosted (Railway, local dev, etc.).
    scheduler = BackgroundScheduler(timezone='UTC')
    scheduler.start()

    trigger_service = TriggerService(trigger_repo, preset_repo, testing_service, scheduler)
    trigger_service.sync_all_jobs()

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
            blazemeter_queue = BlazemeterQueueService(
                blazemeter_client, scheduler, run_repo=blazemeter_run_repo,
            )
            logging.info("BlazeMeter integration enabled")
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

    # ---- Migration status snapshots (history + what-changed-today) ----
    snapshot_repo = SnapshotRepository(conn_mgr)
    snapshot_service = SnapshotService(
        repository=snapshot_repo,
        vault_reader=VaultReader(OBSIDIAN_VAULT_ROOT),
    )
    # Pull the latest vault state before the first ingest so we pick up
    # orchestrator commits pushed between syncs (otherwise the DB lags
    # one sync cycle behind the remote).
    if vault_git is not None:
        vault_git.pull_latest()

    # Seed the DB on boot so the dashboard has history even before the
    # first sync cycle runs.
    try:
        seeded = snapshot_service.ingest_vault()
        if seeded:
            logging.info("Snapshot ingest seeded %d dates: %s", len(seeded), ", ".join(seeded))
    except Exception:
        logging.exception("Snapshot ingest on startup failed")

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
