# TestData SKU Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload the BlazeMeter `TestData/*.csv` files into Pharos and get a per-group pass/fail report confirming every SKU/page resolves to a live, in-stock page on both mcprod and www — plus a force-trimmed MoreLikeThis CSV of the first 5 passing SKUs.

**Architecture:** Stateless validator following the existing 3-layer + DI pattern. A group **registry** (derived from the JMeter assertions) maps each canonical CSV → URL template + per-site CSS readiness selector. A **PageValidator** (requests + BeautifulSoup) fetches each URL and asserts the selector is present — exactly mirroring the JMeter readiness checks. A **SkuValidationService** parses CSVs, runs validations concurrently in a background thread, and holds progress/results in in-memory run state keyed by `run_id`. No database changes. The UI is a new panel inside the existing Load Testing page.

**Tech Stack:** Python 3.11, Flask blueprints, `requests`, **`beautifulsoup4` (new dep)**, `concurrent.futures.ThreadPoolExecutor`; React 19 + TypeScript + Tailwind + shadcn/ui.

**Testing note:** This project has **no automated test suite — all testing is manual** (project rule). Verification steps therefore use `python -c` checks for pure logic, a live in-process end-to-end check for the network path, `npm run build` for the frontend typecheck, and a browser check for the UI. No test framework is introduced.

---

## File Structure

**Backend (create):**
- `services/testdata_registry.py` — group definitions (CSV → path template + selectors) + pure helpers. The single source of truth, derived from the JMX.
- `services/page_validator.py` — HTTP+HTML readiness checker (requests + bs4). One responsibility: fetch a URL, assert a selector.
- `services/sku_validation_service.py` — orchestration: parse CSVs, plan validations, run concurrently, track run state, assemble report + trimmed CSV.
- `routes/testdata_validation_api.py` — thin Flask blueprint (upload, status, trimmed download).

**Backend (modify):**
- `requirements.txt` — add `beautifulsoup4`.
- `routes/__init__.py` — import + register the new blueprint.
- `app.py` — instantiate `PageValidator` + `SkuValidationService`, pass into `register_blueprints`.

**Frontend (create):**
- `frontend/src/hooks/use-testdata-validation.ts` — start + poll hook.
- `frontend/src/components/load-testing/TestDataValidationPanel.tsx` — the UI panel.

**Frontend (modify):**
- `frontend/src/types/index.ts` — add validation result types.
- `frontend/src/services/api.ts` — add upload/status/trimmed-URL methods.
- `frontend/src/pages/LoadTesting.tsx` — render the panel.

---

### Task 1: Group registry + dependency

**Files:**
- Modify: `requirements.txt`
- Create: `services/testdata_registry.py`

- [ ] **Step 1: Add the dependency**

In `requirements.txt`, add this line after `requests==2.31.0`:

```
beautifulsoup4==4.12.3
```

- [ ] **Step 2: Install it**

Run: `pip install beautifulsoup4==4.12.3`
Expected: installs `beautifulsoup4` and `soupsieve` (the CSS-selector engine `.select` needs).

- [ ] **Step 3: Create the registry**

Create `services/testdata_registry.py`:

