"""Custom exception hierarchy for the PageSpeed Monitor application.

Design follows the Open/Closed Principle: new external API integrations
add a concrete subclass of ExternalAPIError without modifying existing
exception classes. Callers can catch at any level of the hierarchy —
broad (AppError) or narrow (PageSpeedError) — depending on context.
"""


class AppError(Exception):
    """Base exception for all application-specific errors.

    Args:
        message: Human-readable description of what went wrong.
    """

    def __init__(self, message: str) -> None:
        self.message: str = message
        super().__init__(self.message)


class ValidationError(AppError):
    """Bad input — missing required fields, invalid values, etc."""


class DatabaseError(AppError):
    """Failure during a database operation (connection, query, migration)."""


class ExternalAPIError(AppError):
    """Base for errors originating from third-party API calls.

    Args:
        message:  Human-readable description of the failure.
        provider: Optional name of the external service (e.g. "Google PageSpeed").
    """

    def __init__(self, message: str, provider: str | None = None) -> None:
        self.provider: str | None = provider
        super().__init__(message)

    def __str__(self) -> str:
        if self.provider:
            return f"[{self.provider}] {self.message}"
        return self.message


class PageSpeedError(ExternalAPIError):
    """Google PageSpeed Insights API failure."""

    def __init__(self, message: str) -> None:
        super().__init__(message, provider="Google PageSpeed")


class NewRelicError(ExternalAPIError):
    """New Relic NerdGraph API failure."""

    def __init__(self, message: str) -> None:
        super().__init__(message, provider="New Relic")


class AzureError(ExternalAPIError):
    """Azure Log Analytics API failure."""

    def __init__(self, message: str) -> None:
        super().__init__(message, provider="Azure")


class AzureDevOpsError(ExternalAPIError):
    """Azure DevOps Pipelines REST API failure."""

    def __init__(self, message: str) -> None:
        super().__init__(message, provider="Azure DevOps")


class BlazemeterError(ExternalAPIError):
    """BlazeMeter REST API failure."""

    def __init__(self, message: str) -> None:
        super().__init__(message, provider="BlazeMeter")


class AIServiceError(ExternalAPIError):
    """AI provider (Claude / OpenAI) API failure."""

    def __init__(self, message: str, provider: str | None = None) -> None:
        super().__init__(message, provider=provider)


class RateLimitError(ExternalAPIError):
    """HTTP 429 — the external service is throttling our requests.

    Args:
        message:     Human-readable description of the rate-limit event.
        provider:    Name of the external service.
        retry_after: Seconds to wait before retrying (from Retry-After header).
    """

    def __init__(
        self,
        message: str,
        provider: str | None = None,
        retry_after: int = 30,
    ) -> None:
        self.retry_after: int = retry_after
        super().__init__(message, provider=provider)


class AuthenticationError(ExternalAPIError):
    """Invalid or expired API key / credentials for an external service."""

    def __init__(self, message: str, provider: str | None = None) -> None:
        super().__init__(message, provider=provider)


class SchedulerError(AppError):
    """Failure related to APScheduler job management (add, remove, sync)."""
