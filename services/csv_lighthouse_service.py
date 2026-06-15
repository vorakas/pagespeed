from __future__ import annotations

import csv
import io
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import BinaryIO
from urllib.parse import urlparse

from config import (
    CSV_LIGHTHOUSE_MAX_FILE_BYTES,
    CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN,
    CSV_LIGHTHOUSE_MAX_ROWS_PER_FILE,
)
from exceptions import ValidationError
from services.testdata_registry import SITES, group_for_filename, open_url

TARGET_BUDGET_SECONDS = 540
DEFAULT_AVERAGE_SECONDS = 90
MAX_WORKERS_PER_TARGET = 4

_KNOWN_ROUTE_PREFIXES = ("/p/", "/sfp/", "/more-like-this/", "/s/")
_SEARCH_GROUP_KEYS = {"SearchToSort", "SearchToPDP"}


def normalize_csv_value(value, group=None) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        return ""

    parsed = urlparse(normalized)
    if parsed.scheme and parsed.netloc:
        normalized = parsed.path or ""
        if parsed.query:
            normalized = f"{normalized}?{parsed.query}"

    while normalized.startswith("/"):
        normalized = normalized[1:]

    if group and group.key in _SEARCH_GROUP_KEYS:
        normalized = normalized.split("?", 1)[0].rstrip("/")
        if normalized.lower().startswith("s/"):
            normalized = normalized[2:]
        if normalized.lower().startswith("s_"):
            normalized = normalized[2:]
        return normalized

    lower = normalized.lower()
    for prefix in _KNOWN_ROUTE_PREFIXES:
        prefix_without_slash = prefix.lstrip("/")
        if lower.startswith(prefix_without_slash):
            normalized = normalized[len(prefix_without_slash) :]
            break

    while normalized.startswith("/"):
        normalized = normalized[1:]
    return normalized


def parse_column_a(
    file_bytes: bytes,
    group=None,
    max_rows: int | None = None,
    filename: str = "CSV file",
) -> list[str]:
    try:
        decoded = file_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationError(f"Unable to decode CSV as UTF-8: {exc}") from exc

    values: list[str] = []
    row_limit = CSV_LIGHTHOUSE_MAX_ROWS_PER_FILE if max_rows is None else max_rows
    try:
        for row_index, row in enumerate(csv.reader(io.StringIO(decoded), strict=True), start=1):
            if row_index > row_limit:
                raise ValidationError(f"{filename} exceeds {row_limit} rows")
            if not row:
                continue
            normalized = normalize_csv_value(row[0], group)
            if normalized:
                values.append(normalized)
    except csv.Error as exc:
        raise ValidationError(f"Unable to parse CSV: {exc}") from exc
    return values


def calculate_worker_count(
    url_count: int, average_seconds: int = DEFAULT_AVERAGE_SECONDS
) -> int:
    if url_count <= 0:
        return 0
    if average_seconds <= 0:
        average_seconds = DEFAULT_AVERAGE_SECONDS
    required = math.ceil((url_count * average_seconds) / TARGET_BUDGET_SECONDS)
    return max(1, min(MAX_WORKERS_PER_TARGET, required))