```python
"""TestData group registry for SKU/page validation.

Maps each canonical BlazeMeter TestData CSV to the URL it produces and the
site-specific CSS readiness selector that proves the page rendered a usable
product/listing.  Derived directly from the JMeter load-test assertions, so a
"pass" here means the corresponding JMeter readiness assertion will pass.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

# Base origins for the two environments we validate against.
SITES: dict[str, str] = {
    "mcprod": "https://mcprod.lampsplus.com",
    "www": "https://www.lampsplus.com",
}


@dataclass(frozen=True)
class GroupDef:
    """Definition of one TestData group (one CSV file)."""

    key: str
    label: str
    csv_filename: str
    path_template: str           # e.g. "/p/{v}"; {v} = column-A value
    selectors: dict[str, str]    # site key -> CSS readiness selector
    is_search_to_pdp: bool = False
    max_passing: int | None = None   # cap of passing rows to keep (MoreLikeThis = 5)


# Add-to-cart proves a PDP/SFP rendered a buyable product.
_PDP_SELECTORS = {
    "mcprod": "#product-addtocart-button",
    "www": "#pdAddToCart, #AddToCart_Multiproduct",
}
# A product listing proves a search/sort page returned results.
_LISTING_SELECTORS = {
    "mcprod": ".br-product-listing",
    "www": "#sortResultProducts .sortResultContainer",
}


GROUPS: dict[str, GroupDef] = {
    "PDP": GroupDef(
        key="PDP", label="PDP", csv_filename="PDP.csv",
        path_template="/p/{v}", selectors=dict(_PDP_SELECTORS),
    ),
    "SFP": GroupDef(
        key="SFP", label="SFP", csv_filename="SFP.csv",
        path_template="/sfp/{v}", selectors=dict(_PDP_SELECTORS),
    ),
    "MoreLikeThis": GroupDef(
        key="MoreLikeThis", label="MoreLikeThis", csv_filename="MoreLikeThis.csv",
        path_template="/more-like-this/{v}/",
        selectors={
            "mcprod": ".more-like-this-page-header",
            "www": "body#bdMoreLikeThis .jsMainContainer.moreLikeThis .sortResultContainer",
        },
        max_passing=5,
    ),
    "SearchBR": GroupDef(
        key="SearchBR", label="SearchBR", csv_filename="SearchBR.csv",
        path_template="/s/{v}", selectors=dict(_LISTING_SELECTORS),
    ),
    "SortBR": GroupDef(
        key="SortBR", label="SortBR", csv_filename="SortBR.csv",
        path_template="/s/{v}", selectors=dict(_LISTING_SELECTORS),
    ),
    "SearchToSort": GroupDef(
        key="SearchToSort", label="SearchToSort", csv_filename="SearchToSort.csv",
        path_template="/s/s_{v}/?s=1", selectors=dict(_LISTING_SELECTORS),
    ),
    "SearchToPDP": GroupDef(
        key="SearchToPDP", label="SearchToPDP", csv_filename="SearchToPDP.csv",
        path_template="",  # special-cased via search_to_pdp_api_url()
        selectors=dict(_PDP_SELECTORS), is_search_to_pdp=True,
    ),
}


def group_for_filename(filename: str) -> GroupDef | None:
    """Match an uploaded filename (case-insensitive) to a group, or None."""
    name = (filename or "").strip().lower()
    for group in GROUPS.values():
        if group.csv_filename.lower() == name:
            return group
    return None


def build_url(group: GroupDef, site_key: str, value: str) -> str:
    """Build the full URL for a column-A value (non-SearchToPDP groups)."""
    return f"{SITES[site_key]}{group.path_template.format(v=value)}"


def selector_for(group: GroupDef, site_key: str) -> str:
    """Return the readiness CSS selector for a group on a given site."""
    return group.selectors[site_key]


def search_to_pdp_api_url(site_key: str, sku: str) -> str:
    """Build the EDS search-request API URL that redirects a SKU to its PDP."""
    host = SITES[site_key].replace("https://", "")
    u = quote(f"https://{host}/s/s_{sku}/?s=1", safe="")
    r = quote(f"https://{host}/", safe="")
    return f"{SITES[site_key]}/api/v1/web/eds/search-request?u={u}&g=guest&r={r}"
```

- [ ] **Step 4: Verify the registry helpers**

Run:
```bash
python -c "from services.testdata_registry import GROUPS, build_url, group_for_filename, selector_for, search_to_pdp_api_url as api; g=group_for_filename('PDP.csv'); print(build_url(g,'mcprod','360-lighting-roxie__11p72/')); print(build_url(GROUPS['SearchToSort'],'www','11p72')); print(selector_for(GROUPS['PDP'],'www')); print(api('mcprod','11p72')); print(group_for_filename('nope.csv'))"
```
Expected output:
```
https://mcprod.lampsplus.com/p/360-lighting-roxie__11p72/
https://www.lampsplus.com/s/s_11p72/?s=1
#pdAddToCart, #AddToCart_Multiproduct
https://mcprod.lampsplus.com/api/v1/web/eds/search-request?u=https%3A%2F%2Fmcprod.lampsplus.com%2Fs%2Fs_11p72%2F%3Fs%3D1&g=guest&r=https%3A%2F%2Fmcprod.lampsplus.com%2F
None
```

- [ ] **Step 5: Commit**

```bash
git add requirements.txt services/testdata_registry.py
git commit -m "feat: add TestData group registry + beautifulsoup4 dep"
```

---

### Task 2: Page validator

**Files:**
- Create: `services/page_validator.py`

- [ ] **Step 1: Create the validator**

Create `services/page_validator.py`:

```python
"""HTTP page validator.

Fetches a URL server-side (following redirects) and confirms a CSS readiness
selector is present in the returned HTML — the same assertion the JMeter load
test makes.  Pure I/O; holds no state beyond a reusable requests session.
"""

from __future__ import annotations

import logging
import re

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Matches the EDS API's {"redirected_url": "https://host/path..."} and
# captures the path portion (everything after the host).
_REDIRECT_RE = re.compile(r'"redirected_url"\s*:\s*"https://[^/]+([^"]+)"')

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 Pharos-TestData-Validator"
)


class PageValidator:
    """Validate that a page returns 200 and contains a readiness selector."""

    _TIMEOUT_SECONDS: int = 20

    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": _USER_AGENT})

    def validate_selector(self, url: str, selector: str) -> tuple[bool, str, str]:
        """Fetch ``url`` and check ``selector`` is present.

        Returns ``(ok, reason, final_url)``.
        """
        try:
            resp = self._session.get(
                url, timeout=self._TIMEOUT_SECONDS, allow_redirects=True,
            )
        except requests.exceptions.RequestException as exc:
            return (False, f"request failed: {exc}", url)

        final_url = resp.url
        if resp.status_code != 200:
            return (False, f"HTTP {resp.status_code} (missing)", final_url)

        soup = BeautifulSoup(resp.text, "html.parser")
        if soup.select_one(selector) is not None:
            return (True, "ok", final_url)
        return (
            False,
            "readiness selector not found (unavailable / out-of-stock)",
            final_url,
        )

    def resolve_search_to_pdp(
        self, api_url: str, base_url: str, selector: str,
    ) -> tuple[bool, str, str]:
        """Resolve the SearchToPDP redirect API then validate the final PDP."""
        try:
            resp = self._session.get(
                api_url, timeout=self._TIMEOUT_SECONDS, allow_redirects=True,
            )
        except requests.exceptions.RequestException as exc:
            return (False, f"search API request failed: {exc}", api_url)

        if resp.status_code != 200:
            return (False, f"search API HTTP {resp.status_code}", resp.url)

        match = _REDIRECT_RE.search(resp.text)
        if match is None:
            return (False, "no redirect (SKU not found)", api_url)

        pdp_url = f"{base_url}{match.group(1)}"
        return self.validate_selector(pdp_url, selector)
```

- [ ] **Step 2: Verify against live www (structural, stock-independent)**

Run:
```bash
python -c "from services.page_validator import PageValidator; v=PageValidator(); print(v.validate_selector('https://www.lampsplus.com/','body')); print(v.validate_selector('https://www.lampsplus.com/p/definitely-not-a-real-product__zzzzz999/','#pdAddToCart'))"
```
Expected: first tuple is `(True, 'ok', ...)` (homepage returns 200 and has a `<body>`); second tuple is `(False, ...)` — either `HTTP 404 (missing)` or `readiness selector not found ...`. This proves the fetch + selector path works regardless of current stock.

- [ ] **Step 3: Commit**

```bash
git add services/page_validator.py
git commit -m "feat: add PageValidator (requests + bs4 readiness check)"
```

---

### Task 3: Validation service

**Files:**
- Create: `services/sku_validation_service.py`

**Design note:** MoreLikeThis is validated in full (all rows, both sites) and the trimmed CSV keeps the **first 5 that passed both sites in CSV order**. (This is the "first 5 that pass" decision, implemented as validate-all-then-pick rather than stop-early, so the report is complete and progress is deterministic.)

- [ ] **Step 1: Create the service**

Create `services/sku_validation_service.py`:

