"""Autofix report ingest + triage API blueprint.

Read/patch endpoints serve from the local DB and need no Azure DevOps
credentials. The refresh endpoint builds an ``AzureDevOpsClient`` using
the server env PAT (falling back to a request-body ``pat`` for local dev,
matching ``devops_api``) and hands it to the ingest service.
"""

from typing import Optional

from flask import Blueprint, jsonify, request

from services.devops_client import AzureDevOpsClient
from services.validation import validate_required_fields

_VALID_STATUSES = {"todo", "applied", "dismissed"}
# Captured when a fix is resolved — how the AI suggestion actually fared
# (used later by the learning loop). "not_a_real_issue" = the suggested fix
# addressed a non-problem.
_VALID_OUTCOMES = {"worked_as_is", "worked_with_edits", "didnt_work", "not_a_real_issue"}


def create_autofix_blueprint(
    *,
    repository,
    ingest_service,
    server_pat: Optional[str] = None,
    server_organization: str = "LampsPlus",
    server_project: str = "TestAutomation",
    autofix_pipeline_ids: Optional[list] = None,
) -> Blueprint:
    """Factory for the autofix API blueprint."""
    bp = Blueprint("autofix_api", __name__)
    default_pipeline_ids = list(autofix_pipeline_ids or [])

    def _make_client(data: dict) -> AzureDevOpsClient:
        if server_pat:
            return AzureDevOpsClient(
                pat=server_pat,
                organization=server_organization,
                project=server_project,
            )
        validate_required_fields(data, ["pat"])
        return AzureDevOpsClient(
            pat=data["pat"],
            organization=data.get("organization", server_organization),
            project=data.get("project", server_project),
        )

    @bp.route("/api/autofix/refresh", methods=["POST"])
    def refresh():
        data = request.get_json() or {}
        definition_ids = data.get("definition_ids") or default_pipeline_ids
        if not definition_ids:
            return jsonify({
                "success": False,
                "error": "No pipeline definition ids configured. Set AUTOFIX_PIPELINE_IDS "
                         "or pass definition_ids in the request body.",
            }), 400
        per_definition = int(data.get("per_definition", 10))
        client = _make_client(data)
        summary = ingest_service.ingest(
            client,
            definition_ids=[int(d) for d in definition_ids],
            per_definition=per_definition,
        )
        return jsonify({"success": True, **summary})

    @bp.route("/api/autofix/builds", methods=["GET"])
    def list_builds():
        builds = repository.get_builds()
        return jsonify({"success": True, "builds": [_camelize(b) for b in builds]})

    @bp.route("/api/autofix/builds/<build_id>/fixes", methods=["GET"])
    def list_fixes(build_id: str):
        fixes = repository.get_fixes(build_id)
        return jsonify({"success": True, "fixes": [_camelize(f) for f in fixes]})

    @bp.route("/api/autofix/corrections", methods=["GET"])
    def list_corrections():
        corrections = repository.get_corrections()
        return jsonify({"success": True,
                        "corrections": [_camelize(c) for c in corrections]})

    @bp.route("/api/autofix/fixes/<build_id>/<fix_id>", methods=["PATCH"])
    def patch_fix(build_id: str, fix_id: str):
        data = request.get_json() or {}
        status = data.get("status")
        outcome = data.get("outcome")
        if status is not None and status not in _VALID_STATUSES:
            return jsonify({"success": False,
                            "error": f"Invalid status: {status}"}), 400
        if outcome is not None and outcome not in _VALID_OUTCOMES:
            return jsonify({"success": False,
                            "error": f"Invalid outcome: {outcome}"}), 400

        updated = repository.patch_fix(
            build_id, fix_id,
            status=status,
            outcome=outcome,
            actual_fix_code=data.get("actual_fix_code"),
            note=data.get("note"),
        )
        # 404 also covers a no-op patch (no fields supplied): for v1 a missing
        # row and an empty update are both "nothing changed".
        if not updated:
            return jsonify({"success": False, "error": "Fix not found or no fields to update."}), 404
        return jsonify({"success": True})

    return bp


def _to_camel(snake: str) -> str:
    """Convert a snake_case key to camelCase (build_id -> buildId)."""
    head, *rest = snake.split("_")
    return head + "".join(word.capitalize() for word in rest)


def _camelize(row: dict) -> dict:
    """Return a copy of a DB row with all keys converted to camelCase."""
    return {_to_camel(key): value for key, value in row.items()}
