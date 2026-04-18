"""BlazeMeter API blueprint.

Credentials live in server-side env vars (``BLAZEMETER_API_KEY_ID`` /
``BLAZEMETER_API_SECRET`` / ``BLAZEMETER_WORKSPACE_ID`` /
``BLAZEMETER_PROJECT_ID``) and are never returned to the client — a
deliberate departure from the New Relic/Azure/DevOps integrations that
use per-user localStorage keys.
"""

from __future__ import annotations

from typing import Optional

from flask import Blueprint, jsonify, request

from config import (
    BLAZEMETER_API_KEY_ID,
    BLAZEMETER_API_SECRET,
    BLAZEMETER_PROJECT_ID,  # optional — becomes the UI's default selected project
    BLAZEMETER_WORKSPACE_ID,
)
from exceptions import AuthenticationError, ValidationError
from services.blazemeter_client import BlazemeterClient
from services.blazemeter_queue import BlazemeterQueueService


def create_blazemeter_blueprint(
    queue_service: Optional[BlazemeterQueueService],
    client: Optional[BlazemeterClient],
) -> Blueprint:
    """Factory that creates the BlazeMeter API blueprint.

    Args:
        queue_service: Shared queue service (``None`` when BlazeMeter is not
                       configured — endpoints will return a configured=False
                       status instead of 500-ing).
        client:        Shared BlazeMeter client; ``None`` when unconfigured.
    """
    bp = Blueprint("blazemeter_api", __name__)

    def _require_configured() -> BlazemeterClient:
        if client is None or queue_service is None:
            raise AuthenticationError(
                "BlazeMeter is not configured on the server",
                provider="BlazeMeter",
            )
        return client

    @bp.route("/api/blazemeter/config-status", methods=["GET"])
    def config_status():
        """Report whether BlazeMeter env vars are set (never reveals secrets)."""
        configured = bool(BLAZEMETER_API_KEY_ID and BLAZEMETER_API_SECRET)
        masked = None
        if BLAZEMETER_API_KEY_ID:
            masked = BLAZEMETER_API_KEY_ID[:4] + "…" + BLAZEMETER_API_KEY_ID[-4:] if len(BLAZEMETER_API_KEY_ID) > 8 else "****"
        return jsonify({
            "configured": configured,
            "apiKeyIdMasked": masked,
            "workspaceId": BLAZEMETER_WORKSPACE_ID,
            "defaultProjectId": BLAZEMETER_PROJECT_ID,
        })

    @bp.route("/api/blazemeter/test-connection", methods=["POST"])
    def test_connection():
        cli = _require_configured()
        return jsonify(cli.test_connection())

    @bp.route("/api/blazemeter/projects", methods=["GET"])
    def list_projects():
        cli = _require_configured()
        projects = cli.list_projects()
        return jsonify({"success": True, "projects": projects})

    @bp.route("/api/blazemeter/tests", methods=["GET"])
    def list_tests():
        cli = _require_configured()
        limit = int(request.args.get("limit", 200))
        project_id = request.args.get("projectId") or None
        tests = cli.list_tests(project_id=project_id, limit=limit)
        return jsonify({"success": True, "tests": tests})

    @bp.route("/api/blazemeter/queue", methods=["GET"])
    def get_queue():
        if queue_service is None:
            return jsonify({
                "active": None,
                "pending": [],
                "history": [],
                "configured": False,
            })
        snap = queue_service.snapshot()
        snap["configured"] = True
        return jsonify(snap)

    @bp.route("/api/blazemeter/queue", methods=["POST"])
    def enqueue():
        _require_configured()
        data = request.get_json() or {}
        test_id = data.get("testId")
        test_name = data.get("testName") or f"Test {test_id}"
        project_id = data.get("projectId")
        project_name = data.get("projectName")
        if not test_id:
            raise ValidationError("Missing required field: testId")
        item = queue_service.enqueue(  # type: ignore[union-attr]
            int(test_id),
            str(test_name),
            project_id=int(project_id) if project_id else None,
            project_name=str(project_name) if project_name else None,
        )
        return jsonify({"success": True, "item": item.to_dict()})

    @bp.route("/api/blazemeter/queue/<int:item_id>", methods=["DELETE"])
    def remove_queue_item(item_id: int):
        _require_configured()
        removed = queue_service.remove_pending(item_id)  # type: ignore[union-attr]
        return jsonify({"success": removed})

    @bp.route("/api/blazemeter/queue/clear", methods=["POST"])
    def clear_queue():
        _require_configured()
        removed = queue_service.clear_pending()  # type: ignore[union-attr]
        return jsonify({"success": True, "removed": removed})

    @bp.route("/api/blazemeter/queue/cancel-active", methods=["POST"])
    def cancel_active():
        _require_configured()
        cancelled = queue_service.cancel_active()  # type: ignore[union-attr]
        return jsonify({"success": cancelled})

    return bp
