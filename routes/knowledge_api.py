"""Knowledge Ledger API blueprint."""

from flask import Blueprint, jsonify, request

from exceptions import ValidationError
from services.knowledge_service import KnowledgeService


def create_knowledge_blueprint(knowledge_service: KnowledgeService) -> Blueprint:
    """Create the Knowledge Ledger API blueprint."""
    bp = Blueprint("knowledge_api", __name__, url_prefix="/api/knowledge")

    @bp.route("/domains", methods=["GET"])
    def list_domains():
        return jsonify(
            knowledge_service.list_domains(
                include_archived=_include_archived(),
            )
        )

    @bp.route("/domains", methods=["POST"])
    def create_domain():
        data = request.get_json(silent=True) or {}
        domain = knowledge_service.create_domain(
            data.get("name", ""),
            data.get("description", ""),
        )
        return jsonify(domain), 201

    @bp.route("/domains/<int:domain_id>", methods=["PUT"])
    def update_domain(domain_id: int):
        data = request.get_json(silent=True) or {}
        return jsonify(
            knowledge_service.update_domain(
                domain_id,
                data.get("name", ""),
                data.get("description", ""),
            )
        )

    @bp.route("/domains/<int:domain_id>/archive", methods=["POST"])
    def archive_domain(domain_id: int):
        return jsonify(knowledge_service.archive_domain(domain_id))

    @bp.route("/entries", methods=["GET"])
    def search_entries():
        return jsonify(
            knowledge_service.search_entries(
                query=request.args.get("query", ""),
                domain_id=_domain_id_arg(),
                entry_type=request.args.get("entry_type"),
                status=request.args.get("status"),
                tag=request.args.get("tag"),
                include_archived=_include_archived(),
                include_archived_domains=_include_archived_domains(),
            )
        )

    @bp.route("/entries", methods=["POST"])
    def create_entry():
        data = request.get_json(silent=True) or {}
        return jsonify(knowledge_service.create_entry(data)), 201

    @bp.route("/entries/<int:entry_id>", methods=["GET"])
    def get_entry(entry_id: int):
        return jsonify(knowledge_service.get_entry(entry_id))

    @bp.route("/entries/<int:entry_id>", methods=["PUT"])
    def update_entry(entry_id: int):
        data = request.get_json(silent=True) or {}
        return jsonify(knowledge_service.update_entry(entry_id, data))

    @bp.route("/entries/<int:entry_id>/archive", methods=["POST"])
    def archive_entry(entry_id: int):
        return jsonify(knowledge_service.archive_entry(entry_id))

    return bp


def _include_archived() -> bool:
    return request.args.get("include_archived", "").lower() == "true"


def _include_archived_domains() -> bool:
    return request.args.get("include_archived_domains", "").lower() == "true"


def _domain_id_arg() -> int | None:
    domain_id = request.args.get("domain_id")
    if domain_id in (None, ""):
        return None

    try:
        return int(domain_id)
    except ValueError as exc:
        raise ValidationError("domain_id must be an integer") from exc
