"""Routes package — registers all Flask Blueprints.

Each blueprint is created via a factory function that receives its
dependencies (services, repositories) through explicit arguments.
"""

from typing import Callable, Sequence

from flask import Flask

from data_access import AutofixRepository, BlazemeterPresetRepository, BlazemeterRunRepository, TestResultRepository
from routes.ai_api import create_ai_blueprint
from routes.autofix_api import create_autofix_blueprint
from routes.applitools_api import create_applitools_blueprint
from routes.azure_api import create_azure_blueprint
from routes.blazemeter_api import create_blazemeter_blueprint
from routes.dashboard_api import create_dashboard_blueprint
from routes.devops_api import create_devops_blueprint
from routes.github_webhook_api import create_github_webhook_blueprint
from routes.metrics_api import create_metrics_blueprint
from routes.newrelic_api import create_newrelic_blueprint
from routes.obsidian_api import create_obsidian_blueprint
from routes.pages import create_pages_blueprint
from routes.requirements_api import create_requirements_blueprint
from routes.sites_api import create_sites_blueprint
from routes.testing_api import create_testing_blueprint
from routes.testdata_validation_api import create_testdata_validation_blueprint
from routes.triggers_api import create_triggers_blueprint
from services.applitools_storage import ApplitoolsBatchStore
from services.autofix_ingest_service import AutofixIngestService
from services.ai_config_service import AiConfigService
from services.blazemeter_client import BlazemeterClient
from services.blazemeter_queue import BlazemeterQueueService
from services.migration_dashboard_service import MigrationDashboardService
from services.obsidian_sync_service import ObsidianSyncService
from services.qa_testing_service import QaTestingReportService
from services.requirement_kb_service import RequirementKbService
from services.site_service import SiteService
from services.snapshot_service import SnapshotService
from services.testing_service import TestingService
from services.sku_validation_service import SkuValidationService
from services.trigger_service import TriggerService
from services.vault_git_service import VaultGitService


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
    vault_git_service: "VaultGitService | None" = None,
    migration_dashboard_service: "MigrationDashboardService | None" = None,
    snapshot_service: "SnapshotService | None" = None,
    on_vault_refreshed: "Sequence[Callable[[], None]] | None" = None,
    github_webhook_secret: "str | None" = None,
    devops_pat: "str | None" = None,
    devops_organization: str = "LampsPlus",
    devops_project: str = "TestAutomation",
    devops_orchestrator_pipeline_id: "int | None" = None,
    devops_pipeline_map: "dict | None" = None,
    applitools_store: "ApplitoolsBatchStore | None" = None,
    applitools_helper_token: "str | None" = None,
    requirement_service: "RequirementKbService | None" = None,
    ai_config_service: "AiConfigService | None" = None,
    qa_testing_service: "QaTestingReportService | None" = None,
    autofix_repository: "AutofixRepository | None" = None,
    autofix_ingest_service: "AutofixIngestService | None" = None,
    autofix_pipeline_ids: "list | None" = None,
    sku_validation_service: "SkuValidationService | None" = None,
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
    app.register_blueprint(create_ai_blueprint(ai_config_service))
    if requirement_service is not None:
        app.register_blueprint(create_requirements_blueprint(
            requirement_service,
            ai_config_service,
            qa_testing_service,
        ))
    app.register_blueprint(create_devops_blueprint(
        server_pat=devops_pat,
        server_organization=devops_organization,
        server_project=devops_project,
        server_orchestrator_pipeline_id=devops_orchestrator_pipeline_id,
        server_pipeline_map=devops_pipeline_map,
    ))
    if autofix_repository is not None and autofix_ingest_service is not None:
        app.register_blueprint(create_autofix_blueprint(
            repository=autofix_repository,
            ingest_service=autofix_ingest_service,
            server_pat=devops_pat,
            server_organization=devops_organization,
            server_project=devops_project,
            autofix_pipeline_ids=autofix_pipeline_ids,
        ))
    app.register_blueprint(
        create_applitools_blueprint(
            applitools_store or ApplitoolsBatchStore(),
            applitools_helper_token,
        )
    )
    app.register_blueprint(
        create_blazemeter_blueprint(
            blazemeter_queue,
            blazemeter_client,
            blazemeter_preset_repo,
            blazemeter_run_repo,
        ),
    )
    if obsidian_sync_service is not None:
        app.register_blueprint(
            create_obsidian_blueprint(
                obsidian_sync_service,
                vault_git_service,
                on_vault_refreshed=on_vault_refreshed,
            )
        )
    if migration_dashboard_service is not None:
        app.register_blueprint(
            create_dashboard_blueprint(migration_dashboard_service, snapshot_service),
        )
    if vault_git_service is not None:
        app.register_blueprint(
            create_github_webhook_blueprint(
                vault_git_service,
                webhook_secret=github_webhook_secret,
                on_vault_refreshed=on_vault_refreshed,
            )
        )
    if sku_validation_service is not None:
        app.register_blueprint(
            create_testdata_validation_blueprint(sku_validation_service)
        )