class CsvLighthouseService:
    def __init__(self, repository, pagespeed_client, start_background: bool = True):
        self.repository = repository
        self.pagespeed_client = pagespeed_client
        self.start_background = start_background

    def create_run(
        self,
        files: list[tuple[str, BinaryIO]],
        site_keys,
        strategy: str,
        label: str | None = None,
    ) -> dict:
        strategy = self._validate_strategy(strategy)
        site_keys = self._validate_site_keys(site_keys)
        items = self._build_items(files, site_keys, strategy)
        if not items:
            raise ValidationError("Upload did not contain any recognized CSV rows")
        if len(items) > CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN:
            raise ValidationError(
                "CSV Lighthouse run would create "
                f"{len(items)} items; maximum is {CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN}"
            )
        worker_count = calculate_worker_count(len(items))
        run_id = self.repository.create_run(
            label=label or "CSV Lighthouse run",
            strategy=strategy,
            site_keys=site_keys,
            worker_count=worker_count,
            target_budget_seconds=TARGET_BUDGET_SECONDS,
            total_items=len(items),
        )
        if items:
            self.repository.create_items(run_id, items)
        if self.start_background:
            thread = threading.Thread(
                target=self.run_pending_items, args=(run_id,), daemon=False
            )
            thread.start()
        return {
            "run_id": run_id,
            "worker_count": worker_count,
            "total_items": len(items),
        }

    def list_runs(self):
        return self.repository.list_runs()

    def get_run(self, run_id: int):
        return self.repository.get_run_detail(run_id)

    def cancel_run(self, run_id: int):
        self.repository.request_cancel(run_id)
        return self.repository.get_run_detail(run_id)

    def run_pending_items(self, run_id: int) -> None:
        try:
            self._run_pending_items(run_id)
        except Exception as exc:
            self.repository.mark_run_failed(run_id, str(exc))

    def _run_pending_items(self, run_id: int) -> None:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        max_workers = max(1, int(run.get("worker_count") or 1))
        self.repository.mark_run_running(run_id)
        pending_items = self.repository.pending_items(run_id)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = set()
            next_index = 0

            def submit_available() -> int:
                nonlocal next_index
                submitted = 0
                while (
                    next_index < len(pending_items)
                    and len(futures) < max_workers
                    and not self.repository.should_cancel(run_id)
                ):
                    futures.add(
                        executor.submit(self._process_item, pending_items[next_index])
                    )
                    next_index += 1
                    submitted += 1
                return submitted

            submit_available()
            while futures:
                for future in as_completed(futures):
                    futures.remove(future)
                    future.result()
                    if not self.repository.should_cancel(run_id):
                        submit_available()
                    break

        if self.repository.should_cancel(run_id):
            cancelled_items = self.repository.mark_pending_items_cancelled(run_id)
            if cancelled_items:
                self.repository.mark_run_cancelled(run_id)
                return
        self.repository.finish_run_if_complete(run_id)

    def export_csv(self, run_id: int) -> str:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(
            [
                "run_id",
                "label",
                "source_filename",
                "group_key",
                "site_key",
                "original_value",
                "generated_url",
                "strategy",
                "status",
                "fcp",
                "speed_index",
                "lcp",
                "tbt",
                "cls",
                "error_message",
            ]
        )
        for item in detail["items"]:
            writer.writerow(
                [
                    run["id"],
                    run["label"],
                    item["source_filename"],
                    item["group_key"],
                    item["site_key"],
                    item["original_value"],
                    item["generated_url"],
                    item["strategy"],
                    item["status"],
                    self._csv_value(item.get("fcp")),
                    self._csv_value(item.get("speed_index")),
                    self._csv_value(item.get("lcp")),
                    self._csv_value(item.get("tbt")),
                    self._csv_value(item.get("cls")),
                    item.get("error_message"),
                ]
            )
        return output.getvalue()

    def _build_items(self, files, site_keys: list[str], strategy: str) -> list[dict]:
        items = []
        seen = set()
        for filename, handle in files:
            group = group_for_filename(filename)
            if group is None:
                continue
            file_bytes = self._read_limited_file(filename, handle)
            rows = parse_column_a(file_bytes, group, filename=filename)
            max_rows = group.max_rows if group.max_rows is not None else len(rows)
            for original_value in rows[:max_rows]:
                for site_key in site_keys:
                    generated_url = open_url(group, site_key, original_value)
                    dedupe_key = (site_key, generated_url, strategy)
                    if dedupe_key in seen:
                        continue
                    seen.add(dedupe_key)
                    items.append(
                        {
                            "source_filename": filename,
                            "group_key": group.key,
                            "site_key": site_key,
                            "original_value": original_value,
                            "generated_url": generated_url,
                            "strategy": strategy,
                        }
                    )
        return items

    def recover_interrupted_runs(self) -> int:
        return self.repository.recover_interrupted_runs("Run interrupted by server restart")

    def _read_limited_file(self, filename: str, handle: BinaryIO) -> bytes:
        size = self._stream_size_bytes(handle)
        if size > CSV_LIGHTHOUSE_MAX_FILE_BYTES:
            raise ValidationError(
                f"CSV file {filename} exceeds {CSV_LIGHTHOUSE_MAX_FILE_BYTES} bytes"
            )
        return handle.read()

    def _process_item(self, item: dict) -> None:
        if not self.repository.mark_item_running(item["id"]):
            return
        started = time.monotonic()
        try:
            metrics = self.pagespeed_client.test_url(
                item["generated_url"], item["strategy"]
            )
            metrics["duration_ms"] = int((time.monotonic() - started) * 1000)
            self.repository.mark_item_passed(item["id"], metrics)
        except Exception as exc:
            self.repository.mark_item_failed(item["id"], str(exc))

    def _csv_value(self, value):
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value

    def _stream_size_bytes(self, stream: BinaryIO) -> int:
        try:
            stream.seek(0, io.SEEK_END)
            size = stream.tell()
        finally:
            stream.seek(0)
        return int(size)

    def _validate_strategy(self, strategy: str) -> str:
        if strategy not in {"desktop", "mobile"}:
            raise ValidationError("Strategy must be desktop or mobile")
        return strategy

    def _validate_site_keys(self, site_keys) -> list[str]:
        if not site_keys:
            raise ValidationError("At least one site key is required")
        validated = []
        for site_key in site_keys:
            if site_key not in SITES:
                raise ValidationError(f"Unknown site key: {site_key}")
            validated.append(site_key)
        return validated
