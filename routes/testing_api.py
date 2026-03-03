"""PageSpeed testing blueprint.

Thin route layer — extracts parameters from the request, delegates to
TestingService, and formats the JSON response.
"""

from __future__ import annotations

import threading

from flask import Blueprint, jsonify, request

from exceptions import ValidationError
from services.testing_service import TestingService


def create_testing_blueprint(testing_service: TestingService) -> Blueprint:
    """Factory that creates the testing API blueprint.

    Args:
        testing_service: Service for running PageSpeed tests.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("testing_api", __name__)

    @bp.route("/api/test-url", methods=["POST"])
    def test_url():
        data = request.get_json()
        url_text = data.get("url")
        if not url_text:
            raise ValidationError("URL is required")

        result = testing_service.test_single_url(
            url=url_text,
            url_id=data.get("url_id"),
            strategy=data.get("strategy", "desktop"),
        )
        return jsonify({"success": True, "result": result})

    @bp.route("/api/test-url-async", methods=["POST"])
    def test_url_async():
        data = request.get_json()
        url_text = data.get("url")
        if not url_text:
            raise ValidationError("URL is required")

        url_id = data.get("url_id")
        strategy = data.get("strategy", "desktop")

        def run_test():
            try:
                testing_service.test_single_url(
                    url=url_text, url_id=url_id, strategy=strategy,
                )
            except Exception:
                pass  # Background task — failure is logged by the service

        thread = threading.Thread(target=run_test, daemon=True)
        thread.start()

        return jsonify({"success": True, "status": "queued"})

    @bp.route("/api/test-site/<int:site_id>", methods=["POST"])
    def test_site(site_id):
        data = request.get_json() or {}
        results = testing_service.test_site(
            site_id=site_id,
            strategy=data.get("strategy", "desktop"),
        )
        return jsonify({"success": True, "results": results})

    @bp.route("/api/test-all", methods=["POST"])
    def test_all():
        data = request.get_json() or {}
        results = testing_service.test_all(
            strategy=data.get("strategy", "desktop"),
        )
        return jsonify({"success": True, "results": results})

    return bp
