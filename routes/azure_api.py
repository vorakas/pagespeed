"""Azure Log Analytics API blueprint.

Clients are constructed per-request from credentials in the request body
(stored client-side in localStorage).  No injected dependencies needed.
"""

from flask import Blueprint, jsonify, request

from services.azure_client import AzureLogAnalyticsClient
from services.validation import validate_required_fields

_AZURE_CRED_FIELDS = ["tenant_id", "client_id", "client_secret", "workspace_id"]


def create_azure_blueprint() -> Blueprint:
    """Factory that creates the Azure API blueprint.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("azure_api", __name__)

    def _make_client(data: dict) -> AzureLogAnalyticsClient:
        """Build an AzureLogAnalyticsClient from request-body credentials."""
        return AzureLogAnalyticsClient(
            tenant_id=data["tenant_id"],
            client_id=data["client_id"],
            client_secret=data["client_secret"],
            workspace_id=data["workspace_id"],
        )

    @bp.route("/api/azure/test-connection", methods=["POST"])
    def test_connection():
        data = request.get_json()
        validate_required_fields(data, _AZURE_CRED_FIELDS)
        client = _make_client(data)
        return jsonify(client.test_connection())

    @bp.route("/api/azure/search-logs", methods=["POST"])
    def search_logs():
        data = request.get_json()
        validate_required_fields(data, _AZURE_CRED_FIELDS + ["start_date", "end_date"])
        client = _make_client(data)
        result = client.search_logs(
            start_date=data["start_date"],
            end_date=data["end_date"],
            url_filter=data.get("url_filter"),
            status_code=data.get("status_code"),
            site_name=data.get("site_name"),
            limit=data.get("limit", 100),
            exact_url=True,
        )
        return jsonify(result)

    @bp.route("/api/azure/dashboard-summary", methods=["POST"])
    def dashboard_summary():
        data = request.get_json()
        validate_required_fields(data, _AZURE_CRED_FIELDS + ["start_date", "end_date"])
        client = _make_client(data)
        result = client.get_dashboard_summary(
            start_date=data["start_date"],
            end_date=data["end_date"],
            site_name=data.get("site_name"),
        )
        return jsonify(result)

    @bp.route("/api/azure/list-sites", methods=["POST"])
    def list_sites():
        data = request.get_json()
        validate_required_fields(data, _AZURE_CRED_FIELDS)
        client = _make_client(data)

        query = "W3CIISLog | distinct sSiteName | order by sSiteName asc"
        response = client.execute_query(query, timespan="P7D")
        rows = client.parse_table_response(response)
        sites = [row.get("sSiteName", "") for row in rows if row.get("sSiteName")]

        return jsonify({"success": True, "sites": sites})

    @bp.route("/api/azure/execute-query", methods=["POST"])
    def execute_query():
        data = request.get_json()
        validate_required_fields(data, _AZURE_CRED_FIELDS + ["query"])

        query = data["query"].strip()
        if not query:
            return jsonify({"success": False, "error": "Query cannot be empty"}), 400

        client = _make_client(data)
        response = client.execute_query(query, timespan=data.get("timespan"))
        rows = client.parse_table_response(response)

        columns = []
        tables = response.get("tables", [])
        if tables:
            columns = [col["name"] for col in tables[0].get("columns", [])]

        return jsonify({
            "success": True,
            "columns": columns,
            "rows": rows,
            "count": len(rows),
            "raw": response,
        })

    return bp
