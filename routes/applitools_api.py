"""Applitools batch ingestion + lookup API.

The Pharos backend cannot reach the Applitools Eyes REST API directly
because Railway's egress is blocked at the corporate firewall. Instead,
QA runs a standalone desktop helper on their own machine (which *is*
allowlisted), and the helper POSTs the fetched batch rows to
``/api/applitools/upload-batch``. The dashboard browser then reads the
cached rows from ``/api/applitools/batch/<batch_id>`` when assembling
the regression spreadsheet.

Two endpoints, two distinct trust boundaries:

* **Upload** — privileged. Authenticated via a shared bearer token in
  ``X-Pharos-Helper-Token``. Without it, anyone could poison the cache.
* **Lookup** — same-origin only (browser → dashboard). No auth needed
  beyond the implicit fact that you already loaded Pharos.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from flask import Blueprint, jsonify, request

from services.applitools_storage import ApplitoolsBatchStore
from services.validation import validate_required_fields

logger = logging.getLogger(__name__)

# Each Visual build card belongs to one of these platforms; the helper
# tags every upload with one so the dashboard dropdown can scope
# suggestions to the matching card. Anything else is rejected.
_VALID_PLATFORMS: frozenset[str] = frozenset({"Windows", "Mac", "iPhone", "Android"})


def create_applitools_blueprint(
    store: ApplitoolsBatchStore,
    helper_token: str | None,
) -> Blueprint:
    """Factory that creates the Applitools API blueprint.

    Args:
        store:        Storage service for uploaded batches.
        helper_token: Shared secret the desktop helper must echo in the
                      ``X-Pharos-Helper-Token`` header. When ``None``,
                      the upload endpoint refuses every request — uploads
                      are an explicit opt-in via the env var.
    """
    bp = Blueprint("applitools_api", __name__)

    @bp.route("/api/applitools/upload-batch", methods=["POST"])
    def upload_batch():
        # Reject early if the deploy hasn't been configured with a token.
        # Failing closed prevents an unsecured prod from accepting writes
        # and is louder than silently allowing them.
        if not helper_token:
            return (
                jsonify({
                    "success": False,
                    "error": "Applitools upload disabled — APPLITOOLS_HELPER_TOKEN not set on server.",
                }),
                503,
            )
        provided = request.headers.get("X-Pharos-Helper-Token", "")
        if not _constant_time_equal(provided, helper_token):
            return jsonify({"success": False, "error": "Unauthorized."}), 401

        data = request.get_json(silent=True) or {}
        # ``tests`` is required to be *present* but may legitimately be an
        # empty list — a batch with no Unresolved/Failed sessions is a
        # valid upload, and the regression spreadsheet still wants the
        # section header rendered. Validate the key separately so the
        # generic non-empty-truthy check doesn't bounce empty lists.
        validate_required_fields(data, ["batchId"])
        if "tests" not in data:
            return jsonify({"success": False, "error": "Missing required field: tests"}), 400
        tests = data.get("tests")
        if not isinstance(tests, list):
            return jsonify({"success": False, "error": "tests must be a list."}), 400

        # Sanitize each row to the four fields the spreadsheet uses.
        # Anything else the helper happens to send is dropped on the
        # floor — no plumbing for fields we don't render.
        normalized: list[dict[str, Any]] = []
        for row in tests:
            if not isinstance(row, dict):
                continue
            normalized.append({
                "testId": str(row.get("testId", "")).strip(),
                "testName": str(row.get("testName", "")).strip(),
                "status": str(row.get("status", "")).strip(),
                "zephyrUrl": str(row.get("zephyrUrl", "")).strip(),
            })

        fetched_at = str(data.get("fetchedAt") or datetime.now(timezone.utc).isoformat())

        # Platform is optional for backwards compatibility (the cache
        # gets wiped on every redeploy anyway), but when supplied it
        # has to be one of the four card platforms — typos would
        # silently break the dropdown filter on the frontend.
        platform_raw = data.get("platform")
        platform = str(platform_raw).strip() if platform_raw else None
        if platform and platform not in _VALID_PLATFORMS:
            return (
                jsonify({
                    "success": False,
                    "error": (
                        f"Unknown platform '{platform}'. "
                        f"Expected one of: {', '.join(sorted(_VALID_PLATFORMS))}."
                    ),
                }),
                400,
            )

        store.put(
            str(data["batchId"]).strip(),
            normalized,
            fetched_at,
            platform=platform,
        )
        logger.info(
            "Applitools batch uploaded: id=%s platform=%s rows=%d",
            data["batchId"],
            platform or "<none>",
            len(normalized),
        )
        return jsonify({"success": True, "stored": len(normalized)})

    @bp.route("/api/applitools/recent-uploads", methods=["GET"])
    def recent_uploads():
        # No auth — same-origin browsers only. Returns metadata only
        # (no test rows) so QA can pick a batch from a dropdown without
        # the dashboard having to load every batch's payload eagerly.
        return jsonify({"success": True, "uploads": store.list_recent()})

    @bp.route("/api/applitools/batch/<batch_id>", methods=["GET"])
    def get_batch(batch_id: str):
        payload = store.get(batch_id)
        if payload is None:
            return (
                jsonify({
                    "success": False,
                    "error": (
                        f"No uploaded results for batch '{batch_id}'. "
                        "Run the Applitools helper, then refresh."
                    ),
                }),
                404,
            )
        return jsonify({"success": True, **payload})

    return bp


def _constant_time_equal(a: str, b: str) -> bool:
    """Length-padded compare to deter timing oracles on the token check."""
    if len(a) != len(b):
        return False
    result = 0
    for x, y in zip(a, b):
        result |= ord(x) ^ ord(y)
    return result == 0