```python
"""SKU/page validation orchestration.

Parses uploaded TestData CSVs, builds validation URLs from the group registry,
runs them concurrently against the selected sites, and tracks progress +
results in in-memory run state keyed by ``run_id``.  No database.
"""

from __future__ import annotations

import csv
import io
import logging
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor

from services.page_validator import PageValidator
from services.testdata_registry import (
    GROUPS,
    SITES,
    GroupDef,
    build_url,
    group_for_filename,
    search_to_pdp_api_url,
    selector_for,
)

logger = logging.getLogger(__name__)


def parse_column_a(file_bytes: bytes) -> list[str]:
    """Extract trimmed, non-empty column-A values from CSV bytes.

    TestData CSVs have no header row (JMeter ``ignoreFirstLine=false``) and use
    a comma delimiter; only the first field of each row is significant.
    """
    text = file_bytes.decode("utf-8-sig", errors="replace")
    values: list[str] = []
    for row in csv.reader(io.StringIO(text)):
        if not row:
            continue
        value = row[0].strip()
        if value:
            values.append(value)
    return values


class SkuValidationService:
    """Coordinates CSV parsing and concurrent page validation."""

    def __init__(self, validator: PageValidator, max_workers: int = 5) -> None:
        self._validator = validator
        self._max_workers = max_workers
        self._runs: dict[str, dict] = {}
        self._lock = threading.Lock()

    # -- public API ----------------------------------------------------

    def start(self, files: list[tuple[str, bytes]], site_keys: list[str]) -> dict:
        """Parse files, launch background validation, return initial public state."""
        site_keys = [s for s in site_keys if s in SITES] or list(SITES.keys())

        groups_state: dict[str, dict] = {}
        plan: list[tuple[str, GroupDef, str, str]] = []  # (group_key, group, site_key, value)
        unrecognized: list[str] = []

        for filename, raw in files:
            group = group_for_filename(filename)
            if group is None:
                unrecognized.append(filename)
                continue
            values = parse_column_a(raw)
            groups_state[group.key] = {
                "key": group.key,
                "label": group.label,
                "filename": group.csv_filename,
                "total_rows": len(values),
                "entries": [],
                "trimmed_csv": None,
                "note": None,
            }
            for value in values:
                for site_key in site_keys:
                    plan.append((group.key, group, site_key, value))

        run_id = uuid.uuid4().hex
        state = {
            "run_id": run_id,
            "status": "running",
            "site_keys": site_keys,
            "total": len(plan),
            "completed": 0,
            "groups": groups_state,
            "unrecognized": unrecognized,
            "error": None,
        }
        with self._lock:
            self._runs[run_id] = state

        threading.Thread(target=self._run, args=(run_id, plan), daemon=True).start()
        return self._public_view(state)

    def get(self, run_id: str) -> dict | None:
        with self._lock:
            state = self._runs.get(run_id)
            return self._public_view(state) if state else None

    def get_trimmed_csv(self, run_id: str, group_key: str) -> str | None:
        with self._lock:
            state = self._runs.get(run_id)
            if not state:
                return None
            group_state = state["groups"].get(group_key)
            return group_state.get("trimmed_csv") if group_state else None

    # -- internals -----------------------------------------------------

    def _run(self, run_id: str, plan: list[tuple[str, GroupDef, str, str]]) -> None:
        try:
            # (group_key, value) -> { site_key -> {ok, reason, final_url} }
            results: dict[tuple[str, str], dict[str, dict]] = {}

            def validate_one(item: tuple[str, GroupDef, str, str]):
                group_key, group, site_key, value = item
                ok, reason, final_url = self._validate(group, site_key, value)
                return (group_key, value, site_key, ok, reason, final_url)

            with ThreadPoolExecutor(max_workers=self._max_workers) as pool:
                for group_key, value, site_key, ok, reason, final_url in pool.map(
                    validate_one, plan,
                ):
                    bucket = results.setdefault((group_key, value), {})
                    bucket[site_key] = {"ok": ok, "reason": reason, "final_url": final_url}
                    with self._lock:
                        self._runs[run_id]["completed"] += 1

            self._assemble(run_id, results)
            with self._lock:
                self._runs[run_id]["status"] = "complete"
        except Exception as exc:  # noqa: BLE001 - background-thread guard
            logger.exception("SKU validation run %s failed", run_id)
            with self._lock:
                self._runs[run_id]["status"] = "error"
                self._runs[run_id]["error"] = str(exc)

    def _validate(self, group: GroupDef, site_key: str, value: str) -> tuple[bool, str, str]:
        selector = selector_for(group, site_key)
        if group.is_search_to_pdp:
            api_url = search_to_pdp_api_url(site_key, value)
            return self._validator.resolve_search_to_pdp(api_url, SITES[site_key], selector)
        return self._validator.validate_selector(build_url(group, site_key, value), selector)

    def _assemble(self, run_id: str, results: dict) -> None:
        with self._lock:
            state = self._runs[run_id]
            site_keys = state["site_keys"]
            grouped: dict[str, list[dict]] = {}
            for (group_key, value), site_map in results.items():
                entry_ok = all(site_map.get(s, {}).get("ok") for s in site_keys)
                grouped.setdefault(group_key, []).append({
                    "value": value,
                    "ok": entry_ok,
                    "sites": site_map,
                })
            for group_key, entries in grouped.items():
                group_state = state["groups"][group_key]
                group_state["entries"] = entries
                group = GROUPS[group_key]
                if group.max_passing is not None:
                    self._apply_trim(group, group_state, entries)

    def _apply_trim(self, group: GroupDef, group_state: dict, entries: list[dict]) -> None:
        passing = [e["value"] for e in entries if e["ok"]]
        kept = passing[: group.max_passing]
        group_state["trimmed_csv"] = "\n".join(kept) + ("\n" if kept else "")
        if len(kept) < group.max_passing:
            group_state["note"] = (
                f"Only {len(kept)} of {len(entries)} passed — cannot reach "
                f"{group.max_passing}."
            )
        else:
            group_state["note"] = (
                f"Trimmed to first {group.max_passing} passing SKUs "
                f"(of {len(entries)} rows)."
            )

    @staticmethod
    def _public_view(state: dict) -> dict:
        groups: dict[str, dict] = {}
        for key, g in state["groups"].items():
            overall = all(e["ok"] for e in g["entries"]) if g["entries"] else None
            groups[key] = {
                "key": g["key"],
                "label": g["label"],
                "filename": g["filename"],
                "totalRows": g["total_rows"],
                "entries": g["entries"],
                "note": g["note"],
                "hasTrimmed": g["trimmed_csv"] is not None,
                "allPassed": overall,
            }
        return {
            "runId": state["run_id"],
            "status": state["status"],
            "siteKeys": state["site_keys"],
            "total": state["total"],
            "completed": state["completed"],
            "groups": groups,
            "unrecognized": state["unrecognized"],
            "error": state["error"],
        }
```

