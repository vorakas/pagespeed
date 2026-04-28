"""Launch Command Center dashboard API blueprint.

One route per :class:`~services.migration_dashboard_service.MigrationDashboardService`
method. All endpoints are read-only GETs; the service layer handles caching
so the dashboard can poll freely.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.migration_dashboard_service import MigrationDashboardService
from services.snapshot_service import SnapshotService, diff_snapshots


def create_dashboard_blueprint(
    service: MigrationDashboardService,
    snapshot_service: SnapshotService | None = None,
) -> Blueprint:
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

    # ── Snapshots: daily status history + what-changed diff ──────────

    def _require_snapshots():
        if snapshot_service is None:
            return None, (jsonify({"error": "snapshots not configured"}), 503)
        return snapshot_service, None

    @bp.route("/api/dashboard/snapshots", methods=["GET"])
    def snapshots():
        svc, err = _require_snapshots()
        if err:
            return err
        return jsonify(svc.list_snapshots())

    @bp.route("/api/dashboard/snapshots/latest", methods=["GET"])
    def snapshot_latest():
        svc, err = _require_snapshots()
        if err:
            return err
        latest = svc.latest()
        if latest is None:
            return jsonify({"error": "no snapshots ingested yet"}), 404
        return jsonify(latest)

    @bp.route("/api/dashboard/snapshots/diff", methods=["GET"])
    def snapshot_diff():
        """Diff the two most recent snapshots (what-changed-today)."""
        svc, err = _require_snapshots()
        if err:
            return err
        latest = svc.latest()
        previous = svc.previous()
        if latest is None or previous is None:
            return jsonify(
                {
                    "latest": latest,
                    "previous": previous,
                    "diff": None,
                }
            )
        return jsonify(
            {
                "latest": latest,
                "previous": previous,
                "diff": diff_snapshots(previous, latest),
            }
        )

    @bp.route("/api/dashboard/snapshots/history", methods=["GET"])
    def snapshot_history():
        """Full snapshot series with per-day diffs for the History page."""
        svc, err = _require_snapshots()
        if err:
            return err
        return jsonify(svc.diff_series())

    @bp.route("/api/dashboard/snapshots/<date>", methods=["GET"])
    def snapshot_by_date(date: str):
        svc, err = _require_snapshots()
        if err:
            return err
        snap = svc.get(date)
        if snap is None:
            return jsonify({"error": "snapshot not found", "date": date}), 404
        return jsonify(snap)

    @bp.route("/api/dashboard/snapshots/reingest", methods=["POST"])
    def snapshot_reingest():
        svc, err = _require_snapshots()
        if err:
            return err
        dates = svc.ingest_vault()
        return jsonify({"ingested": dates})

    return bp
