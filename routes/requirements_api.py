"""Requirement Questions API."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.requirement_kb_service import RequirementKbService


def create_requirements_blueprint(requirement_service: RequirementKbService) -> Blueprint:
    bp = Blueprint("requirements_api", __name__, url_prefix="/api/requirements")

    @bp.get("/knowledge-bases")
    def list_knowledge_bases():
        return jsonify(requirement_service.list_knowledge_bases())

    @bp.post("/knowledge-bases")
    def create_knowledge_base():
        data = request.get_json() or {}
        kb = requirement_service.create_knowledge_base_from_candidates(
            name=data.get("name", ""),
            description=data.get("description", ""),
            search_terms=data.get("searchTerms", []),
            candidates=data.get("candidates", []),
        )
        return jsonify(kb), 201

    @bp.post("/seed/calculator")
    def seed_calculator():
        return jsonify(requirement_service.ensure_calculator_seed())

    @bp.post("/discover")
    def discover_candidates():
        data = request.get_json() or {}
        terms = data.get("terms") or []
        if isinstance(terms, str):
            terms = [term.strip() for term in terms.split(",") if term.strip()]
        limit = int(data.get("limit", 50))
        return jsonify(requirement_service.discover_candidates(terms, limit=limit))

    @bp.get("/knowledge-bases/<int:kb_id>/sources")
    def list_sources(kb_id: int):
        return jsonify(requirement_service.list_sources(kb_id))

    @bp.get("/knowledge-bases/<int:kb_id>/common-questions")
    def list_common_questions(kb_id: int):
        return jsonify(requirement_service.list_common_questions(kb_id))

    @bp.post("/knowledge-bases/<int:kb_id>/sources/tasks")
    def add_task_source(kb_id: int):
        data = request.get_json() or {}
        return jsonify(requirement_service.add_vault_source(kb_id, data.get("sourcePath", ""))), 201

    @bp.delete("/knowledge-bases/<int:kb_id>/sources/<int:source_id>")
    def remove_source(kb_id: int, source_id: int):
        return jsonify(requirement_service.remove_source(kb_id, source_id))

    @bp.post("/knowledge-bases/<int:kb_id>/notes")
    def add_note(kb_id: int):
        data = request.get_json() or {}
        return jsonify(
            requirement_service.add_note(
                kb_id,
                title=data.get("title", ""),
                body=data.get("body", ""),
                category=data.get("category", "requirement"),
                tags=data.get("tags", []),
                source_link=data.get("sourceLink", ""),
            )
        ), 201

    @bp.post("/knowledge-bases/<int:kb_id>/uploads")
    def upload_source(kb_id: int):
        files = request.files.getlist("files")
        title = request.form.get("title", "")
        uploaded = []
        for file_storage in files:
            uploaded.append(
                requirement_service.ingest_uploaded_file(
                    kb_id,
                    file_storage.filename or "upload",
                    file_storage.read(),
                    title=title,
                )
            )
        return jsonify(uploaded), 201

    @bp.post("/knowledge-bases/<int:kb_id>/questions")
    def ask_question(kb_id: int):
        data = request.get_json() or {}
        return jsonify(requirement_service.ask_question(kb_id, data.get("question", "")))

    return bp
