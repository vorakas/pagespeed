"""TestData URL listing blueprint.

Thin route layer: accepts CSV uploads and returns the per-site openable URLs
grouped by CSV.  No server-side validation — the user opens the links to check
each SKU in their own browser.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from exceptions import ValidationError
from services.testdata_url_service import TestDataUrlService


def create_testdata_validation_blueprint(
    service: TestDataUrlService,
) -> Blueprint:
    bp = Blueprint("testdata_validation_api", __name__)

    @bp.post("/api/testdata/urls")
    def build_urls():
        files = request.files.getlist("files")
        if not files:
            raise ValidationError("At least one CSV file is required")
        sites = request.form.getlist("sites") or ["mcprod", "www"]
        parsed = [(f.filename or "upload.csv", f.read()) for f in files]
        return jsonify(service.build_listing(parsed, sites))

    return bp
