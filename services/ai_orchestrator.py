"""AI analysis orchestration — data gathering and parallel execution.

Coordinates New Relic + Azure data collection, prompt building, and
parallel AI provider calls.  No Flask dependency — all external data
arrives through injected client instances.
"""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Optional

from exceptions import AIServiceError
from services.ai_base import AIServiceBase
from services.azure_client import AzureLogAnalyticsClient
from services.newrelic_client import NewRelicClient
from services.validation import parse_time_range_to_minutes

logger = logging.getLogger(__name__)


class AIOrchestrator:
    """Orchestrates data collection and parallel AI analysis.

    Single Responsibility: owns the workflow of gathering performance
    data from external sources, building prompts, and dispatching
    analysis to one or more AI providers concurrently.
    """

    # ------------------------------------------------------------------
    # Prompt construction
    # ------------------------------------------------------------------

    @staticmethod
    def build_system_prompt() -> str:
        """Build the system prompt for AI performance analysis.

        Returns:
            The system prompt string defining the analyst role and
            expected report structure.
        """
        return (
            "You are a senior web performance analyst examining monitoring data "
            "for an IIS/.NET e-commerce website. You have deep expertise in:\n"
            "- IIS server configuration and performance tuning\n"
            "- .NET application performance\n"
            "- Core Web Vitals and frontend performance\n"
            "- Database query optimization\n"
            "- CDN and caching strategies\n\n"
            "Analyze the provided performance data and produce a structured report "
            "with these sections:\n\n"
            "## Summary\n"
            "A 2-3 sentence executive summary of the overall health of this URL/page.\n\n"
            "## Key Issues\n"
            "Bullet points identifying the most significant performance problems, "
            "ranked by impact. Reference specific metrics and thresholds.\n\n"
            "## Recommendations\n"
            "Actionable steps to improve performance, ordered by expected impact. "
            "Be specific to IIS/.NET where relevant (e.g., output caching, "
            "connection pooling, async handlers).\n\n"
            "## Anomalies\n"
            "Any unusual patterns, spikes, or inconsistencies in the data that "
            "warrant investigation.\n\n"
            "Use markdown formatting. Be concise but thorough. Reference specific "
            "numbers from the data.\n"
            "Do NOT start your response with a title or header that repeats the URL "
            "— begin directly with the ## Summary section."
        )

    @staticmethod
    def build_user_message(
        url: str,
        time_range: str,
        newrelic_data: dict,
        iis_data: dict,
    ) -> str:
        """Build the user message containing all collected performance data.

        Args:
            url:           The URL path being analysed.
            time_range:    Human-readable time range of the analysis.
            newrelic_data: Combined New Relic metrics (CWV, perf overview, APM).
            iis_data:      IIS log summary data from Azure.

        Returns:
            Formatted markdown string as the AI data payload.
        """
        sections: list[str] = [
            "# Performance Analysis Request",
            f"**URL:** {url}",
            f"**Time Range:** {time_range}",
            "",
        ]

        if newrelic_data.get("core_web_vitals"):
            sections.append("## New Relic: Core Web Vitals")
            sections.append(json.dumps(newrelic_data["core_web_vitals"], indent=2, default=str))
            sections.append("")

        if iis_data.get("slow_requests"):
            sections.append("## IIS Logs: Requests for this URL")
            sections.append(json.dumps(iis_data["slow_requests"], indent=2, default=str))
            sections.append("")

        if not newrelic_data and not iis_data:
            sections.append("*No performance data was available from either source.*")

        return "\n".join(sections)

    # ------------------------------------------------------------------
    # Data gathering
    # ------------------------------------------------------------------

    @staticmethod
    def gather_performance_data(
        url_path: str,
        time_range: str,
        newrelic_client: Optional[NewRelicClient] = None,
        nr_account_id: Optional[int] = None,
        nr_app_name: Optional[str] = None,
        page_url: Optional[str] = None,
        azure_client: Optional[AzureLogAnalyticsClient] = None,
        azure_site_name: Optional[str] = None,
    ) -> tuple[dict, dict]:
        """Collect New Relic CWV and Azure IIS log data for a URL.

        This consolidates the data-gathering logic previously inlined in
        the ``/api/ai/analyze`` route handler (app.py:904-968).

        Args:
            url_path:        The URL path being analysed.
            time_range:      NRQL-style time range string.
            newrelic_client: Optional pre-configured New Relic client.
            nr_account_id:   New Relic account id (required with *newrelic_client*).
            nr_app_name:     New Relic app name (required with *newrelic_client*).
            page_url:        Full page URL for CWV queries.
            azure_client:    Optional pre-configured Azure client.
            azure_site_name: Optional IIS site name filter.

        Returns:
            Tuple of ``(newrelic_data, iis_data)`` dicts.  Either or
            both may be empty if the corresponding client is ``None``
            or the queries fail.
        """
        newrelic_data: dict = {}
        iis_data: dict = {}

        # ---- New Relic CWV ----
        if newrelic_client and nr_account_id and nr_app_name and page_url:
            try:
                cwv_result = newrelic_client.get_core_web_vitals(
                    account_id=nr_account_id,
                    app_name=nr_app_name,
                    page_url=page_url,
                    time_range=time_range,
                )
                if cwv_result.get("success"):
                    newrelic_data["core_web_vitals"] = cwv_result.get("metrics", {})
            except Exception as exc:
                logger.warning("Error gathering New Relic data: %s", exc)

        # ---- Azure IIS logs ----
        if azure_client:
            try:
                now = datetime.utcnow()
                minutes = parse_time_range_to_minutes(time_range)
                start_date = (now - timedelta(minutes=minutes)).isoformat() + "Z"
                end_date = now.isoformat() + "Z"

                slow_result = azure_client.search_logs(
                    start_date=start_date,
                    end_date=end_date,
                    url_filter=url_path,
                    site_name=azure_site_name,
                    limit=20,
                    exact_url=True,
                )
                if isinstance(slow_result, dict) and slow_result.get("success"):
                    iis_data["slow_requests"] = slow_result.get("logs", [])
            except Exception as exc:
                logger.warning("Error gathering IIS log data: %s", exc)

        return newrelic_data, iis_data

    # ------------------------------------------------------------------
    # Parallel AI execution
    # ------------------------------------------------------------------

    @staticmethod
    def run_analysis(
        claude_client: Optional[AIServiceBase],
        openai_client: Optional[AIServiceBase],
        system_prompt: str,
        user_message: str,
    ) -> dict:
        """Run analysis in parallel across available providers.

        Args:
            claude_client: Claude AI client (or ``None`` to skip).
            openai_client: OpenAI client (or ``None`` to skip).
            system_prompt: The shared system prompt for both models.
            user_message:  The formatted data payload.

        Returns:
            Dict with ``claude`` and ``openai`` keys, each containing
            the provider result dict or ``None``.
        """
        results: dict = {"claude": None, "openai": None}
        futures: dict = {}

        with ThreadPoolExecutor(max_workers=2) as executor:
            if claude_client:
                futures[executor.submit(claude_client.analyze, system_prompt, user_message)] = "claude"
            if openai_client:
                futures[executor.submit(openai_client.analyze, system_prompt, user_message)] = "openai"

            for future in as_completed(futures):
                provider = futures[future]
                try:
                    results[provider] = future.result()
                except Exception as exc:
                    results[provider] = {"error": f"Unexpected error from {provider}: {exc}"}

        return results

    @staticmethod
    def run_followup(
        claude_client: Optional[AIServiceBase],
        openai_client: Optional[AIServiceBase],
        system_prompt: str,
        claude_messages: Optional[list[dict]],
        openai_messages: Optional[list[dict]],
    ) -> dict:
        """Run follow-up analysis in parallel for both providers.

        Args:
            claude_client:   Claude AI client (or ``None``).
            openai_client:   OpenAI client (or ``None``).
            system_prompt:   The shared system prompt.
            claude_messages:  Conversation history for Claude.
            openai_messages:  Conversation history for OpenAI.

        Returns:
            Dict with ``claude`` and ``openai`` keys.
        """
        results: dict = {"claude": None, "openai": None}
        futures: dict = {}

        with ThreadPoolExecutor(max_workers=2) as executor:
            if claude_client and claude_messages:
                futures[executor.submit(claude_client.follow_up, system_prompt, claude_messages)] = "claude"
            if openai_client and openai_messages:
                futures[executor.submit(openai_client.follow_up, system_prompt, openai_messages)] = "openai"

            for future in as_completed(futures):
                provider = futures[future]
                try:
                    results[provider] = future.result()
                except Exception as exc:
                    results[provider] = {"error": f"Unexpected error from {provider}: {exc}"}

        return results
