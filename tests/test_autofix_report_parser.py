import io
import json
import unittest
import zipfile

from services.autofix_report_parser import extract_report_json, parse_report


def _zip_with(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buffer.getvalue()


_REPORT = {
    "schemaVersion": 1,
    "generatedUtc": "2026-06-02T17:56:00Z",
    "build": {
        "buildId": "812", "buildNumber": "20260602.3", "pipeline": "Functional",
        "branch": "release/x", "buildUrl": "https://dev.azure.com/lp/b/812",
        "commit": "abc123",
    },
    "summary": {"failures": 8, "groups": 3, "fixesProposed": 2},
    "fixes": [
        {
            "fixId": "f1", "signature": "Locator|ENF|Cart.cs:88|a1b2",
            "test": {"name": "X.CartTests.RemovesItem"},
            "category": "Locator", "exceptionType": "ElementNotFoundException",
            "confidence": "high", "diagnosis": "stale", "reasoning": "id changed",
            "filePath": "LampsPlus/CartDesktop.cs",
            "location": {"startLine": 87, "endLine": 88},
            "fixType": "UpdateLocatorValue", "oldCode": "Find();",
            "newCode": "FindBySelector();", "description": "use selector",
        },
        {
            "fixId": "f2", "signature": "Timing|TO|Pay.cs:10|c3d4",
            "test": {"name": "X.PayTests.Submits"},
            "category": "Timing", "exceptionType": "TimeoutException",
            "confidence": "low", "diagnosis": "slow", "reasoning": "ajax",
            "filePath": "LampsPlus/PayDesktop.cs",
            "fixType": "AddWait", "oldCode": "Click();", "newCode": "WaitThenClick();",
            "description": "wait",
        },
    ],
}


class ExtractReportJsonTest(unittest.TestCase):
    def test_finds_report_under_artifact_folder(self):
        zip_bytes = _zip_with({
            "Autofix Report/autofix-report.json": json.dumps(_REPORT),
            "Autofix Report/report.md": "# human readable",
        })
        report = extract_report_json(zip_bytes)
        self.assertEqual(report["build"]["buildId"], "812")

    def test_returns_none_when_absent(self):
        zip_bytes = _zip_with({"Autofix Report/report.md": "# nothing here"})
        self.assertIsNone(extract_report_json(zip_bytes))

    def test_returns_none_for_corrupt_zip(self):
        self.assertIsNone(extract_report_json(b"not a zip"))
        self.assertIsNone(extract_report_json(b""))


class ParseReportTest(unittest.TestCase):
    def test_maps_report_fields(self):
        parsed = parse_report(_REPORT)
        report = parsed["report"]
        self.assertEqual(report["build_id"], "812")
        self.assertEqual(report["pipeline_name"], "Functional")
        self.assertEqual(report["commit_sha"], "abc123")
        self.assertEqual(report["build_number"], "20260602.3")
        self.assertEqual(report["generated_utc"], "2026-06-02T17:56:00Z")
        self.assertEqual(report["failures_count"], 8)
        self.assertEqual(report["groups_count"], 3)
        self.assertEqual(report["fixes_count"], 2)
        self.assertNotIn("pipeline_id", report)
        self.assertNotIn("fetched_at", report)

    def test_maps_fix_fields_and_flattens_test_name(self):
        parsed = parse_report(_REPORT)
        f1 = next(f for f in parsed["fixes"] if f["fix_id"] == "f1")
        self.assertEqual(f1["build_id"], "812")
        self.assertEqual(f1["test_name"], "X.CartTests.RemovesItem")
        self.assertEqual(f1["start_line"], 87)
        self.assertEqual(f1["end_line"], 88)
        self.assertEqual(f1["fix_type"], "UpdateLocatorValue")

    def test_missing_location_yields_none_line_numbers(self):
        parsed = parse_report(_REPORT)
        f2 = next(f for f in parsed["fixes"] if f["fix_id"] == "f2")
        self.assertIsNone(f2["start_line"])
        self.assertIsNone(f2["end_line"])


if __name__ == "__main__":
    unittest.main()