- [ ] **Step 2: Verify CSV parsing (pure)**

Run:
```bash
python -c "from services.sku_validation_service import parse_column_a; print(parse_column_a(b'360__11p72/\n53X97\n\n  spaced  \ns_bathroom-vanity-lights/?sp=b\n'))"
```
Expected: `['360__11p72/', '53X97', 'spaced', 's_bathroom-vanity-lights/?sp=b']`

- [ ] **Step 3: Verify the trim picks first 5 passing (pure)**

Run:
```bash
python -c "from services.sku_validation_service import SkuValidationService; from services.testdata_registry import GROUPS; s=SkuValidationService(validator=None); gs={'trimmed_csv':None,'note':None}; entries=[{'value':f's{i}','ok':(i%2==0)} for i in range(12)]; s._apply_trim(GROUPS['MoreLikeThis'], gs, entries); print(repr(gs['trimmed_csv'])); print(gs['note'])"
```
Expected:
```
's0\ns2\ns4\ns6\ns8\n'
Trimmed to first 5 passing SKUs (of 12 rows).
```

- [ ] **Step 4: Commit**

```bash
git add services/sku_validation_service.py
git commit -m "feat: add SkuValidationService (parse, concurrent validate, trim)"
```

---

### Task 4: Routes + DI wiring

**Files:**
- Create: `routes/testdata_validation_api.py`
- Modify: `routes/__init__.py`
- Modify: `app.py`

- [ ] **Step 1: Create the blueprint**

Create `routes/testdata_validation_api.py`:

```python
"""TestData SKU validation blueprint.

Thin route layer: accepts CSV uploads, kicks off validation, exposes run
status, and serves the trimmed CSV download.
"""

from __future__ import annotations

from flask import Blueprint, Response, jsonify, request

from exceptions import ValidationError
from services.sku_validation_service import SkuValidationService


def create_testdata_validation_blueprint(
    service: SkuValidationService,
) -> Blueprint:
    bp = Blueprint("testdata_validation_api", __name__)

    @bp.post("/api/testdata/validate")
    def validate():
        files = request.files.getlist("files")
        if not files:
            raise ValidationError("At least one CSV file is required")
        sites = request.form.getlist("sites") or ["mcprod", "www"]
        parsed = [(f.filename or "upload.csv", f.read()) for f in files]
        state = service.start(parsed, sites)
        return jsonify(state), 202

    @bp.get("/api/testdata/validate/<run_id>")
    def status(run_id: str):
        state = service.get(run_id)
        if state is None:
            raise ValidationError("Unknown validation run")
        return jsonify(state)

    @bp.get("/api/testdata/validate/<run_id>/trimmed/<group_key>")
    def trimmed(run_id: str, group_key: str):
        csv_text = service.get_trimmed_csv(run_id, group_key)
        if csv_text is None:
            raise ValidationError("No trimmed CSV available for this group")
        return Response(
            csv_text,
            mimetype="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{group_key}.csv"'},
        )

    return bp
```

- [ ] **Step 2: Register the blueprint**

In `routes/__init__.py`:

(a) Add the blueprint import alongside the other `from routes.* import ...` lines (after the `from routes.testing_api import create_testing_blueprint` line):

