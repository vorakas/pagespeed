"""Metrics and results blueprint.

Thin route layer — extracts query parameters, delegates to the
TestResultRepository, and formats the JSON response.
"""

from flask import Blueprint, jsonify, request

from data_access import TestResultRepository


def create_metrics_blueprint(test_result_repo: TestResultRepository) -> Blueprint:
    """Factory that creates the metrics API blueprint.

    Args:
        test_result_repo: Repository for querying test results.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("metrics_api", __name__)

    @bp.route("/api/sites/<int:site_id>/latest-results")
    def latest_results(site_id):
        strategy = request.args.get("strategy", "desktop")
        return jsonify(test_result_repo.get_latest_by_site(site_id, strategy=strategy))

    @bp.route("/api/urls/<int:url_id>/history")
    def url_history(url_id):
        days = request.args.get("days", 30, type=int)
        strategy = request.args.get("strategy", "desktop")
        return jsonify(test_result_repo.get_history(url_id, days=days, strategy=strategy))

    @bp.route("/api/test-details/<int:url_id>")
    def test_details(url_id):
        result = test_result_repo.get_details(url_id)
        if not result:
            return jsonify({"error": "No test results found"}), 404
        return jsonify(result)

    @bp.route("/api/comparison")
    def comparison():
        site1_id = request.args.get("site1", type=int)
        site2_id = request.args.get("site2", type=int)
        if not site1_id or not site2_id:
            return jsonify({"error": "Both site1 and site2 parameters are required"}), 400

        strategy = request.args.get("strategy", "desktop")
        return jsonify({
            "site1": test_result_repo.get_latest_by_site(site1_id, strategy=strategy),
            "site2": test_result_repo.get_latest_by_site(site2_id, strategy=strategy),
        })

    @bp.route("/api/comparison/urls")
    def url_comparison():
        url1_id = request.args.get("url1", type=int)
        url2_id = request.args.get("url2", type=int)
        if not url1_id or not url2_id:
            return jsonify({"error": "Both url1 and url2 parameters are required"}), 400
        return jsonify(test_result_repo.get_url_comparison(url1_id, url2_id))

    return bp
