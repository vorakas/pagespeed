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
    JIRA_PAT,
    OBSIDIAN_VAULT_ROOT,
    PAGESPEED_API_KEY,
    PORT,
)
from data_access import (
    BlazemeterPresetRepository,
    BlazemeterRunRepository,
    ConnectionManager,
    SiteRepository,
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
from services.pagespeed_client import PageSpeedClient
from routes import register_blueprints
from services.site_service import SiteService
from services.testing_service import TestingService
from services.trigger_service import TriggerService


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
    migration_dashboard_service = MigrationDashboardService(
        vault_root=OBSIDIAN_VAULT_ROOT,
    )
    obsidian_sync_service = ObsidianSyncService(
        vault_root=OBSIDIAN_VAULT_ROOT,
        jira_pat=JIRA_PAT or '',
        jira_base_url=JIRA_BASE_URL,
        asana_pat=ASANA_PAT or '',
        asana_project_map=ASANA_PROJECT_MAP,
        default_jira_projects=JIRA_DEFAULT_PROJECTS,
        on_sync_complete=[lambda _job: migration_dashboard_service.invalidate_cache()],
    )
    caps = obsidian_sync_service.capabilities()
    logging.info(
        "Obsidian bridge: vault=%s (exists=%s) jira=%s asana=%s dashboard=%s",
        caps['vaultRoot'], caps['vaultExists'],
        caps['jiraConfigured'], caps['asanaConfigured'],
        migration_dashboard_service.is_available(),
    )

    # ---- Blueprints ----
    register_blueprints(
        flask_app, site_service, testing_service, test_result_repo, trigger_service,
        blazemeter_preset_repo=blazemeter_preset_repo,
        blazemeter_run_repo=blazemeter_run_repo,
        blazemeter_client=blazemeter_client,
        blazemeter_queue=blazemeter_queue,
        obsidian_sync_service=obsidian_sync_service,
        migration_dashboard_service=migration_dashboard_service,
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
