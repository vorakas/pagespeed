"""Routes package — registers all Flask Blueprints.

Each blueprint is created via a factory function that receives its
dependencies (services, repositories) through explicit arguments.
"""

from flask import Flask

from data_access import TestResultRepository
from routes.ai_api import create_ai_blueprint
from routes.azure_api import create_azure_blueprint
from routes.metrics_api import create_metrics_blueprint
from routes.newrelic_api import create_newrelic_blueprint
from routes.pages import create_pages_blueprint
from routes.sites_api import create_sites_blueprint
from routes.testing_api import create_testing_blueprint
from services.site_service import SiteService
from services.testing_service import TestingService


def register_blueprints(
    app: Flask,
    site_service: SiteService,
    testing_service: TestingService,
    test_result_repo: TestResultRepository,
) -> None:
    """Create and register all blueprints on the Flask app.

    Args:
        app:              The Flask application instance.
        site_service:     Service for site/URL CRUD operations.
        testing_service:  Service for PageSpeed testing workflows.
        test_result_repo: Repository for querying test results.
    """
    app.register_blueprint(create_pages_blueprint(site_service))
    app.register_blueprint(create_sites_blueprint(site_service))
    app.register_blueprint(create_testing_blueprint(testing_service))
    app.register_blueprint(create_metrics_blueprint(test_result_repo))
    app.register_blueprint(create_newrelic_blueprint())
    app.register_blueprint(create_azure_blueprint())
    app.register_blueprint(create_ai_blueprint())
