"""New Relic NerdGraph API blueprint.

Clients are constructed per-request from credentials in the request body
(stored client-side in localStorage).  No injected dependencies needed.
"""

from flask import Blueprint, jsonify, request

from services.newrelic_client import NewRelicClient
from services.validation import validate_required_fields


def create_newrelic_blueprint() -> Blueprint:
    """Factory that creates the New Relic API blueprint.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("newrelic_api", __name__)

    def _make_client(data: dict) -> NewRelicClient:
        """Build a NewRelicClient from request-body credentials."""
        return NewRelicClient(api_key=data["api_key"])

    @bp.route("/api/newrelic/test-connection", methods=["POST"])
    def test_connection():
        data = request.get_json()
        validate_required_fields(data, ["api_key"])
        client = _make_client(data)
        return jsonify(client.test_connection())

    @bp.route("/api/newrelic/core-web-vitals", methods=["POST"])
    def core_web_vitals():
        data = request.get_json()
        validate_required_fields(data, ["api_key", "account_id", "app_name", "page_url"])
        client = _make_client(data)
        result = client.get_core_web_vitals(
            account_id=data["account_id"],
            app_name=data["app_name"],
            page_url=data["page_url"],
            time_range=data.get("time_range", "30 minutes ago"),
        )
        return jsonify(result)

    @bp.route("/api/newrelic/performance-overview", methods=["POST"])
    def performance_overview():
        data = request.get_json()
        validate_required_fields(data, ["api_key", "account_id", "app_name"])
        client = _make_client(data)
        result = client.get_performance_overview(
            account_id=data["account_id"],
            app_name=data["app_name"],
            time_range=data.get("time_range", "30 minutes ago"),
        )
        return jsonify(result)

    @bp.route("/api/newrelic/apm-metrics", methods=["POST"])
    def apm_metrics():
        data = request.get_json()
        validate_required_fields(data, ["api_key", "account_id", "app_name"])
        client = _make_client(data)
        result = client.get_apm_metrics(
            account_id=data["account_id"],
            app_name=data["app_name"],
            time_range=data.get("time_range", "30 minutes ago"),
        )
        return jsonify(result)

    @bp.route("/api/newrelic/custom-query", methods=["POST"])
    def custom_query():
        data = request.get_json()
        validate_required_fields(data, ["api_key", "query"])
        client = _make_client(data)
        result = client.execute_query(data["query"])
        return jsonify({"success": True, "data": result})

    return bp
