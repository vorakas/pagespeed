# Launch Dashboard Report Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a spreadsheet-row-driven Launch Report data contract for Phase 1 LampsPlus Development and E2E Testing, using Jira Epic Link grouping and the `AC-P1` label, then render it on the Launch Dashboard with diagnostics.

**Architecture:** Add one pure report-rollup module fed by the existing Vault raw task scanner. Keep report parity data separate from the existing operational dashboard feeds so Blockers, What Changed, Daily Status, and Incidents keep their current semantics.

**Tech Stack:** Python 3.11, Flask, unittest, React 19, TypeScript, Vite, lucide-react.

---

## File Structure

- Modify `services/obsidian_sync/raw_scanner.py`
  - Add `RawTask.labels` so the report layer can filter on `AC-P1`.
- Modify `tests/test_raw_scanner.py`
  - Add scanner coverage for Jira labels parsed from Vault frontmatter.
- Create `services/launch_report.py`
  - Own canonical report rows, Epic Link resolution, Phase 1 filtering, spreadsheet-style math, and diagnostics.
- Create `tests/test_launch_report.py`
  - Pure unit tests for report grouping, label filtering, E2E counts, and diagnostics.
- Modify `services/migration_dashboard_service.py`
  - Add `get_launch_report()` and delegate to `services.launch_report`.
- Modify `routes/dashboard_api.py`
  - Add `GET /api/dashboard/launch-report`.
- Modify `frontend/src/types/index.ts`
  - Add Launch Report response and row interfaces.
- Modify `frontend/src/services/api.ts`
  - Add `getLaunchReport()`.
- Create `frontend/src/components/launch-dashboard/LaunchReportSections.tsx`
  - Render the two spreadsheet-style report sections and diagnostics.
- Modify `frontend/src/pages/LaunchDashboard.tsx`
  - Fetch launch report data and place the component without changing existing operational panels.
- Create `scripts/validate_launch_report_parity.py`
  - Local validation CLI that parses the workbook with Python stdlib and compares it to the Pharos endpoint.

---

### Task 1: Expose Jira Labels On RawTask

**Files:**
- Modify: `services/obsidian_sync/raw_scanner.py`
- Modify: `tests/test_raw_scanner.py`

- [ ] **Step 1: Write the failing raw scanner test**

Append this test method to `RawScannerNewBugsTest` in `tests/test_raw_scanner.py`:

```python
    def test_parses_jira_labels_into_api_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            task_path = (
                root
                / "raw"
                / "WPM"
                / "Task"
                / "WPM-5471 - Build commerce item.md"
            )
            task_path.parent.mkdir(parents=True)
            task_path.write_text(
                "---\n"
                "key: WPM-5471\n"
                "summary: \"Build commerce item\"\n"
                "type: Task\n"
                "status: Closed\n"
                "labels: [\"AC-P1\", \"adobe-commerce\"]\n"
                "---\n"
                "body\n",
                encoding="utf-8",
            )

            tasks = list(RawTaskScanner(VaultReader(root)).iter_tasks())

        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0].labels, ["AC-P1", "adobe-commerce"])
        self.assertEqual(tasks[0].to_dict()["labels"], ["AC-P1", "adobe-commerce"])
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
python -m unittest tests.test_raw_scanner.RawScannerNewBugsTest.test_parses_jira_labels_into_api_payload
```

Expected: fail with an attribute/key error for `labels`.

- [ ] **Step 3: Add labels to RawTask**

Update the import and dataclass in `services/obsidian_sync/raw_scanner.py`:

```python
from dataclasses import dataclass, field
```

Add the field after `launch_priority`:

```python
    labels: List[str] = field(default_factory=list)
```

Add the API payload entry after `launchPriority`:

```python
            "labels": self.labels,
```

Add scanner parsing after `launch_priority=...`:

```python
            labels=_list(fm.get("labels")),
```

Add this helper below `_str()`:

```python
def _list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("[") and text.endswith("]"):
            inner = text[1:-1].strip()
            if not inner:
                return []
            return [
                part.strip().strip('"').strip("'")
                for part in inner.split(",")
                if part.strip().strip('"').strip("'")
            ]
        return [text]
    return [str(value)]
```

- [ ] **Step 4: Run raw scanner tests**

Run:

```powershell
python -m unittest tests.test_raw_scanner
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add services/obsidian_sync/raw_scanner.py tests/test_raw_scanner.py
git commit -m "Add Jira labels to raw task scanner"
```

---

### Task 2: Add Pure Launch Report Rollup

