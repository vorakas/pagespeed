"""Routes package — registers all Flask Blueprints.

Each blueprint is created via a factory function that receives its
dependencies (services, repositories) through explicit arguments.
"""

from flask import Flask

from data_access import BlazemeterPresetRepository, BlazemeterRunRepository, TestResultRepository
from routes.ai_api import create_ai_blueprint
from routes.azure_api import create_azure_blueprint
from routes.blazemeter_api import create_blazemeter_blueprint
from routes.dashboard_api import create_dashboard_blueprint
from routes.devops_api import create_devops_blueprint
from routes.metrics_api import create_metrics_blueprint
from routes.newrelic_api import create_newrelic_blueprint
from routes.obsidian_api import create_obsidian_blueprint
from routes.pages import create_pages_blueprint
from routes.sites_api import create_sites_blueprint
from routes.testing_api import create_testing_blueprint
from routes.triggers_api import create_triggers_blueprint
from services.blazemeter_client import BlazemeterClient
from services.blazemeter_queue import BlazemeterQueueService
from services.migration_dashboard_service import MigrationDashboardService
from services.obsidian_sync_service import ObsidianSyncService
from services.site_service import SiteService
from services.snapshot_service import SnapshotService
from services.testing_service import TestingService
from services.trigger_service import TriggerService


def register_blueprints(
    app: Flask,
    site_service: SiteService,
    testing_service: TestingService,
    test_result_repo: TestResultRepository,
    trigger_service: TriggerService,
    blazemeter_preset_repo: BlazemeterPresetRepository,
    blazemeter_run_repo: BlazemeterRunRepository,
    blazemeter_client: "BlazemeterClient | None" = None,
    blazemeter_queue: "BlazemeterQueueService | None" = None,
    obsidian_sync_service: "ObsidianSyncService | None" = None,
    migration_dashboard_service: "MigrationDashboardService | None" = None,
    snapshot_service: "SnapshotService | None" = None,
) -> None:
    """Create and register all blueprints on the Flask app.

    Args:
        app:              The Flask application instance.
        site_service:     Service for site/URL CRUD operations.
        testing_service:  Service for PageSpeed testing workflows.
        test_result_repo: Repository for querying test results.
        trigger_service:  Service for scheduled trigger management.
    """
    app.register_blueprint(create_pages_blueprint(site_service))
    app.register_blueprint(create_sites_blueprint(site_service))
    app.register_blueprint(create_testing_blueprint(testing_service))
    app.register_blueprint(create_metrics_blueprint(test_result_repo))
    app.register_blueprint(create_triggers_blueprint(trigger_service))
    app.register_blueprint(create_newrelic_blueprint())
    app.register_blueprint(create_azure_blueprint())
    app.register_blueprint(create_ai_blueprint())
    app.register_blueprint(create_devops_blueprint())
    app.register_blueprint(
        create_blazemeter_blueprint(
            blazemeter_queue,
            blazemeter_client,
            blazemeter_preset_repo,
            blazemeter_run_repo,
        ),
    )
    if obsidian_sync_service is not None:
        app.register_blueprint(create_obsidian_blueprint(obsidian_sync_service))
    if migration_dashboard_service is not None:
        app.register_blueprint(
            create_dashboard_blueprint(migration_dashboard_service, snapshot_service),
        )
