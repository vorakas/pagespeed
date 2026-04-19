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
from data_access import BlazemeterPresetRepository, BlazemeterRunRepository
from exceptions import AuthenticationError, ValidationError
from services.blazemeter_client import BlazemeterClient
from services.blazemeter_queue import BlazemeterQueueService


def create_blazemeter_blueprint(
    queue_service: Optional[BlazemeterQueueService],
    client: Optional[BlazemeterClient],
    preset_repo: BlazemeterPresetRepository,
    run_repo: BlazemeterRunRepository,
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

    # ------------------------------------------------------------------
    # Presets — server-side, shared across all users
    # ------------------------------------------------------------------

    @bp.route("/api/blazemeter/presets", methods=["GET"])
    def list_presets():
        presets = preset_repo.get_all()
        return jsonify({"success": True, "presets": presets})

    def _normalise_preset_tests(raw: list) -> list[dict]:
        """Convert the incoming JSON test list into repository input shape.

        Accepts both camelCase (from the React client) and snake_case.
        """
        if not isinstance(raw, list):
            raise ValidationError("tests must be a list")
        out: list[dict] = []
        for t in raw:
            if not isinstance(t, dict):
                continue
            project_id = t.get("projectId") or t.get("project_id")
            project_name = t.get("projectName") or t.get("project_name")
            out.append({
                "test_id": t.get("testId") or t.get("test_id"),
                "test_name": t.get("testName") or t.get("test_name"),
                "project_id": int(project_id) if project_id else None,
                "project_name": project_name,
            })
        return out

    @bp.route("/api/blazemeter/presets", methods=["POST"])
    def create_preset():
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        if not name:
            raise ValidationError("Preset name is required")
        preset = preset_repo.create(
            name=name,
            tests=_normalise_preset_tests(data.get("tests") or []),
            project_id=int(data["projectId"]) if data.get("projectId") else None,
            project_name=data.get("projectName"),
        )
        return jsonify({"success": True, "preset": preset}), 201

    @bp.route("/api/blazemeter/presets/<int:preset_id>", methods=["PUT"])
    def update_preset(preset_id: int):
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        if not name:
            raise ValidationError("Preset name is required")
        preset = preset_repo.update(
            preset_id=preset_id,
            name=name,
            tests=_normalise_preset_tests(data.get("tests") or []),
            project_id=int(data["projectId"]) if data.get("projectId") else None,
            project_name=data.get("projectName"),
        )
        if preset is None:
            return jsonify({"success": False, "error": "Preset not found"}), 404
        return jsonify({"success": True, "preset": preset})

    @bp.route("/api/blazemeter/presets/<int:preset_id>", methods=["DELETE"])
    def delete_preset(preset_id: int):
        removed = preset_repo.delete(preset_id)
        if not removed:
            return jsonify({"success": False, "error": "Preset not found"}), 404
        return jsonify({"success": True})

    @bp.route("/api/blazemeter/runs", methods=["GET"])
    def list_runs():
        """Paginated history of persisted BlazeMeter runs (survives restart)."""
        try:
            limit = int(request.args.get("limit", 50))
            offset = int(request.args.get("offset", 0))
        except (TypeError, ValueError):
            raise ValidationError("limit and offset must be integers")
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        runs = run_repo.list_recent(limit=limit, offset=offset)
        total = run_repo.count()
        return jsonify({
            "success": True,
            "runs": runs,
            "total": total,
            "limit": limit,
            "offset": offset,
        })

    @bp.route("/api/blazemeter/masters/<int:master_id>/report", methods=["GET"])
    def get_master_report(master_id: int):
        """Aggregate every post-test report into one payload.

        Each sub-section is fetched independently and degrades gracefully:
        if BlazeMeter returns an error for one section (e.g. the test had no
        CI gates configured, so ``/ci-status`` 404s), its value is ``None``
        and ``errors[<section>]`` carries the message — the rest still renders.
        """
        _require_configured()
        assert client is not None  # _require_configured guarantees it

        sections: dict[str, object] = {}
        errors: dict[str, str] = {}

        def _safe(section: str, fn):
            try:
                sections[section] = fn()
            except Exception as exc:  # noqa: BLE001 — we want to surface, not raise
                errors[section] = str(exc)
                sections[section] = None

        _safe("master", lambda: client.get_master(master_id))
        _safe("summary", lambda: client.get_master_summary(master_id))
        _safe("aggregate", lambda: client.get_master_aggregate(master_id))
        _safe("timeline", lambda: client.get_master_timeline(master_id))
        _safe("errors", lambda: client.get_master_errors(master_id))
        _safe("ciStatus", lambda: client.get_master_ci_status(master_id))
        _safe("thresholds", lambda: client.get_master_thresholds(master_id))

        return jsonify({
            "success": True,
            "masterId": master_id,
            **sections,
            "fetchErrors": errors,
        })

    @bp.route("/api/blazemeter/presets/<int:preset_id>/queue", methods=["POST"])
    def queue_preset(preset_id: int):
        _require_configured()
        preset = preset_repo.get_by_id(preset_id)
        if preset is None:
            return jsonify({"success": False, "error": "Preset not found"}), 404
        items = []
        # Each test row carries its own project context (tests may come
        # from different projects).  Fall back to the preset-level project
        # for legacy rows written before per-test context was stored.
        for test in preset["tests"]:
            item = queue_service.enqueue(  # type: ignore[union-attr]
                test_id=int(test["test_id"]),
                test_name=str(test["test_name"]),
                project_id=test.get("project_id") or preset.get("project_id"),
                project_name=test.get("project_name") or preset.get("project_name"),
            )
            items.append(item.to_dict())
        return jsonify({"success": True, "queued": len(items), "items": items})

    return bp
