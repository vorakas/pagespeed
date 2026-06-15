"""API routes for CSV-driven Lighthouse runs."""

import io

from flask import Blueprint, Response, jsonify, request

from config import (
    CSV_LIGHTHOUSE_MAX_CONTENT_LENGTH,
    CSV_LIGHTHOUSE_MAX_FILE_BYTES,
    CSV_LIGHTHOUSE_MAX_FILES,
)
from exceptions import ValidationError


def create_csv_lighthouse_blueprint(service):
    """Create CSV Lighthouse API blueprint."""
    blueprint = Blueprint("csv_lighthouse_api", __name__, url_prefix="/api/csv-lighthouse")

    @blueprint.route("/runs", methods=["POST"])
    def create_run():
        if (
            request.content_length is not None
            and request.content_length > CSV_LIGHTHOUSE_MAX_CONTENT_LENGTH
        ):
            raise ValidationError(
                f"CSV Lighthouse upload exceeds {CSV_LIGHTHOUSE_MAX_CONTENT_LENGTH} bytes"
            )

        files = [file for file in request.files.getlist("files") if file.filename]
        if not files:
            raise ValidationError("At least one CSV file is required")
        if len(files) > CSV_LIGHTHOUSE_MAX_FILES:
            raise ValidationError(
                f"CSV Lighthouse upload accepts at most {CSV_LIGHTHOUSE_MAX_FILES} files"
            )

        site_keys = _parse_site_keys()
        strategy = request.form.get("strategy") or "desktop"
        label = request.form.get("label") or None
        uploaded_files = []
        for file in files:
            size = _stream_size_bytes(file.stream)
            if size > CSV_LIGHTHOUSE_MAX_FILE_BYTES:
                raise ValidationError(
                    f"CSV file {file.filename} exceeds {CSV_LIGHTHOUSE_MAX_FILE_BYTES} bytes"
                )
            uploaded_files.append((file.filename, file.stream))

        result = service.create_run(
            uploaded_files,
            site_keys=site_keys,
            strategy=strategy,
            label=label,
        )
        return jsonify({"success": True, **result})

    @blueprint.route("/runs", methods=["GET"])
    def list_runs():
        return jsonify({"success": True, "runs": service.list_runs()})

    @blueprint.route("/runs/<int:run_id>", methods=["GET"])
    def get_run(run_id):
        detail = service.get_run(run_id)
        not_found = _not_found_response(run_id, detail)
        if not_found:
            return not_found
        return jsonify({"success": True, **detail})

    @blueprint.route("/runs/<int:run_id>/cancel", methods=["POST"])
    def cancel_run(run_id):
        detail = service.get_run(run_id)
        not_found = _not_found_response(run_id, detail)
        if not_found:
            return not_found
        return jsonify({"success": True, **service.cancel_run(run_id)})

    @blueprint.route("/runs/<int:run_id>/export", methods=["GET"])
    def export_run(run_id):
        detail = service.get_run(run_id)
        not_found = _not_found_response(run_id, detail)
        if not_found:
            return not_found
        csv_text = service.export_csv(run_id)
        return Response(
            csv_text,
            mimetype="text/csv",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="csv-lighthouse-run-{run_id}.csv"'
                )
            },
        )

    return blueprint


def _parse_site_keys() -> list[str]:
    raw_values = request.form.getlist("site_keys")
    if len(raw_values) == 1 and "," in raw_values[0]:
        raw_values = raw_values[0].split(",")
    return [value.strip() for value in raw_values if value.strip()]


def _stream_size_bytes(stream) -> int:
    try:
        stream.seek(0, io.SEEK_END)
        size = stream.tell()
    finally:
        stream.seek(0)
    return int(size)


def _not_found_response(run_id: int, detail):
    if not detail or not detail.get("run"):
        return jsonify(
            {"success": False, "error": f"CSV Lighthouse run {run_id} not found"}
        ), 404
    return None