```python
from routes.testdata_validation_api import create_testdata_validation_blueprint
```

(b) Add the service import alongside the other `from services.* import ...` lines (after `from services.testing_service import TestingService`):

```python
from services.sku_validation_service import SkuValidationService
```

(c) Add a parameter to `register_blueprints(...)` — place it after the `autofix_pipeline_ids: "list | None" = None,` parameter:

```python
    sku_validation_service: "SkuValidationService | None" = None,
```

(d) Register it — add this block at the end of the function body (after the `vault_git_service` block):

```python
    if sku_validation_service is not None:
        app.register_blueprint(
            create_testdata_validation_blueprint(sku_validation_service)
        )
```

- [ ] **Step 3: Wire it in the app factory**

In `app.py`, immediately after the line `testing_service = TestingService(pagespeed, url_repo, test_result_repo)` (currently ~line 223), insert:

```python

    # ---- TestData SKU validation (no external creds; validates public sites) ----
    from services.page_validator import PageValidator
    from services.sku_validation_service import SkuValidationService

    sku_validation_service = SkuValidationService(PageValidator())
```

Then in the `register_blueprints(...)` call (currently ~line 526), add this argument right after `autofix_pipeline_ids=AUTOFIX_PIPELINE_IDS,`:

```python
        sku_validation_service=sku_validation_service,
```

- [ ] **Step 4: Verify the app wires up cleanly**

Run:
```bash
python -c "from app import create_app; create_app(); print('app OK')"
```
Expected: ends with `app OK` and no import/registration errors.

- [ ] **Step 5: Verify end-to-end in-process (live www, one SFP SKU)**

Run:
```bash
python -c "import time; from services.page_validator import PageValidator; from services.sku_validation_service import SkuValidationService; s=SkuValidationService(PageValidator()); st=s.start([('SFP.csv', b'11p72\n')], ['www']); rid=st['runId']; [time.sleep(1) for _ in range(20) if s.get(rid)['status']=='running']; v=s.get(rid); print('status:', v['status']); print('completed:', v['completed'], '/', v['total']); print('entries:', v['groups']['SFP']['entries'])"
```
Expected: `status: complete`, `completed: 1 / 1`, and one entry for `11p72` with an `ok` boolean and per-site result for `www` (PASS or FAIL with a reason — either proves the pipeline ran end-to-end).

- [ ] **Step 6: Commit**

```bash
git add routes/testdata_validation_api.py routes/__init__.py app.py
git commit -m "feat: wire TestData validation blueprint + service into app"
```

---

### Task 5: Frontend types + API client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add the result types**

Append to `frontend/src/types/index.ts`:

```typescript
export type ValidationSiteKey = "mcprod" | "www"

export interface TestDataSiteResult {
  ok: boolean
  reason: string
  final_url: string
}

export interface TestDataEntry {
  value: string
  ok: boolean
  sites: Partial<Record<ValidationSiteKey, TestDataSiteResult>>
}

export interface TestDataGroupResult {
  key: string
  label: string
  filename: string
  totalRows: number
  entries: TestDataEntry[]
  note: string | null
  hasTrimmed: boolean
  allPassed: boolean | null
}

export interface TestDataValidationRun {
  runId: string
  status: "running" | "complete" | "error"
  siteKeys: ValidationSiteKey[]
  total: number
  completed: number
  groups: Record<string, TestDataGroupResult>
  unrecognized: string[]
  error: string | null
}
```

- [ ] **Step 2: Import the new types in `api.ts`**

In `frontend/src/services/api.ts`, inside the existing `import type { ... } from "@/types"` block (ends at line ~78), add these two names to the list:

```typescript
  TestDataValidationRun,
  ValidationSiteKey,
```

- [ ] **Step 3: Add the API methods**

In `frontend/src/services/api.ts`, add these three methods to the `ApiClient` class, immediately before the closing `}` of the class (just before `export const api = new ApiClient()`):

```typescript
  // ---------- TestData SKU validation ----------

  async startTestDataValidation(
    files: File[],
    sites: ValidationSiteKey[],
  ): Promise<TestDataValidationRun> {
    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))
    sites.forEach((site) => formData.append("sites", site))
    const response = await fetch(`${this.baseUrl}/api/testdata/validate`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Request failed: ${response.status}`)
    }
    return response.json()
  }

  async getTestDataValidation(runId: string): Promise<TestDataValidationRun> {
    return this.request<TestDataValidationRun>(`/api/testdata/validate/${runId}`)
  }

  testDataTrimmedUrl(runId: string, groupKey: string): string {
    return `${this.baseUrl}/api/testdata/validate/${runId}/trimmed/${groupKey}`
  }
