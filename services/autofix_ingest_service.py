"""Ingest service for autofix report artifacts.

Scans recent builds of the configured pipeline definitions, downloads
the ``Autofix Report`` artifact for each, parses ``autofix-report.json``,
and UPSERTs the result. Builds with no artifact (or no parseable report)
are skipped. A build that raises mid-ingest is isolated: it is logged
(with traceback), counted in ``buildsFailed``, and does not abort the
rest of the refresh. The Azure DevOps client is passed in by the caller
so PAT resolution stays in the route layer.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Protocol

from data_access.autofix_repository import AutofixRepository
from services.autofix_report_parser import extract_report_json, parse_report

logger = logging.getLogger(__name__)


class AutofixClient(Protocol):
    """The Azure DevOps client surface this ingest service depends on."""

    def list_recent_builds_by_definition(
        self, definition_ids: list[int], per_definition: int = 10
    ) -> dict[str, list[dict]]:
        ...

    def download_named_artifact(
        self, build_id: int, artifact_name: str
    ) -> bytes | None:
        ...


class AutofixIngestService:
    """Pulls autofix report artifacts from Azure DevOps into the repository."""

    def __init__(
        self,
        repository: AutofixRepository,
        artifact_name: str = "Autofix Report",
    ) -> None:
        self._repo = repository
        self._artifact_name = artifact_name

    def ingest(
        self,
        client: AutofixClient,
        definition_ids: list[int],
        per_definition: int = 10,
    ) -> dict[str, Any]:
        """Scan, download, parse, and upsert. Returns a small summary dict.

        Per-build failures are isolated: a build whose artifact cannot be
        parsed or upserted is logged and counted in ``buildsFailed`` rather
        than aborting the whole refresh.
        """
        builds_by_def = client.list_recent_builds_by_definition(
            definition_ids=definition_ids,
            per_definition=per_definition,
        )
        fetched_at = datetime.now(timezone.utc).replace(microsecond=0)

        ingested = 0
        scanned = 0
        failed = 0
        for build_list in builds_by_def.values():
            for build in build_list:
                scanned += 1
                build_id = build.get("id")
                try:
                    zip_bytes = client.download_named_artifact(build_id, self._artifact_name)
                    if not zip_bytes:
                        continue
                    report_json = extract_report_json(zip_bytes)
                    if not report_json:
                        logger.warning(
                            "Build %s artifact contained no autofix-report.json", build_id
                        )
                        continue
                    parsed = parse_report(report_json)
                    report_row = parsed["report"]
                    report_row["pipeline_id"] = build.get("definitionId")
                    report_row["fetched_at"] = fetched_at
                    self._repo.upsert_report(report_row, parsed["fixes"])
                    ingested += 1
                except Exception:
                    failed += 1
                    logger.warning(
                        "Build %s: failed to ingest autofix report, skipping",
                        build_id, exc_info=True,
                    )
                    continue

        return {
            "buildsScanned": scanned,
            "buildsIngested": ingested,
            "buildsFailed": failed,
            "definitionsScanned": len(definition_ids),
        }
