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
            view = self._public_view(state)

        threading.Thread(target=self._run, args=(run_id, plan), daemon=True).start()
        return view

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
        group_state["trimmed_csv"] = ("\n".join(kept) + "\n") if kept else None
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
