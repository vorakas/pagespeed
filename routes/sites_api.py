"""Site and URL CRUD blueprint.

Thin route layer — validates input, delegates to SiteService, and
formats the JSON response.  No SQL or business logic.
"""

from flask import Blueprint, jsonify, request

from services.site_service import SiteService


def create_sites_blueprint(site_service: SiteService) -> Blueprint:
    """Factory that creates the sites API blueprint.

    Args:
        site_service: Service for site/URL CRUD operations.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("sites_api", __name__)

    @bp.route("/api/sites", methods=["GET", "POST"])
    def sites():
        if request.method == "POST":
            data = request.get_json()
            site_id = site_service.create_site(data["name"])
            return jsonify({"success": True, "id": site_id})
        return jsonify(site_service.get_sites())

    @bp.route("/api/sites/<int:site_id>/urls", methods=["GET", "POST"])
    def site_urls(site_id):
        if request.method == "POST":
            data = request.get_json()
            url_id = site_service.add_url(site_id, data["url"])
            return jsonify({"success": True, "id": url_id})
        return jsonify(site_service.get_urls(site_id))

    @bp.route("/api/sites/<int:site_id>", methods=["PUT"])
    def update_site(site_id):
        data = request.get_json()
        site_service.update_site(site_id, data.get("name", ""))
        return jsonify({"success": True})

    @bp.route("/api/sites/<int:site_id>", methods=["DELETE"])
    def delete_site(site_id):
        site_service.delete_site(site_id)
        return jsonify({"success": True})

    @bp.route("/api/urls/<int:url_id>", methods=["DELETE"])
    def delete_url(url_id):
        site_service.delete_url(url_id)
        return jsonify({"success": True})

    return bp