```

- [ ] **Step 4: Verify the typecheck passes**

Run: `cd frontend && npm run build`
Expected: build succeeds (no TypeScript errors). The new types/methods compile even though nothing calls them yet.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/api.ts
git commit -m "feat: add TestData validation types + API client methods"
```

---

### Task 6: Frontend hook, panel, and page integration

**Files:**
- Create: `frontend/src/hooks/use-testdata-validation.ts`
- Create: `frontend/src/components/load-testing/TestDataValidationPanel.tsx`
- Modify: `frontend/src/pages/LoadTesting.tsx`

- [ ] **Step 1: Create the polling hook**

Create `frontend/src/hooks/use-testdata-validation.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/services/api"
import type { TestDataValidationRun, ValidationSiteKey } from "@/types"

export function useTestDataValidation() {
  const [run, setRun] = useState<TestDataValidationRun | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const stopPolling = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const start = useCallback(
    async (files: File[], sites: ValidationSiteKey[]) => {
      setError(null)
      setBusy(true)
      try {
        const initial = await api.startTestDataValidation(files, sites)
        setRun(initial)
        stopPolling()
        timer.current = window.setInterval(async () => {
          try {
            const next = await api.getTestDataValidation(initial.runId)
            setRun(next)
            if (next.status !== "running") {
              stopPolling()
              setBusy(false)
            }
          } catch (e) {
            stopPolling()
            setBusy(false)
            setError(e instanceof Error ? e.message : "Polling failed")
          }
        }, 1500)
      } catch (e) {
        setBusy(false)
        setError(e instanceof Error ? e.message : "Validation failed to start")
      }
    },
    [stopPolling],
  )

  useEffect(() => stopPolling, [stopPolling])

  return { run, busy, error, start }
}
```

- [ ] **Step 2: Create the panel component**

Create `frontend/src/components/load-testing/TestDataValidationPanel.tsx`:

```tsx
import { useMemo, useState } from "react"
import { CheckCircle2, XCircle, Upload, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/services/api"
import { useTestDataValidation } from "@/hooks/use-testdata-validation"
import type { TestDataGroupResult, ValidationSiteKey } from "@/types"

const ALL_SITES: ValidationSiteKey[] = ["mcprod", "www"]

export function TestDataValidationPanel() {
  const { run, busy, error, start } = useTestDataValidation()
  const [files, setFiles] = useState<File[]>([])
  const [sites, setSites] = useState<ValidationSiteKey[]>([...ALL_SITES])

  const toggleSite = (s: ValidationSiteKey) =>
    setSites((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const groups = useMemo(() => (run ? Object.values(run.groups) : []), [run])
  const pct = run && run.total > 0 ? Math.round((run.completed / run.total) * 100) : 0

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">TestData SKU validation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the BlazeMeter <code>TestData/*.csv</code> files to confirm every SKU resolves to a
          live, in-stock page on mcprod and www before you run a load test.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          <Upload className="h-4 w-4" />
          {files.length > 0 ? `${files.length} file(s) selected` : "Choose CSV files"}
          <input
            type="file"
            multiple
            accept=".csv"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        {ALL_SITES.map((s) => (
          <label key={s} className="inline-flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={sites.includes(s)} onChange={() => toggleSite(s)} />
            {s}
          </label>
        ))}

        <Button
          size="sm"
          disabled={busy || files.length === 0 || sites.length === 0}
          onClick={() => void start(files, sites)}
          style={{ color: "#000" }}
        >
          {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Validate
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

      {run ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {run.completed}/{run.total} ({run.status})
            </span>
          </div>

          {run.unrecognized.length > 0 ? (
            <p className="text-sm text-amber-500">
              Unrecognized files (skipped): {run.unrecognized.join(", ")}
            </p>
          ) : null}

          {groups.map((g) => (
            <GroupCard key={g.key} group={g} runId={run.runId} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function GroupCard({ group, runId }: { group: TestDataGroupResult; runId: string }) {
  const failing = group.entries.filter((e) => !e.ok)
  const badge =
    group.allPassed === null ? (
      <Badge variant="outline">pending</Badge>
    ) : group.allPassed ? (
      <Badge variant="outline" className="gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> all good
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1.5">
        <XCircle className="h-3.5 w-3.5 text-red-500" /> {failing.length} failing
      </Badge>
    )

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{group.label}</span>
          {badge}
          <span className="text-xs text-muted-foreground">{group.totalRows} rows</span>
        </div>
        {group.hasTrimmed ? (
          <a href={api.testDataTrimmedUrl(runId, group.key)} download>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-3.5 w-3.5" /> Trimmed CSV
            </Button>
          </a>
        ) : null}
      </div>

      {group.note ? <p className="mt-1 text-xs text-muted-foreground">{group.note}</p> : null}

      {failing.length > 0 ? (
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3">Value</th>
              <th className="py-1 pr-3">Site</th>
              <th className="py-1 pr-3">Reason</th>
              <th className="py-1">URL</th>
            </tr>
          </thead>
          <tbody>
            {failing.flatMap((e) =>
              Object.entries(e.sites)
                .filter(([, r]) => r && !r.ok)
                .map(([site, r]) => (
                  <tr key={`${e.value}-${site}`} className="border-t border-border">
                    <td className="py-1 pr-3 font-mono">{e.value}</td>
                    <td className="py-1 pr-3">{site}</td>
                    <td className="py-1 pr-3">{r!.reason}</td>
                    <td className="py-1">
                      <a
                        className="text-blue-400 underline"
                        href={r!.final_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        open
                      </a>
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Render the panel in LoadTesting**

In `frontend/src/pages/LoadTesting.tsx`:

(a) Add the import after the existing `import { BlazemeterMasterReportPanel } ...` line (~line 46):

```typescript
import { TestDataValidationPanel } from "@/components/load-testing/TestDataValidationPanel"
```

(b) Render the panel as the first section inside the `<div className="mx-3 mt-3 space-y-3">` container — insert it immediately before the `{/* ---------- Config status ---------- */}` comment (~line 597):

```tsx
        <TestDataValidationPanel />

