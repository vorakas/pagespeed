"""Compare Pharos launch-report output against the Adobe Commerce workbook."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile


NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

SECTION_DEVELOPMENT = "lampsPlusDevelopment"
SECTION_E2E = "e2eTesting"


def fetch_launch_report(base_url: str) -> dict:
    url = f"{base_url.rstrip('/')}/api/dashboard/launch-report"
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def read_report_rows(path: Path) -> dict:
    with zipfile.ZipFile(path) as zf:
        shared = read_shared_strings(zf)
        sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))

    rows_by_number: dict[int, dict[str, str]] = {}
    for row in sheet.findall(".//main:row", NS):
        row_num = int(row.attrib["r"])
        values = {}
        for cell in row.findall("main:c", NS):
            ref = cell.attrib.get("r", "")
            col = "".join(ch for ch in ref if ch.isalpha())
            value = cell_value(cell, shared)
            if value != "":
                values[col] = value
        rows_by_number[row_num] = values

    return {
        SECTION_DEVELOPMENT: read_development_rows(rows_by_number),
        SECTION_E2E: read_e2e_rows(rows_by_number),
    }


def read_development_rows(rows_by_number: dict[int, dict[str, str]]) -> list[dict]:
    rows = []
    for row_num in range(21, 65):
        row = rows_by_number.get(row_num, {})
        if row.get("B") and row.get("C") == "1":
            rows.append(
                {
                    "reportGrouping": row["B"],
                    "completedHours": number(row.get("E")),
                    "remainingHours": number(row.get("F")),
                }
            )
    return rows


def read_e2e_rows(rows_by_number: dict[int, dict[str, str]]) -> list[dict]:
    rows = []
    for row_num in range(21, 61):
        row = rows_by_number.get(row_num, {})
        if row.get("J") and row.get("K") == "1":
            rows.append(
                {
                    "reportGrouping": row["J"],
                    "passedTc": number(row.get("M")),
                    "failedTc": number(row.get("N")),
                    "completedHours": number(row.get("O")),
                    "remainingHours": number(row.get("P")),
                }
            )
    return rows


def read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []

    strings = []
    for item in root.findall("main:si", NS):
        pieces = [node.text or "" for node in item.findall(".//main:t", NS)]
        strings.append("".join(pieces))
    return strings


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:t", NS)).strip()

    value = cell.find("main:v", NS)
    if value is None or value.text is None:
        return ""

    raw = value.text.strip()
    if cell_type == "s":
        try:
            return shared[int(raw)].strip()
        except (IndexError, ValueError):
            return ""
    return raw


def number(value: str | None) -> int:
    if value is None or value == "":
        return 0
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def compare(workbook: dict, launch_report: dict) -> dict:
    rows = []
    rows.extend(
        compare_section(
            "Phase 1 Development",
            workbook[SECTION_DEVELOPMENT],
            launch_report.get(SECTION_DEVELOPMENT, {}).get("rows", []),
            ["completedHours", "remainingHours"],
        )
    )
    rows.extend(
        compare_section(
            "Phase 1 E2E",
            workbook[SECTION_E2E],
            launch_report.get(SECTION_E2E, {}).get("rows", []),
            ["passedTc", "failedTc", "completedHours", "remainingHours"],
        )
    )
    return {
        "summary": {
            "dataGapRows": count_classification(rows, "data-gap"),
            "freshnessDriftRows": count_classification(rows, "freshness-drift"),
            "mappingGapRows": count_classification(rows, "mapping-gap"),
            "matchedRows": count_classification(rows, "matched"),
            "totalRows": len(rows),
        },
        "rows": rows,
    }


def compare_section(
    section: str,
    workbook_rows: list[dict],
    report_rows: list[dict],
    fields: list[str],
) -> list[dict]:
    report_by_name = {row.get("reportGrouping"): row for row in report_rows if row.get("reportGrouping")}
    workbook_by_name = {row["reportGrouping"]: row for row in workbook_rows}

    rows = []
    for expected in workbook_rows:
        actual = report_by_name.get(expected["reportGrouping"])
        if actual is None:
            rows.append(
                {
                    "classification": "mapping-gap",
                    "reason": "row missing from launch-report response",
                    "reportGrouping": expected["reportGrouping"],
                    "section": section,
                }
            )
            continue

        diagnostics = actual.get("diagnostics") or {}
        deltas = {
            field: {"pharos": number(actual.get(field)), "workbook": expected.get(field, 0)}
            for field in fields
            if expected.get(field, 0) != number(actual.get(field))
        }
        if not deltas:
            classification = "matched"
            reason = "values match"
        elif diagnostic_total(diagnostics):
            classification = "mapping-gap"
            reason = "value delta with launch-report diagnostics"
        else:
            classification = "freshness-drift"
            reason = "value delta without launch-report diagnostics"

        rows.append(
            {
                "classification": classification,
                "deltas": deltas,
                "diagnostics": diagnostics,
                "reason": reason,
                "reportGrouping": expected["reportGrouping"],
                "section": section,
            }
        )

    for actual in sorted(report_rows, key=lambda row: row.get("reportGrouping") or ""):
        report_grouping = actual.get("reportGrouping")
        if not report_grouping or report_grouping in workbook_by_name:
            continue
        values = {field: number(actual.get(field)) for field in fields}
        diagnostics = actual.get("diagnostics") or {}
        if any(values.values()) or diagnostic_total(diagnostics):
            rows.append(
                {
                    "classification": "data-gap",
                    "diagnostics": diagnostics,
                    "pharos": values,
                    "reason": "launch-report row has data but workbook Phase 1 row is absent",
                    "reportGrouping": report_grouping,
                    "section": section,
                }
            )

    return rows


def diagnostic_total(diagnostics: dict) -> int:
    return sum(number(value) for value in diagnostics.values())


def count_classification(rows: list[dict], classification: str) -> int:
    return sum(1 for row in rows if row["classification"] == classification)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compare workbook Phase 1 report rows to the Pharos launch-report endpoint."
    )
    parser.add_argument("--workbook", required=True, help="Path to the Adobe Commerce xlsx workbook.")
    parser.add_argument("--base-url", default="http://127.0.0.1:5000", help="Pharos base URL.")
    args = parser.parse_args()

    workbook = read_report_rows(Path(args.workbook))
    launch_report = fetch_launch_report(args.base_url)
    result = compare(workbook, launch_report)
    print(json.dumps(result, indent=2, sort_keys=True))
    summary = result["summary"]
    return 1 if summary["mappingGapRows"] or summary["dataGapRows"] else 0


if __name__ == "__main__":
    sys.exit(main())
