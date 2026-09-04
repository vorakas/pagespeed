"""HTTP API for the Test Case Database."""

from __future__ import annotations

from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from services.test_case_database_service import TestCaseDatabaseService


def create_test_case_database_blueprint(
    test_case_database_service: TestCaseDatabaseService,
) -> Blueprint:
    """Create the Test Case Database API blueprint."""

    bp = Blueprint(
        "test_case_database_api",
        __name__,
        url_prefix="/api/test-case-database",
    )

    @bp.route("/changes", methods=["GET"])
    def search_changes():
        return jsonify(
            test_case_database_service.search_changes(
                query=request.args.get("q", ""),
                test_case_id=request.args.get("test_case_id"),
                status=request.args.get("status"),
                tag=request.args.get("tag"),
                include_archived=_include_archived(),
            )
        )

    @bp.route("/changes", methods=["POST"])
    def create_change():
        change = test_case_database_service.create_change(request.get_json(silent=True) or {})
        return jsonify(change), 201

    @bp.route("/changes/<int:change_id>", methods=["GET"])
    def get_change(change_id: int):
        return jsonify(test_case_database_service.get_change(change_id))

    @bp.route("/changes/<int:change_id>", methods=["PUT"])
    def update_change(change_id: int):
        return jsonify(
            test_case_database_service.update_change(
                change_id,
                request.get_json(silent=True) or {},
            )
        )

    @bp.route("/changes/<int:change_id>/archive", methods=["POST"])
    def archive_change(change_id: int):
        return jsonify(test_case_database_service.archive_change(change_id))

    @bp.route("/changes/<int:change_id>/attachments", methods=["GET"])
    def list_change_attachments(change_id: int):
        return jsonify(test_case_database_service.list_change_attachments(change_id))

    @bp.route("/changes/<int:change_id>/attachments", methods=["POST"])
    def upload_change_attachments(change_id: int):
        attachments = [
            {
                "filename": uploaded_file.filename or "",
                "mime_type": uploaded_file.mimetype or "",
                "file_size": len(file_bytes),
                "file_bytes": file_bytes,
            }
            for uploaded_file in request.files.getlist("files")
            for file_bytes in [uploaded_file.read()]
        ]
        attachments = test_case_database_service.add_change_attachments(
            change_id=change_id,
            attachments=attachments,
        )
        return jsonify(attachments), 201

    @bp.route(
        "/changes/<int:change_id>/attachments/<int:attachment_id>/file",
        methods=["GET"],
    )
    def download_change_attachment(change_id: int, attachment_id: int):
        attachment = test_case_database_service.get_change_attachment(
            change_id,
            attachment_id,
        )
        return send_file(
            BytesIO(attachment["file_bytes"]),
            mimetype=attachment.get("mime_type") or "application/octet-stream",
            as_attachment=True,
            download_name=attachment["filename"],
        )

    @bp.route(
        "/changes/<int:change_id>/attachments/<int:attachment_id>",
        methods=["DELETE"],
    )
    def delete_change_attachment(change_id: int, attachment_id: int):
        test_case_database_service.delete_change_attachment(change_id, attachment_id)
        return "", 204

    return bp


def _include_archived() -> bool:
    return request.args.get("include_archived", "").lower() in {"1", "true", "yes"}
