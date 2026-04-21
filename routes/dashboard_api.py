"""Launch Command Center dashboard API blueprint.

One route per :class:`~services.migration_dashboard_service.MigrationDashboardService`
method. All endpoints are read-only GETs; the service layer handles caching
so the dashboard can poll freely.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.migration_dashboard_service import MigrationDashboardService


def create_dashboard_blueprint(service: MigrationDashboardService) -> Blueprint:
    """Factory wiring the dashboard service into a Flask blueprint."""
    bp = Blueprint("dashboard_api", __name__)

    @bp.route("/api/dashboard/health", methods=["GET"])
    def health():
        if not service.is_available():
            return jsonify({"error": "vault not found", "vaultRoot": str(service.vault_root)}), 404
        return jsonify(service.get_health())

    @bp.route("/api/dashboard/kpis", methods=["GET"])
    def kpis():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_kpis())

    @bp.route("/api/dashboard/sources", methods=["GET"])
    def sources():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_sources())

    @bp.route("/api/dashboard/workstreams", methods=["GET"])
    def workstreams():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_workstreams())

    @bp.route("/api/dashboard/blockers", methods=["GET"])
    def blockers():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_blockers())

    @bp.route("/api/dashboard/production-failures", methods=["GET"])
    def production_failures():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_production_failures())

    @bp.route("/api/dashboard/new-bugs", methods=["GET"])
    def new_bugs():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        window = int(request.args.get("windowDays", "7"))
        return jsonify(service.get_new_bugs(window_days=window))

    @bp.route("/api/dashboard/task-status", methods=["GET"])
    def task_status():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_task_status())

    @bp.route("/api/dashboard/trend", methods=["GET"])
    def trend():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_trend())

    @bp.route("/api/dashboard/teams", methods=["GET"])
    def teams():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_teams())

    @bp.route("/api/dashboard/workstream/<workstream_id>", methods=["GET"])
    def workstream_detail(workstream_id: str):
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        detail = service.get_workstream_detail(workstream_id)
        if detail is None:
            return jsonify({"error": "workstream not found", "id": workstream_id}), 404
        return jsonify(detail)

    @bp.route("/api/dashboard/cache/invalidate", methods=["POST"])
    def invalidate_cache():
        """Force a fresh vault read on the next request.

        Called automatically when an Obsidian sync completes. Can also be
        POSTed manually for debugging.
        """
        service.invalidate_cache()
        return jsonify({"success": True})

    return bp