**Files:**
- Create: `services/launch_report.py`
- Create: `tests/test_launch_report.py`

- [ ] **Step 1: Write failing report rollup tests**

Create `tests/test_launch_report.py`:

```python
import unittest

from services.launch_report import build_launch_report
from services.obsidian_sync.raw_scanner import RawTask


def task(
    key,
    summary,
    *,
    task_type="Task",
    status="Open",
    epic_link=None,
    parent_key=None,
    labels=None,
    spent=0,
    remaining=0,
):
    return RawTask(
        key=key,
        source="jira",
        project=key.split("-", 1)[0],
        rel_path=f"raw/{key.split('-', 1)[0]}/{task_type}/{key} - {summary}.md",
        summary=summary,
        task_type=task_type,
        status=status,
        epic_link=epic_link,
        parent_key=parent_key,
        labels=labels or [],
        time_spent_seconds=spent,
        remaining_estimate_seconds=remaining,
    )


class LaunchReportTest(unittest.TestCase):
    def test_development_rollup_resolves_epic_link_key_to_spreadsheet_grouping(self):
        report = build_launch_report([
            task("ACM-4", "AC Implementation - Commerce Implementation", task_type="Epic"),
            task(
                "WPM-5471",
                "Build commerce item",
                epic_link="ACM-4",
                labels=["AC-P1"],
                spent=7200,
                remaining=3600,
            ),
            task(
                "WPM-5470",
                "Build second commerce item",
                epic_link="ACM-4",
                labels=["AC-P1"],
                spent=3600,
                remaining=0,
            ),
        ])

        row = next(
            row for row in report["lampsPlusDevelopment"]["rows"]
            if row["reportGrouping"] == "AC Implementation - Commerce Implementation"
        )
        self.assertEqual(row["completedHours"], 3)
        self.assertEqual(row["remainingHours"], 1)
        self.assertEqual(row["issueKeys"], ["WPM-5470", "WPM-5471"])
        self.assertEqual(row["diagnostics"]["missingPhaseLabelCount"], 0)

    def test_excludes_missing_ac_p1_label_from_totals_and_flags_diagnostic(self):
        report = build_launch_report([
            task("ACM-4", "AC Implementation - Commerce Implementation", task_type="Epic"),
            task("WPM-5471", "Counted", epic_link="ACM-4", labels=["AC-P1"], spent=3600),
            task("WPM-5472", "Excluded", epic_link="ACM-4", labels=["AC-P2"], spent=3600),
        ])

        row = next(
            row for row in report["lampsPlusDevelopment"]["rows"]
            if row["reportGrouping"] == "AC Implementation - Commerce Implementation"
        )
        self.assertEqual(row["completedHours"], 1)
        self.assertEqual(row["diagnostics"]["missingPhaseLabelCount"], 1)
        self.assertEqual(row["diagnostics"]["excludedIssueCount"], 1)

    def test_e2e_counts_closed_and_failed_qa_by_grouping(self):
        report = build_launch_report([
            task("ACE2E-33", "AC E2E - Account Management", task_type="Epic"),
            task("ACE2E-100", "Pass", epic_link="ACE2E-33", labels=["AC-P1"], status="Closed", spent=3600),
            task("ACE2E-101", "Fail", epic_link="ACE2E-33", labels=["AC-P1"], status="Failed QA", remaining=7200),
        ])

        row = next(
            row for row in report["e2eTesting"]["rows"]
            if row["reportGrouping"] == "AC E2E - Account Management"
        )
        self.assertEqual(row["passedTc"], 1)
        self.assertEqual(row["failedTc"], 1)
        self.assertEqual(row["completedHours"], 1)
        self.assertEqual(row["remainingHours"], 2)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify module is missing**

Run:

```powershell
python -m unittest tests.test_launch_report
```

Expected: fail with `ModuleNotFoundError: No module named 'services.launch_report'`.

- [ ] **Step 3: Create launch report module**

Create `services/launch_report.py` with this structure:

```python
"""Spreadsheet-parity Launch Report rollups."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from math import ceil
from typing import Iterable, Optional

from services.obsidian_sync.raw_scanner import RawTask

PHASE_LABEL = "AC-P1"

DEVELOPMENT_GROUPINGS = [
    "AC Implementation - App Builder Integration",
    "AC Implementation - Commerce Implementation",
    "AC Implementation - Edge Delivery System (EDS) Implementation",
    "AC Implementation - Misc",
    "AC Implementation - ROUND 1 E2E Bugs",
    "AC Implementation - Supporting Environment Setup",
    "AC Implementation - Tealium Integration (Phase 1)",
    "LP Implementation - Attribute Data Cleanup",
    "LP Implementation - Bloomreach - Post MVP - Misc",
    "LP Implementation - Dynamic Yield - Evaluators",
    "LP Implementation - Misc",
    "LP Implementation - Taxonomy - Batch B",
    "WUP - Azure Private Linking - Default",
    "WUP - Azure Private Linking - Ingestion",
    "WUP - Azure Private Linking - Product Data",
    "WUP - Azure Private Linking - Profile Data",
    "WUP - Azure Private Linking - Relationships",
    "WUP - Dashboard - Infrastructure",
    "WUP - Dashboard - Monitoring API Microservices",
    "WUP - Dashboard - Monitoring Near Real Time Data Syncing",
    "WUP - Dashboard - Monitoring Private Link",
    "WUP - Lighting Collections",
    "WUP - Near Real Time Data Syncing",
    "WUP - SSIS Optimization Effort for DBCLUST2",
    "WUP - SSIS Optimization Effort for DBTEST",
]

E2E_GROUPINGS = [
    "AC E2E - Account Management",
    "AC E2E - ATP",
    "AC E2E - Billing",
    "AC E2E - Card Reader",
    "AC E2E - Cart Overview",
    "AC E2E - Catalog Opt Out",
    "AC E2E - Cookie Consent",
    "AC E2E - Dynamic Yield",
    "AC E2E - Easy Post Email Templates",
    "AC E2E - Employee Tools",
    "AC E2E - Exploratory Testing",
    "AC E2E - Financial Calculators",
    "AC E2E - Gift Card",
    "AC E2E - Header & Footer",
    "AC E2E - Homepage & Navigation",
    "AC E2E - Incentivized Email",
    "AC E2E - Inventory",
    "AC E2E - Load Rules for PDP & PLA Product Panel",
    "AC E2E - MAO New Order & Order Update",
    "AC E2E - Marketing Parameters",
    "AC E2E - Order Confirmation",
    "AC E2E - Other Pages",
    "AC E2E - PDP",
    "AC E2E - Pixels",
    "AC E2E - PLP",
    "AC E2E - Resubmit Utility",
    "AC E2E - Shipping",
    "AC E2E - Stores",
    "AC E2E - Turn To",
    "AC E2E - Data Syncing",
    "AC E2E - User Session Management",
    "AC E2E - Wish List",
]


def build_launch_report(
    tasks: Iterable[RawTask],
    *,
    generated_at: Optional[datetime] = None,
) -> dict:
    rows = list(tasks)
    by_key = {task.key: task for task in rows if task.key}
    grouped = _group_tasks_by_report_grouping(rows, by_key)
    generated = generated_at or datetime.now(timezone.utc)
    development_rows = [_development_row(name, grouped.get(name, []), by_key) for name in DEVELOPMENT_GROUPINGS]
    e2e_rows = [_e2e_row(name, grouped.get(name, []), by_key) for name in E2E_GROUPINGS]
    return {
        "phase": PHASE_LABEL,
        "generatedAt": generated.isoformat(),
        "lampsPlusDevelopment": {
            "rows": development_rows,
            "totals": _totals(development_rows),
            "diagnostics": _section_diagnostics(development_rows),
        },
        "e2eTesting": {
            "rows": e2e_rows,
            "totals": _totals(e2e_rows),
            "diagnostics": _section_diagnostics(e2e_rows),
        },
    }
```

Add helper functions in the same file:

```python
def _group_tasks_by_report_grouping(tasks: list[RawTask], by_key: dict[str, RawTask]) -> dict[str, list[RawTask]]:
    grouped: dict[str, list[RawTask]] = defaultdict(list)
    for task in tasks:
        grouping = _report_grouping(task, by_key)
        if grouping:
            grouped[grouping].append(task)
    return grouped


def _report_grouping(task: RawTask, by_key: dict[str, RawTask]) -> Optional[str]:
    if task.task_type and task.task_type.lower() == "epic":
        return task.summary
    epic_key = _resolve_epic_key(task, by_key)
    if not epic_key:
        return None
    epic = by_key.get(epic_key)
    return epic.summary if epic and epic.summary else epic_key


def _resolve_epic_key(task: RawTask, by_key: dict[str, RawTask], depth: int = 0) -> Optional[str]:
    if task.epic_link:
        return task.epic_link
    if depth >= 2 or not task.parent_key:
        return None
    parent = by_key.get(task.parent_key)
    if parent is None:
        return None
    if parent.task_type and parent.task_type.lower() == "epic":
        return parent.key
    return _resolve_epic_key(parent, by_key, depth + 1)


def _phase_tasks(tasks: list[RawTask]) -> tuple[list[RawTask], list[RawTask]]:
    counted = [task for task in tasks if PHASE_LABEL in (task.labels or [])]
    excluded = [task for task in tasks if PHASE_LABEL not in (task.labels or [])]
    return counted, excluded


def _hours(seconds: int) -> int:
    return ceil(seconds / 3600) if seconds else 0


def _progress(completed: int, remaining: int) -> int:
    total = completed + remaining
    return round((completed / total) * 100) if total else 0
```

Add row builders:

```python
def _development_row(name: str, tasks: list[RawTask], by_key: dict[str, RawTask]) -> dict:
    counted, excluded = _phase_tasks(tasks)
    completed = _hours(sum(task.time_spent_seconds or 0 for task in counted))
    remaining = _hours(sum(task.remaining_estimate_seconds or 0 for task in counted))
    return {
        "reportGrouping": name,
        "epicKey": _epic_key_for_group(name, tasks, by_key),
        "phaseLabel": PHASE_LABEL,
        "status": "Complete" if remaining == 0 and completed > 0 else "Pending",
        "completedHours": completed,
        "remainingHours": remaining,
        "progressPercent": _progress(completed, remaining),
        "issueKeys": sorted(task.key for task in counted if task.key and task.key != _epic_key_for_group(name, tasks, by_key)),
        "diagnostics": _diagnostics(tasks, counted, excluded, by_key),
    }


def _e2e_row(name: str, tasks: list[RawTask], by_key: dict[str, RawTask]) -> dict:
    counted, excluded = _phase_tasks(tasks)
    completed = _hours(sum(task.time_spent_seconds or 0 for task in counted))
    remaining = _hours(sum(task.remaining_estimate_seconds or 0 for task in counted))
    return {
        "reportGrouping": name,
        "epicKey": _epic_key_for_group(name, tasks, by_key),
        "phaseLabel": PHASE_LABEL,
        "cnxOk": None,
        "passedTc": sum(1 for task in counted if (task.status or "").lower() == "closed"),
        "failedTc": sum(1 for task in counted if (task.status or "").lower() == "failed qa"),
        "completedHours": completed,
        "remainingHours": remaining,
        "progressPercent": _progress(completed, remaining),
        "doneCount": None,
        "issueKeys": sorted(task.key for task in counted if task.key and task.key != _epic_key_for_group(name, tasks, by_key)),
        "diagnostics": _diagnostics(tasks, counted, excluded, by_key),
    }
```

Add diagnostics and totals:

```python
def _epic_key_for_group(name: str, tasks: list[RawTask], by_key: dict[str, RawTask]) -> Optional[str]:
    for task in tasks:
        if task.task_type and task.task_type.lower() == "epic" and task.summary == name:
            return task.key
    for task in tasks:
        key = _resolve_epic_key(task, by_key)
        if key:
            return key
    return None


def _diagnostics(
    all_tasks: list[RawTask],
    counted: list[RawTask],
    excluded: list[RawTask],
    by_key: dict[str, RawTask],
) -> dict:
    return {
        "countedIssueCount": len([task for task in counted if not _is_epic(task)]),
        "excludedIssueCount": len([task for task in excluded if not _is_epic(task)]),
        "missingEpicLinkCount": len([task for task in all_tasks if not _is_epic(task) and not _resolve_epic_key(task, by_key)]),
        "unresolvedEpicNameCount": len([
            task for task in all_tasks
            if not _is_epic(task) and _resolve_epic_key(task, by_key) and not by_key.get(_resolve_epic_key(task, by_key))
        ]),
        "missingPhaseLabelCount": len([task for task in excluded if not _is_epic(task)]),
        "missingEstimateCount": len([
            task for task in counted
            if not _is_epic(task) and task.time_spent_seconds is None and task.remaining_estimate_seconds is None
        ]),
    }


def _is_epic(task: RawTask) -> bool:
    return bool(task.task_type and task.task_type.lower() == "epic")


def _totals(rows: list[dict]) -> dict:
    return {
        "completedHours": sum(row.get("completedHours") or 0 for row in rows),
        "remainingHours": sum(row.get("remainingHours") or 0 for row in rows),
        "passedTc": sum(row.get("passedTc") or 0 for row in rows),
        "failedTc": sum(row.get("failedTc") or 0 for row in rows),
        "rowCount": len(rows),
    }


def _section_diagnostics(rows: list[dict]) -> dict:
    keys = [
        "countedIssueCount",
        "excludedIssueCount",
        "missingEpicLinkCount",
        "unresolvedEpicNameCount",
        "missingPhaseLabelCount",
        "missingEstimateCount",
    ]
    return {
        key: sum(row["diagnostics"].get(key, 0) for row in rows)
        for key in keys
    }
```

- [ ] **Step 4: Run launch report tests**

Run:

```powershell
python -m unittest tests.test_launch_report
```

Expected: all tests pass.

- [ ] **Step 5: Run raw scanner and report tests together**

Run:

```powershell
python -m unittest tests.test_raw_scanner tests.test_launch_report
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add services/launch_report.py tests/test_launch_report.py
git commit -m "Add launch report parity rollup"
```

---

### Task 3: Wire Backend Service And API Endpoint

**Files:**
- Modify: `services/migration_dashboard_service.py`
- Modify: `routes/dashboard_api.py`

- [ ] **Step 1: Add service method**

In `services/migration_dashboard_service.py`, add this import near the other service imports:

```python
from services.launch_report import build_launch_report
```

Add this public method after `get_epic_progress()`:

```python
    def get_launch_report(self) -> dict:
        return self._cached("launch_report", lambda: build_launch_report(self._raw_tasks()))
```

- [ ] **Step 2: Add Flask route**

In `routes/dashboard_api.py`, add this route after `/api/dashboard/epic-progress`:

```python
    @bp.route("/api/dashboard/launch-report", methods=["GET"])
    def launch_report():
        if not service.is_available():
            return jsonify({"error": "vault not found"}), 404
        return jsonify(service.get_launch_report())
```

- [ ] **Step 3: Run import smoke test**

Run:

```powershell
python - <<'PY'
from app import create_app
app = create_app()
rules = sorted(str(rule) for rule in app.url_map.iter_rules())
assert "/api/dashboard/launch-report" in rules
print("launch report route registered")
PY
```

Expected: prints `launch report route registered`.

- [ ] **Step 4: Run backend unit tests**

Run:

```powershell
python -m unittest tests.test_raw_scanner tests.test_launch_report
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add services/migration_dashboard_service.py routes/dashboard_api.py
git commit -m "Expose launch report dashboard API"
```

---

### Task 4: Add Frontend Types And API Client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add TypeScript response types**

Append these types near the existing Launch Command Center types in `frontend/src/types/index.ts`:

```ts
export interface LaunchReportDiagnostics {
  countedIssueCount: number
  excludedIssueCount: number
  missingEpicLinkCount: number
  unresolvedEpicNameCount: number
  missingPhaseLabelCount: number
  missingEstimateCount: number
}

export interface LaunchReportDevelopmentRow {
  reportGrouping: string
  epicKey: string | null
  phaseLabel: string
  status: "Complete" | "Pending"
  completedHours: number
  remainingHours: number
  progressPercent: number
  issueKeys: string[]
  diagnostics: LaunchReportDiagnostics
}

export interface LaunchReportE2eRow {
  reportGrouping: string
  epicKey: string | null
  phaseLabel: string
  cnxOk: number | null
  passedTc: number
  failedTc: number
  completedHours: number
  remainingHours: number
  progressPercent: number
  doneCount: number | null
  issueKeys: string[]
  diagnostics: LaunchReportDiagnostics
}

export interface LaunchReportSection<T> {
  rows: T[]
  totals: {
    completedHours: number
    remainingHours: number
    passedTc: number
    failedTc: number
    rowCount: number
  }
  diagnostics: LaunchReportDiagnostics
}

export interface LaunchReportResponse {
  phase: string
  generatedAt: string
  lampsPlusDevelopment: LaunchReportSection<LaunchReportDevelopmentRow>
  e2eTesting: LaunchReportSection<LaunchReportE2eRow>
}
```

- [ ] **Step 2: Import type in API client**

Add `LaunchReportResponse` to the import list in `frontend/src/services/api.ts`:

```ts
  LaunchReportResponse,
```

- [ ] **Step 3: Add API client method**

Add this method near the migration dashboard API methods in `frontend/src/services/api.ts`:

```ts
  async getLaunchReport(): Promise<LaunchReportResponse> {
    return this.request("/api/dashboard/launch-report")
  }
```

- [ ] **Step 4: Run frontend type/build check**

Run:

```powershell
npm --prefix frontend run build
```

Expected: Vite build completes without TypeScript errors.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/types/index.ts frontend/src/services/api.ts
git commit -m "Add launch report frontend contract"
```

---

### Task 5: Render Launch Report Sections

**Files:**
- Create: `frontend/src/components/launch-dashboard/LaunchReportSections.tsx`
- Modify: `frontend/src/pages/LaunchDashboard.tsx`

- [ ] **Step 1: Create report sections component**

Create `frontend/src/components/launch-dashboard/LaunchReportSections.tsx`:

```tsx
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import type {
  LaunchReportDevelopmentRow,
  LaunchReportDiagnostics,
  LaunchReportE2eRow,
  LaunchReportResponse,
} from "@/types"

interface Props {
  data: LaunchReportResponse | null
}

type ExpandedKey = string | null

export function LaunchReportSections({ data }: Props) {
  const [expanded, setExpanded] = useState<ExpandedKey>(null)

  if (!data) {
    return (
      <section className="lcc-section">
        <div className="lcc-section-head">
          <span>Phase 1 Report</span>
          <small>Loading report parity data...</small>
        </div>
      </section>
    )
  }

  return (
    <section className="lcc-section" id="phase-1-report">
      <div className="lcc-section-head">
        <span>Phase 1 Report</span>
        <small>Spreadsheet row contract · {data.phase}</small>
      </div>

      <ReportTable
        title="LampsPlus Development"
        rows={data.lampsPlusDevelopment.rows}
        expanded={expanded}
        onToggle={setExpanded}
        mode="development"
      />

      <ReportTable
        title="E2E Testing"
        rows={data.e2eTesting.rows}
        expanded={expanded}
        onToggle={setExpanded}
        mode="e2e"
      />
    </section>
  )
}
```

Append the table helpers in the same file:

```tsx
function ReportTable({
  title,
  rows,
  expanded,
  onToggle,
  mode,
}: {
  title: string
  rows: Array<LaunchReportDevelopmentRow | LaunchReportE2eRow>
  expanded: ExpandedKey
  onToggle: (key: ExpandedKey) => void
  mode: "development" | "e2e"
}) {
  return (
    <div style={{ marginTop: 14, overflowX: "auto" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>{title}</h3>
      <table className="lcc-ep-table">
        <thead>
          <tr>
            <th>Grouping</th>
            {mode === "development" ? <th>Status</th> : <th>CNX OK</th>}
            {mode === "e2e" && <th>Passed TC</th>}
            {mode === "e2e" && <th>Failed TC</th>}
            <th>Completed</th>
            <th>Remaining</th>
            <th>Progress</th>
            <th>Diag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = `${mode}:${row.reportGrouping}`
            const open = expanded === key
            const hasDiagnostics = diagnosticTotal(row.diagnostics) > 0
            return (
              <>
                <tr key={key}>
                  <td>
                    <button
                      type="button"
                      onClick={() => onToggle(open ? null : key)}
                      style={iconButtonStyle}
                      aria-label={open ? "Collapse row diagnostics" : "Expand row diagnostics"}
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {row.reportGrouping}
                  </td>
                  {mode === "development" ? (
                    <td>{(row as LaunchReportDevelopmentRow).status}</td>
                  ) : (
                    <td>{formatNullable((row as LaunchReportE2eRow).cnxOk)}</td>
                  )}
                  {mode === "e2e" && <td>{(row as LaunchReportE2eRow).passedTc}</td>}
                  {mode === "e2e" && <td>{(row as LaunchReportE2eRow).failedTc}</td>}
                  <td>{row.completedHours}</td>
                  <td>{row.remainingHours}</td>
                  <td>{row.progressPercent}%</td>
                  <td>{hasDiagnostics ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}</td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={mode === "development" ? 6 : 8}>
                      <Diagnostics row={row} />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

Append diagnostics helpers:

```tsx
function Diagnostics({ row }: { row: LaunchReportDevelopmentRow | LaunchReportE2eRow }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, padding: 10 }}>
      <Diag label="Counted" value={row.diagnostics.countedIssueCount} />
      <Diag label="Excluded" value={row.diagnostics.excludedIssueCount} />
      <Diag label="Missing AC-P1" value={row.diagnostics.missingPhaseLabelCount} />
      <Diag label="Missing Epic Link" value={row.diagnostics.missingEpicLinkCount} />
      <Diag label="Unresolved Epic" value={row.diagnostics.unresolvedEpicNameCount} />
      <Diag label="Missing Estimates" value={row.diagnostics.missingEstimateCount} />
      <div style={{ gridColumn: "1 / -1", color: "var(--muted-foreground)", fontSize: 12 }}>
        {row.issueKeys.length ? row.issueKeys.join(", ") : "No counted issue keys for this row."}
      </div>
    </div>
  )
}

function Diag({ label, value }: { label: string; value: number }) {
  return (
    <span style={{ fontSize: 12 }}>
      <strong>{label}:</strong> {value}
    </span>
  )
}

function diagnosticTotal(diagnostics: LaunchReportDiagnostics) {
  return (
    diagnostics.excludedIssueCount +
    diagnostics.missingEpicLinkCount +
    diagnostics.unresolvedEpicNameCount +
    diagnostics.missingPhaseLabelCount +
    diagnostics.missingEstimateCount
  )
}

function formatNullable(value: number | null) {
  return value === null ? "—" : String(value)
}

const iconButtonStyle = {
  border: 0,
  background: "transparent",
  color: "inherit",
  display: "inline-grid",
  placeItems: "center",
  width: 24,
  height: 24,
  marginRight: 4,
  cursor: "pointer",
}
```

- [ ] **Step 2: Wire state and fetch in LaunchDashboard**

In `frontend/src/pages/LaunchDashboard.tsx`, import the component and type:

```tsx
import { LaunchReportSections } from "@/components/launch-dashboard/LaunchReportSections"
```

Add `LaunchReportResponse` to the type import list:

```tsx
  LaunchReportResponse,
```

Add state after `epicProgress`:

```tsx
  const [launchReport, setLaunchReport] = useState<LaunchReportResponse | null>(null)
```

In `loadDashboard`, after `const overview = await api.getMigrationOverview()`, fetch the report:

```tsx
      const report = await api.getLaunchReport().catch(() => null)
```

After `setEpicProgress(overview.epicProgress)`, set state:

```tsx
      setLaunchReport(report)
```

Place the report component before `<WhatChangedToday />`:

```tsx
          <LaunchReportSections data={launchReport} />
```

- [ ] **Step 3: Run frontend build**

Run:

```powershell
npm --prefix frontend run build
```

Expected: build succeeds.

- [ ] **Step 4: Start local app for visual verification**

Run backend and frontend the way this repo currently supports local dev. If no server is running:

```powershell
python app.py
```

In another terminal:

```powershell
npm --prefix frontend run dev
```

Open the Launch Dashboard and confirm:

- Phase 1 Report appears.
- LampsPlus Development and E2E Testing tables render.
- Blockers, What Changed, Daily Status, and Incidents are still present.
- Row expansion shows diagnostics and issue keys.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/launch-dashboard/LaunchReportSections.tsx frontend/src/pages/LaunchDashboard.tsx
git commit -m "Render launch report parity sections"
```

---

### Task 6: Add Workbook Comparison Validator

**Files:**
- Create: `scripts/validate_launch_report_parity.py`

- [ ] **Step 1: Create validator script**

Create `scripts/validate_launch_report_parity.py`:

```python
"""Compare Pharos launch-report output against the Adobe Commerce workbook."""

from __future__ import annotations

import argparse
import json
import urllib.request
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", required=True)
    parser.add_argument("--base-url", default="http://127.0.0.1:5000")
    args = parser.parse_args()

    workbook = read_report_rows(Path(args.workbook))
    launch_report = fetch_launch_report(args.base_url)
    result = compare(workbook, launch_report)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if result["summary"]["mappingGapRows"] or result["summary"]["dataGapRows"] else 0


def fetch_launch_report(base_url: str) -> dict:
    with urllib.request.urlopen(f"{base_url.rstrip('/')}/api/dashboard/launch-report", timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))
```

Append workbook parsing:

```python
def read_report_rows(path: Path) -> dict:
    with zipfile.ZipFile(path) as zf:
        shared = read_shared_strings(zf)
        sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))

    rows = {}
    for row in sheet.findall(".//main:row", NS):
        row_num = int(row.attrib["r"])
        values = {}
        for cell in row.findall("main:c", NS):
            ref = cell.attrib.get("r", "")
            col = "".join(ch for ch in ref if ch.isalpha())
            value = cell_value(cell, shared)
            if value != "":
                values[col] = value
        if values:
            rows[row_num] = values

    development = []
    for row_num in range(21, 65):
        row = rows.get(row_num, {})
        if row.get("B") and row.get("C") == "1":
            development.append({
                "reportGrouping": row["B"],
                "completedHours": number(row.get("E")),
                "remainingHours": number(row.get("F")),
            })

    e2e = []
    for row_num in range(21, 61):
        row = rows.get(row_num, {})
        if row.get("J") and row.get("K") == "1":
            e2e.append({
                "reportGrouping": row["J"],
                "passedTc": number(row.get("M")),
                "failedTc": number(row.get("N")),
                "completedHours": number(row.get("O")),
                "remainingHours": number(row.get("P")),
            })

    return {"lampsPlusDevelopment": development, "e2eTesting": e2e}


def read_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values = []
    for item in root.findall("main:si", NS):
        parts = [node.text or "" for node in item.findall(".//main:t", NS)]
        values.append("".join(parts))
    return values


def cell_value(cell: ET.Element, shared: list[str]) -> str:
    value = cell.find("main:v", NS)
    if value is None or value.text is None:
        return ""
    if cell.attrib.get("t") == "s":
        return shared[int(value.text)]
    return value.text


def number(value: str | None) -> int:
    if not value:
        return 0
    return int(float(value))
```

Append comparison:

```python
def compare(workbook: dict, launch_report: dict) -> dict:
    dev = compare_section(
        workbook["lampsPlusDevelopment"],
        launch_report["lampsPlusDevelopment"]["rows"],
        ["completedHours", "remainingHours"],
    )
    e2e = compare_section(
        workbook["e2eTesting"],
        launch_report["e2eTesting"]["rows"],
        ["passedTc", "failedTc", "completedHours", "remainingHours"],
    )
    rows = dev + e2e
    return {
        "summary": {
            "matchedRows": sum(1 for row in rows if row["classification"] == "matched"),
            "freshnessDriftRows": sum(1 for row in rows if row["classification"] == "freshness-drift"),
            "mappingGapRows": sum(1 for row in rows if row["classification"] == "mapping-gap"),
            "dataGapRows": sum(1 for row in rows if row["classification"] == "data-gap"),
        },
        "rows": rows,
    }


def compare_section(workbook_rows: list[dict], report_rows: list[dict], fields: list[str]) -> list[dict]:
    report_by_name = {row["reportGrouping"]: row for row in report_rows}
    out = []
    for expected in workbook_rows:
        actual = report_by_name.get(expected["reportGrouping"])
        if actual is None:
            out.append({
                "reportGrouping": expected["reportGrouping"],
                "classification": "mapping-gap",
                "reason": "row missing from launch-report response",
            })
            continue
        deltas = {
            field: {"workbook": expected.get(field, 0), "pharos": actual.get(field, 0)}
            for field in fields
            if expected.get(field, 0) != actual.get(field, 0)
        }
        diagnostic_total = sum(actual.get("diagnostics", {}).values())
        if not deltas:
            classification = "matched"
        elif diagnostic_total:
            classification = "mapping-gap"
        else:
            classification = "freshness-drift"
        out.append({
            "reportGrouping": expected["reportGrouping"],
            "classification": classification,
            "deltas": deltas,
            "diagnostics": actual.get("diagnostics", {}),
        })
    return out


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Run validator against local API**

Start the backend, then run:

```powershell
python scripts/validate_launch_report_parity.py --workbook "C:\Users\AdamB\Downloads\Adobe Commerce - Path to Launch.xlsx" --base-url http://127.0.0.1:5000
```

Expected: JSON output with row classifications. `freshness-drift` rows are acceptable when Pharos is newer than the workbook. `mapping-gap` and `data-gap` rows require investigation.

- [ ] **Step 3: Commit**

```powershell
git add scripts/validate_launch_report_parity.py
git commit -m "Add launch report parity validator"
```

---

### Task 7: Final Verification

**Files:**
- Verify all files changed in Tasks 1-6.

- [ ] **Step 1: Run backend tests**

```powershell
python -m unittest tests.test_raw_scanner tests.test_launch_report
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

```powershell
npm --prefix frontend run build
```

Expected: Vite build completes.

- [ ] **Step 3: Run local validator**

```powershell
python scripts/validate_launch_report_parity.py --workbook "C:\Users\AdamB\Downloads\Adobe Commerce - Path to Launch.xlsx" --base-url http://127.0.0.1:5000
```

Expected: JSON output classifies deltas as `matched`, `freshness-drift`, `mapping-gap`, or `data-gap`.

- [ ] **Step 4: Inspect git diff**

```powershell
git diff --stat HEAD
```

Expected: only planned backend, frontend, test, and validator files are modified.

- [ ] **Step 5: Commit final integration fixes if any were made**

```powershell
git add services frontend/src tests scripts
git commit -m "Verify launch report parity integration"
```

Skip this commit if no files changed after Task 6.
