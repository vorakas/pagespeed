"""Azure DevOps Pipelines API blueprint.

Credentials are sourced in this priority order:

1. Server env vars (``DEVOPS_PAT`` / ``DEVOPS_ORGANIZATION`` / ``DEVOPS_PROJECT``).
   When ``DEVOPS_PAT`` is set, every request uses it — the per-request body
   PAT is ignored entirely so a stale localStorage value can't override the
   shared bot account.
2. Request body (``pat`` / ``organization`` / ``project``). Used as a
   local-dev fallback when ``DEVOPS_PAT`` isn't set on the server.

The non-secret server defaults (org, project, orchestrator pipeline id,
pipeline map) are exposed via ``GET /api/devops/server-config`` so the
frontend can hide the config panel and auto-connect on page load.
"""

from typing import Optional

from flask import Blueprint, Response, jsonify, request

from services.devops_client import AzureDevOpsClient
from services.validation import validate_required_fields


def create_devops_blueprint(
    *,
    server_pat: Optional[str] = None,
    server_organization: str = "LampsPlus",
    server_project: str = "TestAutomation",
    server_orchestrator_pipeline_id: Optional[int] = None,
    server_pipeline_map: Optional[dict] = None,
) -> Blueprint:
    """Factory that creates the Azure DevOps API blueprint.

    Args:
        server_pat: Azure DevOps PAT loaded from env. When provided, every
            request uses it — body credentials are ignored.
        server_organization / server_project: Tenant defaults; body values
            override only when ``server_pat`` is unset (i.e. local dev).
        server_orchestrator_pipeline_id / server_pipeline_map: Non-secret
            defaults surfaced by the server-config endpoint.
    """
    bp = Blueprint("devops_api", __name__)
    pipeline_map = dict(server_pipeline_map or {})

    def _make_client(data: dict) -> AzureDevOpsClient:
        """Build an ``AzureDevOpsClient``, preferring server env over body."""
        if server_pat:
            return AzureDevOpsClient(
                pat=server_pat,
                organization=server_organization,
                project=server_project,
            )
        return AzureDevOpsClient(
            pat=data["pat"],
            organization=data.get("organization", server_organization),
            project=data.get("project", server_project),
        )

    def _validate_body(data: dict, extra: Optional[list] = None) -> None:
        """Require ``pat`` only when the server has no env-configured PAT."""
        required = list(extra or [])
        if not server_pat:
            required.insert(0, "pat")
        if required:
            validate_required_fields(data, required)

    @bp.route("/api/devops/server-config", methods=["GET"])
    def server_config():
        """Report whether server-side credentials are configured.

        Never returns the PAT itself — only flags + non-secret defaults so
        the frontend can pre-fill the org/project/pipeline-map fields and
        skip the credentials panel entirely when ``managed`` is true.
        """
        return jsonify({
            "managed": bool(server_pat),
            "organization": server_organization,
            "project": server_project,
            "orchestratorPipelineId": server_orchestrator_pipeline_id,
            "pipelineMap": pipeline_map,
        })

    @bp.route("/api/devops/test-connection", methods=["POST"])
    def test_connection():
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        return jsonify(client.test_connection())

    @bp.route("/api/devops/pipelines", methods=["POST"])
    def list_pipelines():
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        pipelines = client.list_pipelines()
        return jsonify({"success": True, "pipelines": pipelines})

    @bp.route("/api/devops/builds", methods=["POST"])
    def list_builds():
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        definition_ids = data.get("definition_ids")
        top = data.get("top", 20)
        builds = client.list_builds(definition_ids=definition_ids, top=top)
        return jsonify({"success": True, "builds": builds})

    @bp.route("/api/devops/builds/recent-by-definition", methods=["POST"])
    def recent_builds_by_definition():
        data = request.get_json() or {}
        _validate_body(data, extra=["definition_ids"])
        client = _make_client(data)
        definition_ids = data.get("definition_ids") or []
        per_definition = data.get("per_definition", 5)
        builds_by_definition = client.list_recent_builds_by_definition(
            definition_ids=definition_ids,
            per_definition=per_definition,
        )
        return jsonify({"success": True, "buildsByDefinition": builds_by_definition})

    @bp.route("/api/devops/builds/<int:build_id>", methods=["POST"])
    def get_build(build_id: int):
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        build = client.get_build(build_id)
        return jsonify({"success": True, "build": build})

    @bp.route("/api/devops/builds/<int:build_id>/cancel", methods=["POST"])
    def cancel_build(build_id: int):
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        build = client.cancel_build(build_id)
        return jsonify({"success": True, "build": build})

    @bp.route("/api/devops/effective-status/<int:build_id>", methods=["POST"])
    def effective_status(build_id: int):
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        result = client.get_effective_status(build_id)
        return jsonify({"success": True, **result})

    @bp.route("/api/devops/failed-tests/<int:build_id>", methods=["POST"])
    def failed_tests(build_id: int):
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        tests = client.get_failed_tests(build_id)
        return jsonify({"success": True, "failedTests": tests})

    @bp.route("/api/devops/skipped-tests/<int:build_id>", methods=["POST"])
    def skipped_tests(build_id: int):
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        tests = client.get_skipped_tests(build_id)
        return jsonify({"success": True, "skippedTests": tests})

    @bp.route(
        "/api/devops/test-screenshot-metadata/<int:run_id>/<int:result_id>",
        methods=["POST"],
    )
    def test_screenshot_metadata(run_id: int, result_id: int):
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        screenshot_id = client.get_screenshot_attachment_id(run_id, result_id)
        return jsonify({"success": True, "screenshotId": screenshot_id})

    @bp.route(
        "/api/devops/test-screenshot/<int:run_id>/<int:result_id>/<int:attachment_id>",
        methods=["POST"],
    )
    def test_screenshot(run_id: int, result_id: int, attachment_id: int):
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        try:
            content = client.get_attachment_content(run_id, result_id, attachment_id)
            return Response(content, mimetype="image/png")
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500

    @bp.route("/api/devops/branches", methods=["POST"])
    def list_branches():
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        branches = client.list_branches()
        return jsonify({"success": True, "branches": branches})

    @bp.route("/api/devops/trigger/<int:pipeline_id>", methods=["POST"])
    def trigger_pipeline(pipeline_id: int):
        data = request.get_json() or {}
        _validate_body(data)
        client = _make_client(data)
        branch = data.get("branch", "refs/heads/master")
        template_parameters = data.get("template_parameters", {})
        variables = data.get("variables", {})
        build = client.trigger_pipeline(
            definition_id=pipeline_id,
            source_branch=branch,
            template_parameters=template_parameters or None,
            variables=variables or None,
        )
        return jsonify({"success": True, "build": build})

    @bp.route("/api/devops/trigger-orchestrator", methods=["POST"])
    def trigger_orchestrator():
        data = request.get_json() or {}
        _validate_body(data, extra=["pipeline_id"])
        client = _make_client(data)
        template_parameters = data.get("template_parameters", {})
        branch = data.get("branch", "refs/heads/master")
        build = client.trigger_orchestrator(
            definition_id=data["pipeline_id"],
            template_parameters=template_parameters,
            source_branch=branch,
        )
        return jsonify({"success": True, "build": build})

    return bp
