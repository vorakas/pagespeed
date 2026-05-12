"""Requirement Questions API."""

from __future__ import annotations

import io

from flask import Blueprint, jsonify, request, send_file

from services.ai_config_service import AiConfigService
from services.requirement_kb_service import RequirementKbService


def create_requirements_blueprint(
    requirement_service: RequirementKbService,
    ai_config_service: AiConfigService | None = None,
) -> Blueprint:
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

    @bp.get("/ai-usage")
    def ai_usage():
        return jsonify(requirement_service.list_ai_usage_summary())

    @bp.post("/knowledge-bases/<int:kb_id>/sources/tasks")
    def add_task_source(kb_id: int):
        data = request.get_json() or {}
        return jsonify(requirement_service.add_vault_source(kb_id, data.get("sourcePath", ""))), 201

    @bp.delete("/knowledge-bases/<int:kb_id>/sources/<int:source_id>")
    def remove_source(kb_id: int, source_id: int):
        return jsonify(requirement_service.remove_source(kb_id, source_id))

    @bp.get("/knowledge-bases/<int:kb_id>/sources/<int:source_id>/file")
    def get_source_file(kb_id: int, source_id: int):
        source_file = requirement_service.get_source_file(kb_id, source_id)
        return send_file(
            io.BytesIO(source_file["payload"]),
            mimetype=source_file["mimeType"],
            as_attachment=False,
            download_name=source_file["filename"],
        )

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
        ai_options = data.get("ai") or {}
        if ai_config_service is not None and ai_options.get("provider"):
            provider_config = ai_config_service.merge_request_provider(
                ai_options.get("provider", ""),
                ai_options.get("apiKey"),
                ai_options.get("model"),
            )
            ai_options = {
                "provider": provider_config["provider"],
                "apiKey": provider_config["apiKey"],
                "model": provider_config["model"],
            }
        return jsonify(
            requirement_service.ask_question(
                kb_id,
                data.get("question", ""),
                ai_options=ai_options,
                answer_mode=data.get("answerMode") or data.get("answer_mode") or "auto",
            )
        )

    @bp.post("/knowledge-bases/<int:kb_id>/rechunk")
    def rechunk_kb(kb_id: int):
        return jsonify(requirement_service.rechunk_knowledge_base(kb_id))

    return bp
