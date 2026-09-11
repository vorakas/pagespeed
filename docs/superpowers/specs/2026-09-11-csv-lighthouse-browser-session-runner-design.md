# CSV Lighthouse Browser Session Runner Design

Date: 2026-09-11

## Summary

CSV Lighthouse runs must stop treating Adobe Commerce as a separate `mcprod.lampsplus.com` host. Both Adobe Commerce and LampsPlus targets now use normal `www.lampsplus.com` URLs, but each target requires a fresh browser session warmup before auditing a URL.

The CSV Lighthouse upload/edit/save/run workflow stays intact. The execution backend changes from Google PageSpeed Insights API calls to a browser-based Lighthouse runner for both targets so Adobe Commerce and LampsPlus are measured through the same mechanism.

## Problem

The current CSV Lighthouse implementation generates per-target URLs using `site_key`:

- `mcprod` -> `https://mcprod.lampsplus.com/...`
- `www` -> `https://www.lampsplus.com/...`

That assumption is now wrong. Adobe Commerce mode is established by opening:

```text
https://www.lampsplus.com/?sov=AC3624360
```

After that warmup, navigating normal `www.lampsplus.com` URLs in the same browser session serves the Adobe version. Adding `sov=AC3624360` directly to deep URLs can 404, so a one-URL-at-a-time PageSpeed Insights API call cannot reproduce Adobe mode.

LampsPlus should also use a warmup URL as a safety net:

```text
https://www.lampsplus.com/?sov=LP8675309
```

## Goals

- Run CSV Lighthouse audits with a fresh browser profile/session per URL sample.
- Use the same browser-session Lighthouse runner for both Adobe Commerce and LampsPlus.
- Warm up the target mode before each audited sample.
- Keep existing CSV upload, edit, save, run, cancel, poll, result grouping, and export behavior.
- Preserve existing CSV result fields and average-row behavior.
- Avoid bridging CSV Lighthouse results into standard `test_results` in this phase.

## Non-Goals

- Do not change regular monitored URL testing on the main Test URLs table.
- Do not change Dashboard or Metrics consumers.
- Do not add shared-session batching; each sample gets isolation.
- Do not append `sov` to deep audit URLs.
- Do not migrate historical CSV Lighthouse rows.

## Target Modes

Keep the UI concept of two targets:

| Target | Existing key | Warmup URL | Audit URL |
| --- | --- | --- | --- |
| Adobe Commerce | `mcprod` | `https://www.lampsplus.com/?sov=AC3624360` | Normal generated `https://www.lampsplus.com/...` URL |
| LampsPlus | `www` | `https://www.lampsplus.com/?sov=LP8675309` | Normal generated `https://www.lampsplus.com/...` URL |

The internal `mcprod` key can remain for compatibility in the first implementation, but visible labels should avoid presenting it as a host. Future cleanup can rename keys if needed.

## URL Generation

`services/testdata_registry.py` should no longer use `https://mcprod.lampsplus.com` as the Adobe Commerce base for CSV Lighthouse audit URLs.

For both target keys, URL generation should produce normal `www.lampsplus.com` URLs using the existing group/path rules:

- Homepage -> `https://www.lampsplus.com/`
- PDP -> `https://www.lampsplus.com/p/{value}`
- SFP -> `https://www.lampsplus.com/sfp/{value}`
- Listing/search paths stay on `www.lampsplus.com`

The generated URL stored on each item should be the final audit URL, not the warmup URL.

## Execution Flow

For each CSV Lighthouse item sample:

1. Create a fresh temporary browser profile/session.
2. Launch headless Chromium.
3. Navigate to the target warmup URL:
   - Adobe Commerce: `https://www.lampsplus.com/?sov=AC3624360`
   - LampsPlus: `https://www.lampsplus.com/?sov=LP8675309`
4. Wait for the warmup navigation to settle.
5. Run Lighthouse against the generated audit URL in the same browser/session.
6. Extract the same metrics currently saved by CSV Lighthouse:
   - performance
   - FCP
   - Speed Index
   - LCP
   - TBT
   - CLS
7. Persist sample result and aggregate item status using existing repository methods.
8. Close browser and delete temporary profile.

Fresh session per URL/sample is required even when multiple samples audit the same URL.

## Runner Shape

