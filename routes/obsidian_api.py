"""Obsidian vault sync + browse API blueprint.

Talks to:
- :class:`~services.obsidian_sync_service.ObsidianSyncService` to trigger
  and report on Jira/Asana vault sync jobs.
- :class:`~services.obsidian_sync.vault_reader.VaultReader` to serve the
  vault tree and page content to the React frontend.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request, send_file

from services.obsidian_sync.vault_reader import (
    VaultNotFoundError,
    VaultPathError,
    VaultReader,
)
from services.obsidian_sync_service import (
    ObsidianSyncService,
    SyncAlreadyRunning,
)
from services.vault_git_service import VaultGitService


def create_obsidian_blueprint(
    sync_service: ObsidianSyncService,
    vault_git_service: VaultGitService | None = None,
) -> Blueprint:
    """Factory that wires the Obsidian sync service into a Flask blueprint."""
    bp = Blueprint("obsidian_api", __name__)

    def _vault_reader() -> VaultReader:
        return VaultReader(str(sync_service.vault_root))

    @bp.route("/api/obsidian/capabilities", methods=["GET"])
    def capabilities():
        return jsonify(sync_service.capabilities())

    # ── Sync ──────────────────────────────────────────────────────────

    @bp.route("/api/obsidian/sync", methods=["POST"])
    def start_sync():
        data = request.get_json(silent=True) or {}
        source = str(data.get("source", "both"))
        projects_jira = data.get("projectsJira")
        projects_asana = data.get("projectsAsana")
        jql_feeds = data.get("jqlFeeds")
        full_refresh = bool(data.get("fullRefresh", False))

        try:
            job = sync_service.start_sync(
                source=source,
                projects_jira=projects_jira,
                projects_asana=projects_asana,
                jql_feeds=jql_feeds,
                full_refresh=full_refresh,
            )
        except SyncAlreadyRunning as exc:
            return (
                jsonify({"error": "sync already running", "activeJobId": str(exc)}),
                409,
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"success": True, "job": job.to_dict()}), 202

    @bp.route("/api/obsidian/sync/active", methods=["GET"])
    def active_sync():
        job = sync_service.active_job()
        return jsonify({"active": job.to_dict() if job else None})

    @bp.route("/api/obsidian/sync/history", methods=["GET"])
    def sync_history():
        limit = int(request.args.get("limit", 20))
        jobs = sync_service.list_jobs(limit=limit)
        summary = []
        for job in jobs:
            entry = job.to_dict()
            entry.pop("lines", None)
            summary.append(entry)
        return jsonify({"jobs": summary})

    @bp.route("/api/obsidian/sync/<job_id>", methods=["GET"])
    def get_sync(job_id: str):
        job = sync_service.get_job(job_id)
        if job is None:
            return jsonify({"error": "unknown job"}), 404
        return jsonify({"job": job.to_dict()})

    @bp.route("/api/obsidian/pending-orchestration", methods=["GET"])
    def pending_orchestration():
        """Summary of raw-file changes awaiting the next orchestrator run."""
        if vault_git_service is None:
            return jsonify({"enabled": False})
        try:
            payload = vault_git_service.pending_for_orchestration()
        except Exception as exc:
            return jsonify({"enabled": True, "error": str(exc)}), 500
        if not payload:
            return jsonify({"enabled": False})
        return jsonify({"enabled": True, **payload})

    @bp.route("/api/obsidian/vault/git-state", methods=["GET"])
    def vault_git_state():
        """Read-only snapshot of the vault clone's git state."""
        if vault_git_service is None:
            return jsonify({"enabled": False})
        try:
            return jsonify({"enabled": True, **vault_git_service.diagnose_state()})
        except Exception as exc:
            return jsonify({"enabled": True, "error": str(exc)}), 500

    @bp.route("/api/obsidian/vault/ping", methods=["POST"])
    def vault_ping():
        """Write a sentinel and exercise the commit-and-push pipeline."""
        if vault_git_service is None:
            return jsonify({"enabled": False}), 400
        try:
            return jsonify({"enabled": True, **vault_git_service.ping()})
        except Exception as exc:
            return jsonify({"enabled": True, "error": str(exc)}), 500

    # ── Vault browse ──────────────────────────────────────────────────

    @bp.route("/api/obsidian/vault/tree", methods=["GET"])
    def vault_tree():
        subdir = request.args.get("subdir", "")
        max_depth = int(request.args.get("depth", 6))
        try:
            tree = _vault_reader().tree(subdir=subdir, max_depth=max_depth)
        except VaultNotFoundError as exc:
            return jsonify({"error": "vault not found", "vaultRoot": str(exc)}), 404
        except VaultPathError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"tree": tree.to_dict()})

    @bp.route("/api/obsidian/vault/asset", methods=["GET"])
    def vault_asset():
        base = request.args.get("base", "")
        asset = request.args.get("asset", "")
        if not base or not asset:
            return jsonify({"error": "base and asset are required"}), 400
        try:
            path, mimetype = _vault_reader().resolve_asset(base, asset)
        except VaultNotFoundError:
            return jsonify({"error": "vault not found"}), 404
        except VaultPathError as exc:
            return jsonify({"error": str(exc)}), 400
        return send_file(path, mimetype=mimetype, max_age=3600)

    @bp.route("/api/obsidian/vault/page", methods=["GET"])
    def vault_page():
        path = request.args.get("path", "")
        if not path:
            return jsonify({"error": "path is required"}), 400
        try:
            page = _vault_reader().read_page(path)
        except VaultNotFoundError:
            return jsonify({"error": "vault not found"}), 404
        except VaultPathError as exc:
            return jsonify({"error": str(exc)}), 400
        except FileNotFoundError:
            return jsonify({"error": "page not found"}), 404
        return jsonify({"page": page})

    return bp
