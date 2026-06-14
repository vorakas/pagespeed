# TestData SKU Validation — Design Spec (Phase 1)

**Date:** 2026-06-13
**Status:** Approved for planning
**Scope:** Phase 1 only — CSV upload + SKU/page validation with a pass/fail report. Lighthouse grouping + per-group metric averaging is **Phase 2** (out of scope here).

## Problem

The Load Testing (BlazeMeter / JMeter) workflow depends on `TestData/*.csv` files whose entries (SKUs, search strings, URL fragments) must resolve to live, in-stock product pages. Today there is no way to confirm those entries are still good before a load test runs — a stale/out-of-stock SKU silently fails the JMeter assertions mid-test.

**Goal:** Let a user upload the TestData CSVs into Pharos, validate every entry against both sites, and get a clear report — green if all good, otherwise a list of which entries are bad and why. The user manually fixes the CSVs and uploads them to BlazeMeter (no BlazeMeter wiring in Phase 1).

## Approach (chosen)

**Stateless validator** — new page region inside the Load Testing tab, a new Flask blueprint, and a validation service. No database schema changes. Uploaded CSV bytes are parsed in memory; validation runs in a background thread with progress polling; results and the trimmed MoreLikeThis file live in in-memory run state keyed by `run_id` (same pattern as the BlazeMeter queue snapshot / the `useBatchTest` hook).

Rejected alternatives: persisting validation runs to the DB (no current need for history — YAGNI); reusing the `urls`/`test_results` tables (conflates page-validity with PageSpeed scoring; URL grouping belongs to Phase 2).

## Validation fidelity

JMeter's readiness checks are JSoup **CSS-selector** assertions against **server-rendered HTML** (JMeter runs no JS). A plain `requests.get` (follow redirects) + `BeautifulSoup.select(selector)` reproduces those assertions exactly. Therefore a "green" in Pharos means the corresponding JMeter assertion will pass. Following redirects + asserting the selector is what catches a missing SKU that soft-redirects to a 200 "not found" page (no add-to-cart button present → fail).

mcprod is publicly reachable — **no auth/credentials required**.

## Group registry (the heart)

A single backend config object, derived from the two JMX scripts. Maps each canonical CSV → group definition:

| Group | CSV file | Path built from column A | mcprod selector | www selector |
|---|---|---|---|---|
| PDP | `PDP.csv` | `/p/{v}` | `#product-addtocart-button` | `#pdAddToCart` / `#AddToCart_Multiproduct` |
| SFP | `SFP.csv` | `/sfp/{v}` | `#product-addtocart-button` | `#pdAddToCart` |
| MoreLikeThis | `MoreLikeThis.csv` | `/more-like-this/{v}/` | `.more-like-this-page-header` | `body#bdMoreLikeThis .jsMainContainer.moreLikeThis .sortResultContainer` |
| SearchBR | `SearchBR.csv` | `/s/{v}` | `.br-product-listing` | `#sortResultProducts .sortResultContainer` |
| SortBR | `SortBR.csv` | `/s/{v}` | `.br-product-listing` | `#sortResultProducts .sortResultContainer` |
| SearchToSort | `SearchToSort.csv` | `/s/s_{v}/?s=1` | `.br-product-listing` | `#sortResultProducts .sortResultContainer` |
| SearchToPDP | `SearchToPDP.csv` | API redirect (see below) | `#product-addtocart-button` | `#pdAddToCart` |

- `{v}` = column A value, concatenated as-is (column A already carries trailing slash / query where applicable, e.g. PDP `…__11p72/`, SearchBR `s_bathroom-vanity-lights/?sp=b`).
- Sites: `https://mcprod.lampsplus.com` and `https://www.lampsplus.com`.
- Filename → group is auto-detected from canonical names; an unrecognized filename lets the user assign the group manually in the UI.

## Validation flow (per entry, per site)

Both sites must be validated. An entry is **green only if it passes on both selected sites.**

