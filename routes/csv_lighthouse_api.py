"""API routes for CSV-driven Lighthouse runs."""

from flask import Blueprint, Response, jsonify, request

from exceptions import ValidationError


def create_csv_lighthouse_blueprint(service):
    """Create CSV Lighthouse API blueprint."""
    blueprint = Blueprint("csv_lighthouse_api", __name__, url_prefix="/api/csv-lighthouse")

    @blueprint.route("/runs", methods=["POST"])
    def create_run():
        files = [file for file in request.files.getlist("files") if file.filename]
        if not files:
            raise ValidationError("At least one CSV file is required")

        site_keys = _parse_site_keys()
        strategy = request.form.get("strategy") or "desktop"
        label = request.form.get("label") or None
        uploaded_files = []
        for file in files:
            file.stream.seek(0)
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
        return jsonify({"success": True, **service.get_run(run_id)})

    @blueprint.route("/runs/<int:run_id>/cancel", methods=["POST"])
    def cancel_run(run_id):
        return jsonify({"success": True, **service.cancel_run(run_id)})

    @blueprint.route("/runs/<int:run_id>/export", methods=["GET"])
    def export_run(run_id):
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
