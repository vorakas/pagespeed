"""GitHub webhook receiver for the ``lpadobe-vault`` repo.

When the orchestrator (or anyone else) pushes to ``origin/main`` with
changes under ``wiki/``, GitHub POSTs here and we pull the new commits
onto the Railway vault clone + fire the same refresh hooks the sync
service uses (cache invalidate + snapshot reingest).

Pushes that only touch ``raw/`` are ignored — those originate from the
dashboard's own Sync job and don't require a dashboard refresh (the
orchestrator will turn them into ``wiki/`` updates, which *do* fire
this endpoint).
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import threading
from typing import Callable, Sequence

from flask import Blueprint, jsonify, request

from services.vault_git_service import VaultGitService


logger = logging.getLogger(__name__)

WIKI_PATH_PREFIX = "wiki/"
TARGET_REF = "refs/heads/main"


def _any_wiki_change(payload: dict) -> bool:
    """True if any commit in the push touches a path under ``wiki/``."""
    for commit in payload.get("commits") or []:
        for key in ("added", "modified", "removed"):
            for path in commit.get(key) or []:
                if isinstance(path, str) and path.startswith(WIKI_PATH_PREFIX):
                    return True
    return False


def _verify_signature(secret: str, raw_body: bytes, header_value: str | None) -> bool:
    """Constant-time HMAC-SHA256 compare of GitHub's signature header.

    GitHub sends ``X-Hub-Signature-256: sha256=<hex>``. Missing header or
    malformed prefix is treated as failure.
    """
    if not header_value or not header_value.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    provided = header_value.split("=", 1)[1]
    return hmac.compare_digest(expected, provided)


def create_github_webhook_blueprint(
    vault_git_service: VaultGitService,
    webhook_secret: str | None,
    on_vault_refreshed: Sequence[Callable[[], None]] | None = None,
) -> Blueprint:
    """Factory wiring the webhook receiver into a Flask blueprint.

    Args:
        vault_git_service: Used to pull new commits onto the Railway clone.
        webhook_secret:    Shared secret for HMAC verification. When ``None``
                           the endpoint returns 503 so the misconfiguration
                           is visible rather than silently accepting any
                           payload.
        on_vault_refreshed: Callbacks invoked after a successful pull that
                            advanced HEAD — same shape the Obsidian sync
                            uses to invalidate the dashboard cache and
                            reingest snapshots.
    """
    bp = Blueprint("github_webhook_api", __name__)
    refresh_hooks = list(on_vault_refreshed or [])

    def _fire_refresh_hooks() -> None:
        for hook in refresh_hooks:
            try:
                hook()
            except Exception:  # noqa: BLE001 — hooks must not break the pull
                logger.exception("on_vault_refreshed hook failed")

    def _pull_and_refresh() -> None:
        """Background worker — pulls, fires hooks if HEAD advanced."""
        try:
            prev_head = vault_git_service.auto_refresh_status().get("lastRefreshedHead")
            result = vault_git_service.auto_refresh()
            if result.get("ok") and result.get("head") and result["head"] != prev_head:
                logger.info(
                    "GitHub webhook: vault advanced %s → %s, firing refresh hooks",
                    prev_head, result["head"],
                )
                _fire_refresh_hooks()
            else:
                logger.info(
                    "GitHub webhook: pull completed without advancing HEAD (ok=%s head=%s)",
                    result.get("ok"), result.get("head"),
                )
        except Exception:
            logger.exception("GitHub webhook: pull-and-refresh worker failed")

    @bp.route("/api/github-webhook/lpadobe-vault", methods=["POST"])
    def receive_push():
        if not webhook_secret:
            return jsonify({"error": "GITHUB_WEBHOOK_SECRET not configured"}), 503

        raw_body = request.get_data()
        signature = request.headers.get("X-Hub-Signature-256")
        if not _verify_signature(webhook_secret, raw_body, signature):
            logger.warning("GitHub webhook: bad or missing signature")
            return jsonify({"error": "invalid signature"}), 401

        event = request.headers.get("X-GitHub-Event", "")
        if event == "ping":
            return jsonify({"pong": True}), 200
        if event != "push":
            return jsonify({"ignored": True, "reason": f"event={event}"}), 200

        payload = request.get_json(silent=True) or {}
        if payload.get("ref") != TARGET_REF:
            return jsonify({
                "ignored": True,
                "reason": f"ref={payload.get('ref')} (only {TARGET_REF} is processed)",
            }), 200

        if not _any_wiki_change(payload):
            return jsonify({
                "ignored": True,
                "reason": "no wiki/ paths in push (likely raw/ only — orchestrator will handle)",
            }), 200

        # Kick the pull into a background thread so GitHub gets a fast 200.
        # Daemon=True so it doesn't block shutdown if the pull hangs.
        threading.Thread(target=_pull_and_refresh, daemon=True).start()
        return jsonify({"accepted": True}), 202

    return bp
