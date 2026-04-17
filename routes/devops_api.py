"""Azure DevOps Pipelines API blueprint.

Clients are constructed per-request from credentials in the request body
(stored client-side in localStorage).  No injected dependencies needed.
"""

from flask import Blueprint, Response, jsonify, request

from services.devops_client import AzureDevOpsClient
from services.validation import validate_required_fields

_DEVOPS_CRED_FIELDS = ["pat"]


def create_devops_blueprint() -> Blueprint:
    """Factory that creates the Azure DevOps API blueprint.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("devops_api", __name__)

    def _make_client(data: dict) -> AzureDevOpsClient:
        """Build an AzureDevOpsClient from request-body credentials."""
        return AzureDevOpsClient(
            pat=data["pat"],
            organization=data.get("organization", "LampsPlus"),
            project=data.get("project", "TestAutomation"),
        )

    @bp.route("/api/devops/test-connection", methods=["POST"])
    def test_connection():
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        return jsonify(client.test_connection())

    @bp.route("/api/devops/pipelines", methods=["POST"])
    def list_pipelines():
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        pipelines = client.list_pipelines()
        return jsonify({"success": True, "pipelines": pipelines})

    @bp.route("/api/devops/builds", methods=["POST"])
    def list_builds():
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        definition_ids = data.get("definition_ids")
        top = data.get("top", 20)
        builds = client.list_builds(definition_ids=definition_ids, top=top)
        return jsonify({"success": True, "builds": builds})

    @bp.route("/api/devops/builds/<int:build_id>", methods=["POST"])
    def get_build(build_id: int):
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        build = client.get_build(build_id)
        return jsonify({"success": True, "build": build})

    @bp.route("/api/devops/builds/<int:build_id>/cancel", methods=["POST"])
    def cancel_build(build_id: int):
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        build = client.cancel_build(build_id)
        return jsonify({"success": True, "build": build})

    @bp.route("/api/devops/effective-status/<int:build_id>", methods=["POST"])
    def effective_status(build_id: int):
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        result = client.get_effective_status(build_id)
        return jsonify({"success": True, **result})

    @bp.route("/api/devops/failed-tests/<int:build_id>", methods=["POST"])
    def failed_tests(build_id: int):
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        tests = client.get_failed_tests(build_id)
        return jsonify({"success": True, "failedTests": tests})

    @bp.route("/api/devops/skipped-tests/<int:build_id>", methods=["POST"])
    def skipped_tests(build_id: int):
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        tests = client.get_skipped_tests(build_id)
        return jsonify({"success": True, "skippedTests": tests})

    @bp.route(
        "/api/devops/test-screenshot/<int:run_id>/<int:result_id>/<int:attachment_id>",
        methods=["POST"],
    )
    def test_screenshot(run_id: int, result_id: int, attachment_id: int):
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        try:
            content = client.get_attachment_content(run_id, result_id, attachment_id)
            return Response(content, mimetype="image/png")
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500

    @bp.route("/api/devops/branches", methods=["POST"])
    def list_branches():
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
        client = _make_client(data)
        branches = client.list_branches()
        return jsonify({"success": True, "branches": branches})

    @bp.route("/api/devops/trigger/<int:pipeline_id>", methods=["POST"])
    def trigger_pipeline(pipeline_id: int):
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS)
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
        data = request.get_json()
        validate_required_fields(data, _DEVOPS_CRED_FIELDS + ["pipeline_id"])
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
