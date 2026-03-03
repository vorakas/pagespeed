"""Page-rendering blueprint — serves HTML templates.

Every route fetches the site list from SiteService and passes it to
the Jinja2 template.  No business logic lives here.
"""

from flask import Blueprint, render_template

from services.site_service import SiteService


def create_pages_blueprint(site_service: SiteService) -> Blueprint:
    """Factory that creates the pages blueprint with injected dependencies.

    Args:
        site_service: Service for retrieving the site list.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("pages", __name__)

    @bp.route("/")
    def index():
        return render_template("index.html", sites=site_service.get_sites())

    @bp.route("/setup")
    def setup():
        return render_template("setup.html", sites=site_service.get_sites())

    @bp.route("/test")
    def test():
        return render_template("test.html", sites=site_service.get_sites())

    @bp.route("/metrics")
    def metrics():
        return render_template("metrics.html", sites=site_service.get_sites())

    @bp.route("/newrelic")
    def newrelic_page():
        return render_template("newrelic.html", sites=site_service.get_sites())

    @bp.route("/iislogs")
    def iislogs():
        return render_template("iislogs.html", sites=site_service.get_sites())

    @bp.route("/ai-analysis")
    def ai_analysis():
        return render_template("ai_analysis.html", sites=site_service.get_sites())

    return bp
