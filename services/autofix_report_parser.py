"""Pure helpers for the autofix report artifact.

* :func:`extract_report_json` pulls ``autofix-report.json`` out of a
  downloaded build-artifact zip.
* :func:`parse_report` maps the report dict (the Plan 1 JSON contract)
  to repository-row dicts.

Neither function performs network or database I/O, so both are unit
tested directly. ``pipeline_id`` and ``fetched_at`` are NOT set here —
the ingest service supplies them from the Azure DevOps build object.
"""

from __future__ import annotations

import io
import json
import zipfile
from typing import Any

REPORT_FILENAME = "autofix-report.json"


def extract_report_json(zip_bytes: bytes) -> dict[str, Any] | None:
    """Return the parsed ``autofix-report.json`` from an artifact zip, or ``None``.

    Returns ``None`` for empty or corrupt (non-zip) input so a transient
    download failure skips the build instead of aborting the whole refresh.
    Malformed JSON inside a valid zip is NOT swallowed — it propagates so a
    genuine contract violation surfaces.
    """
    try:
        archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        return None
    with archive:
        for name in archive.namelist():
            # First match wins — artifact zips are expected to contain exactly one.
            if name.endswith(REPORT_FILENAME):
                with archive.open(name) as handle:
                    return json.loads(handle.read().decode("utf-8"))
    return None


def parse_report(report: dict[str, Any]) -> dict[str, Any]:
    """Map a report dict to ``{"report": {...}, "fixes": [{...}]}`` row dicts."""
    build = report.get("build") or {}
    summary = report.get("summary") or {}
    build_id = str(build.get("buildId") or "")

    report_row = {
        "build_id": build_id,
        "pipeline_name": build.get("pipeline") or "",
        "branch": build.get("branch") or "",
        "build_number": build.get("buildNumber") or "",
        "build_url": build.get("buildUrl") or "",
        "commit_sha": build.get("commit") or "",
        "generated_utc": report.get("generatedUtc"),
        "failures_count": int(summary.get("failures") or 0),
        "groups_count": int(summary.get("groups") or 0),
        "fixes_count": int(summary.get("fixesProposed") or 0),
    }

    fixes = [_parse_fix(build_id, fix) for fix in report.get("fixes") or []]
    return {"report": report_row, "fixes": fixes}


def _parse_fix(build_id: str, fix: dict[str, Any]) -> dict[str, Any]:
    test = fix.get("test") or {}
    location = fix.get("location") or {}
    return {
        "build_id": build_id,
        "fix_id": fix.get("fixId") or "",
        "signature": fix.get("signature") or "",
        "test_name": test.get("name") or "",
        "category": fix.get("category") or "",
        "exception_type": fix.get("exceptionType") or "",
        "confidence": fix.get("confidence") or "",
        "diagnosis": fix.get("diagnosis") or "",
        "reasoning": fix.get("reasoning") or "",
        "file_path": fix.get("filePath") or "",
        "start_line": location.get("startLine"),
        "end_line": location.get("endLine"),
        "fix_type": fix.get("fixType") or "",
        "old_code": fix.get("oldCode") or "",
        "new_code": fix.get("newCode") or "",
        "description": fix.get("description") or "",
    }
