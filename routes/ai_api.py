"""AI analysis blueprint.

Thin route layer — extracts parameters, constructs per-request AI
clients from credentials in the request body, and delegates to the
AIOrchestrator for data gathering and parallel analysis.
"""

from flask import Blueprint, jsonify, request

from exceptions import ValidationError
from services.ai_claude import ClaudeClient
from services.ai_openai import OpenAIClient
from services.ai_orchestrator import AIOrchestrator
from services.azure_client import AzureLogAnalyticsClient
from services.newrelic_client import NewRelicClient
from services.validation import validate_required_fields


def create_ai_blueprint() -> Blueprint:
    """Factory that creates the AI analysis API blueprint.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("ai_api", __name__)

    @bp.route("/api/ai/analyze", methods=["POST"])
    def analyze():
        data = request.get_json()
        url_path = data.get("url")
        if not url_path:
            raise ValidationError("URL path is required")

        providers = data.get("providers", [])
        if not providers:
            raise ValidationError("At least one AI provider must be selected")

        time_range = data.get("time_range", "1 hour ago")

        # Build optional New Relic client from request credentials
        nr_client = None
        nr_api_key = data.get("nr_api_key")
        nr_account_id = data.get("nr_account_id")
        nr_app_name = data.get("nr_app_name")
        if nr_api_key and nr_account_id and nr_app_name:
            nr_client = NewRelicClient(api_key=nr_api_key)

        # Build optional Azure client from request credentials
        az_client = None
        az_tenant = data.get("azure_tenant_id")
        az_client_id = data.get("azure_client_id")
        az_secret = data.get("azure_client_secret")
        az_workspace = data.get("azure_workspace_id")
        if az_tenant and az_client_id and az_secret and az_workspace:
            az_client = AzureLogAnalyticsClient(
                tenant_id=az_tenant,
                client_id=az_client_id,
                client_secret=az_secret,
                workspace_id=az_workspace,
            )

        # Gather performance data
        newrelic_data, iis_data = AIOrchestrator.gather_performance_data(
            url_path=url_path,
            time_range=time_range,
            newrelic_client=nr_client,
            nr_account_id=int(nr_account_id) if nr_account_id else None,
            nr_app_name=nr_app_name,
            page_url=data.get("page_url"),
            azure_client=az_client,
            azure_site_name=data.get("azure_site_name"),
        )

        if not newrelic_data and not iis_data:
            raise ValidationError(
                "No data could be retrieved. Check that New Relic and/or "
                "Azure credentials are configured on their respective pages."
            )

        # Build prompts and run parallel AI analysis
        system_prompt = AIOrchestrator.build_system_prompt()
        user_message = AIOrchestrator.build_user_message(
            url_path, time_range, newrelic_data, iis_data,
        )

        claude_svc = None
        openai_svc = None

        if "claude" in providers and data.get("claude_api_key"):
            claude_svc = ClaudeClient(
                api_key=data["claude_api_key"],
                model=data.get("claude_model", "claude-sonnet-4-20250514"),
            )
        if "openai" in providers and data.get("openai_api_key"):
            openai_svc = OpenAIClient(
                api_key=data["openai_api_key"],
                model=data.get("openai_model", "gpt-4o"),
            )

        ai_results = AIOrchestrator.run_analysis(
            claude_svc, openai_svc, system_prompt, user_message,
        )

        return jsonify({
            "success": True,
            "claude": ai_results.get("claude"),
            "openai": ai_results.get("openai"),
            "data_sources": {
                "newrelic": bool(newrelic_data),
                "iis_logs": bool(iis_data),
            },
            "system_prompt": system_prompt,
            "user_message": user_message,
            "prompt_preview": user_message,
        })

    @bp.route("/api/ai/follow-up", methods=["POST"])
    def follow_up():
        data = request.get_json()
        providers = data.get("providers", [])
        system_prompt = data.get("system_prompt", "")

        if not providers:
            raise ValidationError("At least one AI provider must be selected")
        if not system_prompt:
            raise ValidationError("System prompt is required")

        claude_svc = None
        openai_svc = None
        claude_messages = data.get("claude_history")
        openai_messages = data.get("openai_history")

        if "claude" in providers and data.get("claude_api_key") and claude_messages:
            claude_svc = ClaudeClient(
                api_key=data["claude_api_key"],
                model=data.get("claude_model", "claude-sonnet-4-20250514"),
            )
        if "openai" in providers and data.get("openai_api_key") and openai_messages:
            openai_svc = OpenAIClient(
                api_key=data["openai_api_key"],
                model=data.get("openai_model", "gpt-4o"),
            )

        if not claude_svc and not openai_svc:
            raise ValidationError("No valid provider configuration found")

        ai_results = AIOrchestrator.run_followup(
            claude_svc, openai_svc, system_prompt,
            claude_messages, openai_messages,
        )

        return jsonify({
            "success": True,
            "claude": ai_results.get("claude"),
            "openai": ai_results.get("openai"),
        })

    return bp
