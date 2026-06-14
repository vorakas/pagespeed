"""TestData SKU validation blueprint.

Thin route layer: accepts CSV uploads, kicks off validation, exposes run
status, and serves the trimmed CSV download.
"""

from __future__ import annotations

from flask import Blueprint, Response, jsonify, request

from exceptions import ValidationError
from services.sku_validation_service import SkuValidationService


def create_testdata_validation_blueprint(
    service: SkuValidationService,
) -> Blueprint:
    bp = Blueprint("testdata_validation_api", __name__)

    @bp.post("/api/testdata/validate")
    def validate():
        files = request.files.getlist("files")
        if not files:
            raise ValidationError("At least one CSV file is required")
        sites = request.form.getlist("sites") or ["mcprod", "www"]
        parsed = [(f.filename or "upload.csv", f.read()) for f in files]
        state = service.start(parsed, sites)
        return jsonify(state), 202

    @bp.get("/api/testdata/validate/<run_id>")
    def status(run_id: str):
        state = service.get(run_id)
        if state is None:
            raise ValidationError("Unknown validation run")
        return jsonify(state)

    @bp.get("/api/testdata/validate/<run_id>/trimmed/<group_key>")
    def trimmed(run_id: str, group_key: str):
        csv_text = service.get_trimmed_csv(run_id, group_key)
        if csv_text is None:
            raise ValidationError("No trimmed CSV available for this group")
        return Response(
            csv_text,
            mimetype="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{group_key}.csv"'},
        )

    return bp
