"""Business logic layer — sits between routes and data access.

Re-exports the public API so callers can write:
    from services import SiteService, TestingService, PageSpeedClient, ...
"""

from services.validation import parse_time_range_to_minutes, validate_required_fields
from services.site_service import SiteService
from services.testing_service import TestingService
from services.pagespeed_client import PageSpeedClient
from services.newrelic_client import NewRelicClient
from services.azure_client import AzureLogAnalyticsClient
from services.ai_base import AIServiceBase
from services.ai_claude import ClaudeClient
from services.ai_openai import OpenAIClient
from services.ai_orchestrator import AIOrchestrator

__all__ = [
    "validate_required_fields",
    "parse_time_range_to_minutes",
    "SiteService",
    "TestingService",
    "PageSpeedClient",
    "NewRelicClient",
    "AzureLogAnalyticsClient",
    "AIServiceBase",
    "ClaudeClient",
    "OpenAIClient",
    "AIOrchestrator",
]