Add a dedicated backend runner, for example:

```text
services/browser_lighthouse_runner.py
```

Responsibility:

- Own browser/Lighthouse process execution.
- Accept `warmup_url`, `audit_url`, and `strategy`.
- Return normalized metrics in the same shape CSV Lighthouse expects.
- Raise domain-specific errors that CSV Lighthouse can record as failed samples/items.

The runner should be injected into `CsvLighthouseService` rather than imported globally. This keeps tests fast and lets existing service tests use fakes.

## Runtime Dependencies

Railway currently builds Python runtime without a browser/Lighthouse stack. Docker must install what the runner needs.

Recommended implementation direction:

- Install Chromium in the final runtime image.
- Install Node/Lighthouse CLI in the final runtime image, or add an equivalent maintained browser-Lighthouse package.
- Configure the runner with explicit executable paths/env vars where possible.
- Keep the frontend build stage separate from backend runtime concerns.

The first implementation should fail clearly if the browser runtime is unavailable, with an actionable error in the CSV Lighthouse run.

## Service Changes

`services/csv_lighthouse_service.py` should change only the execution mechanism:

- `_build_items` continues creating items from uploaded/saved CSVs and selected targets.
- `_attempt_sample` or equivalent sample execution calls the browser runner instead of `PageSpeedClient.test_url`.
- Existing rate limiting, cancellation checks, status updates, sample persistence, median metric aggregation, and average row behavior remain.

Expected service inputs per item:

- `site_key`: identifies target mode.
- `generated_url`: normal `www.lampsplus.com` URL to audit.
- `strategy`: desktop/mobile.
- `samples_per_url`: existing sample count.

Target warmup selection should be centralized, not scattered across worker code.

## Frontend Changes

Keep `CsvLighthousePanel` structure.

Required copy/label updates:

- Adobe Commerce target should no longer show `mcprod` as if it is a host.
- Labels can remain:
  - Adobe Commerce
  - LampsPlus

Results table/export can continue grouping by target key and group key. No UI rewrite is required.

## Data Model

No schema change is required for the first implementation.

Existing fields remain meaningful:

- `site_key`: target identity (`mcprod` compatibility key for Adobe Commerce, `www` for LampsPlus).
- `generated_url`: normal audit URL on `www.lampsplus.com`.
- sample metrics/status/error fields: unchanged.

If later cleanup renames `mcprod` to an Adobe-specific key, that should be a separate migration with backwards compatibility for old runs.

## Error Handling

Failure classes to surface in run/item errors:

- Browser runtime missing.
- Warmup navigation failed.
- Audit navigation failed.
- Lighthouse process failed.
- Lighthouse JSON parse failed.
- Required metric missing.
- Timeout.

Cancellation should still interrupt between items/samples. If cancellation arrives while a browser process is running, the runner should terminate the child process and clean the temporary profile.

## Testing

Backend:

- Unit test target-mode warmup selection:
  - `mcprod` -> Adobe `sov=AC3624360`
  - `www` -> LampsPlus `sov=LP8675309`
- Unit test URL generation now produces `www.lampsplus.com` for both targets.
- Unit test `CsvLighthouseService` calls runner with `warmup_url`, `audit_url`, and `strategy`.
- Unit test failed runner result records failed sample/item status.
- Preserve existing CSV repository/API tests.

Frontend:

- Update target label expectations if tests assert `mcprod`.
- Preserve result section/average tests.

Manual/local smoke:

- Create CSV run with one small file and both targets.
- Confirm pending run remains editable before start.
- Start run.
- Confirm each target warms up with the correct `sov` URL.
- Confirm audit URL has no deep-link `sov` parameter.
- Confirm results/averages/export still render.

Build:

- Run focused pytest for CSV Lighthouse.
- Run focused frontend tests for CSV Lighthouse components.
- Run `npm run build` in `frontend/`.

## Open Constraints

- Exact Lighthouse CLI invocation depends on installed runtime. Implementation should verify locally before deployment.
- Browser-based Lighthouse will likely be slower and heavier than PageSpeed API. Fresh session per sample is intentional for correctness and comparability.
- Parallel worker count may need tuning after runtime validation to avoid Railway CPU/memory pressure.

## Approval Gate

Implementation should not start until this design is reviewed and approved.