1. Build `https://{site}{path}`.
2. `GET` with a browser-like `User-Agent`, follow redirects, request timeout.
3. HTTP status ≠ 200 → **FAIL: "missing" (HTTP {code})**.
4. Parse HTML; `soup.select(selector)` empty → **FAIL: "unavailable / out-of-stock"** (page rendered, no product/add-to-cart).
5. **SearchToPDP special handling:**
   a. `GET /api/v1/web/eds/search-request?u=https%3A%2F%2F{site}%2Fs%2Fs_{sku}%2F%3Fs%3D1&g=guest&r=https%3A%2F%2F{site}%2F`
   b. Regex-extract `redirected_url` (`"redirected_url"\s*:\s*"https://[^/]+([^"]+)"`); absent → **FAIL: "SKU not found"**.
   c. `GET` the redirected PDP path; assert HTTP 200 + the site's add-to-cart selector present.
   d. **SKU-match check is NOT required** (add-to-cart presence is sufficient — per decision).

## Backend (3-layer + DI, no schema change)

- `enums.py` — add `TestDataGroup`, `ValidationSite`.
- `services/testdata_registry.py` — the group registry (path templates + per-site selectors + helpers: `build_url(group, site, value)`, `selector_for(group, site)`, `group_for_filename(name)`).
- `services/page_validator.py` — external-IO client built on `requests` + `beautifulsoup4`: `validate(url, selector) -> (ok, reason, final_url)`; `resolve_search_to_pdp(sku, site) -> (ok, reason, final_url)`. Sibling to `pagespeed_client.py`. Follows redirects, browser UA, timeout, single retry on timeout/5xx.
- `services/sku_validation_service.py` — orchestrates: parse uploaded CSVs (stdlib `csv`, column A; handle optional header row), build entry list, run batch with a small thread pool + modest rate limit, track progress in in-memory run state, assemble the report, and generate the trimmed MoreLikeThis CSV.
- `routes/testdata_validation_api.py` — blueprint:
  - `POST /api/testdata/validate` — multipart `files[]` + `sites[]`; returns `run_id`; starts background validation.
  - `GET /api/testdata/validate/<run_id>` — progress + per-group results.
  - `GET /api/testdata/validate/<run_id>/trimmed/<group>` — download trimmed CSV (MoreLikeThis).
  - Wired in `app.py` (DI) + registered in `routes/__init__.py`.
- **New dependency:** `beautifulsoup4` added to `requirements.txt`.

### Concurrency / politeness
Small thread pool (≈4–5 concurrent) + brief inter-request delay and a browser `User-Agent`, to avoid hammering or being throttled by the public sites. Single retry on timeout/5xx (reuse the `pagespeed_client` pattern).

## Frontend (Aurora conventions, inside Load Testing tab)

Lives as a section/sub-area within `frontend/src/pages/LoadTesting.tsx` (not a new top-level page).

- Multi-file CSV dropzone (accept `.csv`); auto-maps canonical filenames to groups; unknown filename → group dropdown.
- Site checkboxes: mcprod + www (both checked by default).
- "Validate" button → `POST` → poll status; progress bar (X / Y entries).
- Report: one card per group with a green/red badge; all-green = prominent check. Failing entries expand into a table: `value · site · reason · final URL (link)`.
- MoreLikeThis card: shows "trimmed N→5" note + **Download trimmed CSV** button.
- `useTestDataValidation` hook (mirrors `useBatchTest`) + `api.ts` additions.

## MoreLikeThis trim rule

Validate `MoreLikeThis.csv` entries top-down (both sites) and collect the **first 5 that PASS validation**; the trimmed downloadable file contains exactly those 5 passing SKUs. If fewer than 5 pass, report the shortfall (e.g. "only 3 of N passed — cannot reach 5"). Non-selected / dropped rows are noted in the report.

## Out of scope (Phase 2)

- Turning CSV entries into grouped URLs in the catalog and running Lighthouse on them.
- Per-group averaging of FCP, LCP, CLS, TBT, Speed Index.
- Coordinated/simultaneous BlazeMeter + Lighthouse runs.
- Pushing verified CSVs back into BlazeMeter.

## Success criteria

1. Uploading the 7 TestData CSVs and clicking Validate produces a per-group pass/fail report covering both mcprod and www.
2. A genuinely bad SKU (404 or out-of-stock) is reported as failing with a reason and the final URL.
3. A good SKU is reported green on both sites.
4. SearchToPDP entries are validated via the redirect API + add-to-cart presence.
5. MoreLikeThis yields a downloadable CSV of the first 5 passing SKUs.
6. No database schema changes; no new persisted tables.