```

- [ ] **Step 4: Verify the typecheck/build passes**

Run: `cd frontend && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Verify in the browser**

Start the backend (serves the built frontend at `/`): `python app.py`
Open the app and navigate to the Load Testing page (`/load-testing`). Confirm:
- The "TestData SKU validation" panel appears above the BlazeMeter configuration section.
- Choosing a real `PDP.csv` (or `SFP.csv`), leaving both site checkboxes on, and clicking **Validate** shows a progress bar that advances, then per-group cards with green/red badges.
- A bad SKU shows a red badge with a failing-entries table (value · site · reason · URL).
- Uploading `MoreLikeThis.csv` shows a "Trimmed to first 5 passing SKUs" note and a **Trimmed CSV** download button that downloads a 5-line file.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/use-testdata-validation.ts frontend/src/components/load-testing/TestDataValidationPanel.tsx frontend/src/pages/LoadTesting.tsx
git commit -m "feat: add TestData SKU validation panel to Load Testing page"
```

---

## Self-Review

**Spec coverage:**
- Upload TestData CSVs → Task 4 (route) + Task 6 (dropzone). ✓
- Validate SKUs good / not out-of-stock / not missing → Task 2 (HTTP 200 + readiness selector). ✓
- Both mcprod + www → registry per-site selectors (Task 1) + plan loops both sites (Task 3). ✓
- Report green, or list which are bad + why → `_public_view` allPassed + failing entries table (Tasks 3, 6). ✓
- SearchToPDP via redirect API + add-to-cart only → `resolve_search_to_pdp` (Task 2), no SKU-match. ✓
- MoreLikeThis force-trim to first 5 passing + downloadable → `_apply_trim` + trimmed route (Tasks 3, 4, 6). ✓
- Inside Load Testing tab → Task 6 renders panel in `LoadTesting.tsx`. ✓
- No DB schema changes → in-memory run state only. ✓
- New dep beautifulsoup4 → Task 1. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code; every verify step has a concrete command + expected output.

**Type consistency:** `GroupDef`, `build_url`, `selector_for`, `search_to_pdp_api_url`, `parse_column_a`, `validate_selector`, `resolve_search_to_pdp`, `start`/`get`/`get_trimmed_csv`, and the public-view keys (`runId`, `groups`, `entries`, `allPassed`, `hasTrimmed`, `totalRows`, `final_url`) match between backend producers and the frontend `TestDataValidationRun`/`TestDataGroupResult`/`TestDataEntry` types.

## Out of scope (Phase 2)
Lighthouse grouped testing of these URLs and per-group averaging of FCP/LCP/CLS/TBT/Speed Index; coordinated BlazeMeter+Lighthouse runs; pushing verified CSVs back to BlazeMeter. Tracked in the design spec.
