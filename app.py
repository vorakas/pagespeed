"""Application factory for the PageSpeed Insights Monitor.

Creates the Flask app, wires dependency injection, registers blueprints,
and sets up the APScheduler daily test job and centralized error handlers.
"""

from flask import Flask, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

from config import DAILY_TEST_HOUR, PAGESPEED_API_KEY, PORT
from data_access import ConnectionManager, SiteRepository, UrlRepository, TestResultRepository
from exceptions import (
    AuthenticationError,
    DatabaseError,
    ExternalAPIError,
    ValidationError,
)
from services.pagespeed_client import PageSpeedClient
from routes import register_blueprints
from services.site_service import SiteService
from services.testing_service import TestingService

load_dotenv()


def create_app() -> Flask:
    """Application factory — builds a fully-configured Flask app."""
    flask_app = Flask(__name__)

    # ---- Dependency wiring ----
    conn_mgr = ConnectionManager()
    conn_mgr.init_schema()

    site_repo = SiteRepository(conn_mgr)
    url_repo = UrlRepository(conn_mgr)
    test_result_repo = TestResultRepository(conn_mgr)

    pagespeed = PageSpeedClient(api_key=PAGESPEED_API_KEY)

    site_service = SiteService(site_repo, url_repo, test_result_repo)
    testing_service = TestingService(pagespeed, url_repo, test_result_repo)

    # ---- Blueprints ----
    register_blueprints(flask_app, site_service, testing_service, test_result_repo)

    # ---- Scheduler ----
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        func=testing_service.run_daily_tests,
        trigger="cron",
        hour=DAILY_TEST_HOUR,
        minute=0,
    )
    scheduler.start()

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

    @flask_app.errorhandler(ExternalAPIError)
    def handle_external_api_error(exc):
        return jsonify({"success": False, "error": str(exc)}), 502

    return flask_app


# Module-level instance for Gunicorn (Procfile: app:app)
app = create_app()

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=PORT)
