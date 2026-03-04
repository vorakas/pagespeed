"""Triggers API blueprint.

Thin route layer — extracts JSON body fields, delegates to the
TriggerService, and formats the JSON response.  All validation and
scheduler logic lives in the service layer.
"""

from flask import Blueprint, jsonify, request

from services.trigger_service import TriggerService


def create_triggers_blueprint(trigger_service: TriggerService) -> Blueprint:
    """Factory that creates the triggers API blueprint.

    Args:
        trigger_service: Service for trigger CRUD and scheduler management.

    Returns:
        Configured Flask Blueprint.
    """
    bp = Blueprint("triggers_api", __name__)

    @bp.route("/api/triggers", methods=["GET"])
    def list_triggers():
        """Return all scheduled triggers."""
        return jsonify(trigger_service.get_triggers())

    @bp.route("/api/triggers", methods=["POST"])
    def create_trigger():
        """Create a new scheduled trigger."""
        data = request.get_json(force=True)
        trigger_id = trigger_service.create_trigger(
            name=data.get("name", ""),
            schedule_type=data.get("schedule_type", ""),
            schedule_value=data.get("schedule_value", ""),
            strategy=data.get("strategy", "desktop"),
            url_ids=data.get("url_ids", []),
        )
        return jsonify({"success": True, "id": trigger_id}), 201

    @bp.route("/api/triggers/<int:trigger_id>", methods=["PUT"])
    def update_trigger(trigger_id):
        """Update an existing scheduled trigger."""
        data = request.get_json(force=True)
        trigger_service.update_trigger(
            trigger_id=trigger_id,
            name=data.get("name", ""),
            schedule_type=data.get("schedule_type", ""),
            schedule_value=data.get("schedule_value", ""),
            strategy=data.get("strategy", "desktop"),
            url_ids=data.get("url_ids", []),
        )
        return jsonify({"success": True})

    @bp.route("/api/triggers/<int:trigger_id>", methods=["DELETE"])
    def delete_trigger(trigger_id):
        """Delete a scheduled trigger."""
        trigger_service.delete_trigger(trigger_id)
        return jsonify({"success": True})

    @bp.route("/api/triggers/<int:trigger_id>/toggle", methods=["PATCH"])
    def toggle_trigger(trigger_id):
        """Enable or disable a scheduled trigger."""
        data = request.get_json(force=True)
        enabled = data.get("enabled", True)
        trigger_service.toggle_trigger(trigger_id, enabled)
        return jsonify({"success": True})

    @bp.route("/api/triggers/presets", methods=["GET"])
    def get_presets():
        """Return merged built-in and user-created schedule presets."""
        return jsonify(trigger_service.get_all_presets())

    @bp.route("/api/triggers/presets", methods=["POST"])
    def create_preset():
        """Create a new user schedule preset."""
        data = request.get_json(force=True)
        preset_id = trigger_service.create_preset(
            name=data.get("name", ""),
            cron_expression=data.get("cron_expression", ""),
        )
        return jsonify({"success": True, "id": preset_id}), 201

    @bp.route("/api/triggers/presets/<int:preset_id>", methods=["DELETE"])
    def delete_preset(preset_id):
        """Delete a user-created schedule preset."""
        trigger_service.delete_preset(preset_id)
        return jsonify({"success": True})

    return bp
