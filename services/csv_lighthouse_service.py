from __future__ import annotations

import csv
import io
import math
import statistics
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import BinaryIO
from urllib.parse import urlparse

from config import (
    CSV_LIGHTHOUSE_MAX_FILE_BYTES,
    CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN,
    CSV_LIGHTHOUSE_MAX_ROWS_PER_FILE,
    CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL,
    CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES,
    CSV_LIGHTHOUSE_MAX_WORKERS,
    CSV_LIGHTHOUSE_STALE_RUN_SECONDS,
)
from exceptions import ValidationError
from services.testdata_registry import GROUPS, SITES, group_for_filename, open_url

TARGET_BUDGET_SECONDS = 540
DEFAULT_AVERAGE_SECONDS = 90
MAX_LIGHTHOUSE_ATTEMPTS = 2

_KNOWN_ROUTE_PREFIXES = ("/p/", "/sfp/", "/more-like-this/", "/s/")
_SEARCH_GROUP_KEYS = {"SearchToPLP", "SearchToPDP"}


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
    url_count: int,
    samples_per_url: int = 1,
    average_seconds: int = DEFAULT_AVERAGE_SECONDS,
) -> int:
    if url_count <= 0:
        return 0
    if average_seconds <= 0:
        average_seconds = DEFAULT_AVERAGE_SECONDS
    # Concurrency scales with total PSI calls (urls x samples), not urls alone,
    # so a high-sample run does not crawl at the single-sample worker count.
    total_samples = url_count * max(1, samples_per_url)
    required = math.ceil((total_samples * average_seconds) / TARGET_BUDGET_SECONDS)
    return max(1, min(CSV_LIGHTHOUSE_MAX_WORKERS, required))


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
        samples_per_url: int = 1,
    ) -> dict:
        strategy = self._validate_strategy(strategy)
        site_keys = self._validate_site_keys(site_keys)
        samples_per_url = self._validate_samples_per_url(samples_per_url)

        upload_records = self._read_file_records(files)
        uploaded_names = {record["filename"] for record in upload_records}
        library_records = [
            record
            for record in self._library_file_records()
            if record["filename"] not in uploaded_names
        ]
        file_records = library_records + upload_records
        if not file_records:
            # Distinguish "nothing supplied at all" from "uploaded files but none recognized"
            if files:
                raise ValidationError("Upload did not contain any recognized CSV rows")
            raise ValidationError(
                "No CSV files available — add files to the library or upload some"
            )

        items = self._build_items_from_file_records(file_records, site_keys, strategy)
        if not items:
            raise ValidationError("Upload did not contain any recognized CSV rows")
        if len(items) > CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN:
            raise ValidationError(
                "CSV Lighthouse run would create "
                f"{len(items)} items; maximum is {CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN}"
            )
        total_samples = len(items) * samples_per_url
        if total_samples > CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES:
            raise ValidationError(
                f"CSV Lighthouse run would make {total_samples} total samples; "
                f"maximum is {CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES}"
            )
        worker_count = calculate_worker_count(len(items), samples_per_url)
        run_id = self.repository.create_run(
            label=label or "CSV Lighthouse run",
            strategy=strategy,
            site_keys=site_keys,
            worker_count=worker_count,
            target_budget_seconds=TARGET_BUDGET_SECONDS,
            total_items=len(items),
            samples_per_url=samples_per_url,
        )
        for file_record in file_records:
            self.repository.create_file(
                run_id,
                file_record["filename"],
                file_record["group_key"],
                file_record["csv_text"],
                file_record["row_count"],
            )
        if items:
            self.repository.create_items(run_id, items)
        return {
            "run_id": run_id,
            "worker_count": worker_count,
            "total_items": len(items),
        }

    def list_runs(self):
        return self.repository.list_runs()

    def get_run(self, run_id: int):
        return self.repository.get_run_detail(run_id)

    def start_run(self, run_id: int):
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        if not run:
            raise ValidationError("CSV Lighthouse run not found")
        if run["status"] != "pending":
            raise ValidationError("CSV Lighthouse run can only be started while pending")

        self.repository.mark_run_running(run_id)
        if self.start_background:
            thread = threading.Thread(
                target=self.run_pending_items, args=(run_id,), daemon=False
            )
            thread.start()
            return self.repository.get_run_detail(run_id)

        self.run_pending_items(run_id)
        return self.repository.get_run_detail(run_id)

    def list_files(self, run_id: int) -> list[dict]:
        return self.repository.list_files(run_id)

    def list_library(self) -> list[dict]:
        return self.repository.list_library()

    def save_library_files(self, files) -> list[dict]:
        if not files:
            raise ValidationError("No CSV files provided")
        for filename, handle in files:
            group = group_for_filename(filename)
            if group is None:
                accepted = ", ".join(g.csv_filename for g in GROUPS.values())
                raise ValidationError(
                    f"Unrecognized CSV filename: {filename}. "
                    f"Expected one of: {accepted}"
                )
            file_bytes = self._read_limited_file(filename, handle)
            rows = parse_column_a(file_bytes, group, filename=filename)
            if group.max_rows is not None:
                rows = rows[: group.max_rows]
            self.repository.upsert_library_file(
                filename,
                group.key,
                self._csv_text_from_values(rows),
                len(rows),
            )
        return self.repository.list_library()

    def delete_library_file(self, filename: str) -> None:
        self.repository.delete_library_file(filename)

    def get_file(self, file_id: int) -> dict | None:
        return self.repository.get_file(file_id)

    def update_file(self, file_id: int, csv_text: str) -> dict:
        file = self.repository.get_file(file_id)
        if not file:
            raise ValidationError("CSV file not found")
        run_id = file["run_id"]
        if not self.repository.run_is_editable(run_id):
            raise ValidationError("CSV files can only be edited before the run starts")
        group = group_for_filename(file["filename"])
        if group is None:
            raise ValidationError("CSV file has an unrecognized filename")
        values = parse_column_a(
            csv_text.encode("utf-8"),
            group,
            filename=file["filename"],
        )
        if group.max_rows is not None:
            values = values[: group.max_rows]
        normalized_text = self._csv_text_from_values(values)
        self.repository.update_file(file_id, normalized_text, len(values))
        self._rebuild_pending_items_from_files(run_id)
        return self.repository.get_file(file_id)

    def delete_file(self, file_id: int) -> None:
        file = self.repository.get_file(file_id)
        if not file:
            raise ValidationError("CSV file not found")
        run_id = file["run_id"]
        if not self.repository.run_is_editable(run_id):
            raise ValidationError("CSV files can only be deleted before the run starts")
        self.repository.delete_file(file_id)
        self._rebuild_pending_items_from_files(run_id)

    def cancel_run(self, run_id: int):
        self.repository.request_cancel(run_id)
        return self.repository.get_run_detail(run_id)

    def delete_run(self, run_id: int) -> None:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        if not run:
            raise ValidationError("CSV Lighthouse run not found")
        if run["status"] == "running":
            raise ValidationError("Cancel the run before deleting it")
        self.repository.delete_run(run_id)

    def run_pending_items(self, run_id: int) -> None:
        try:
            self._run_pending_items(run_id)
        except Exception as exc:
            self.repository.mark_run_failed(run_id, str(exc))

    def _run_pending_items(self, run_id: int) -> None:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        max_workers = max(1, int(run.get("worker_count") or 1))
        samples_per_url = max(1, int(run.get("samples_per_url") or 1))
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
                        executor.submit(
                            self._process_item,
                            pending_items[next_index],
                            samples_per_url,
                        )
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

    EXPORT_HEADER = [
        "run_id", "label", "source_filename", "group_key", "site_key",
        "original_value", "generated_url", "strategy", "kind",
        "sample_index", "n", "status", "fcp", "speed_index", "lcp",
        "tbt", "cls", "attempts", "duration_ms", "error_message",
        "completed_at",
    ]

    def export_csv(self, run_id: int) -> str:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        samples_by_item = self._samples_by_item(run_id, detail["items"])

        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(self.EXPORT_HEADER)

        sections: dict[tuple[str, str], list[dict]] = {}
        for item in detail["items"]:
            key = (item["site_key"], item["group_key"])
            sections.setdefault(key, []).append(item)

        for (_site_key, _group_key), items in sections.items():
            for item in items:
                samples = samples_by_item.get(item["id"], [])
                for sample in samples:
                    writer.writerow(self._sample_row(run, item, sample))
                passed = [s for s in samples if s["status"] == "passed"]
                for stat in ("mean", "median", "min", "max"):
                    writer.writerow(self._summary_row(run, item, passed, stat))
        return output.getvalue()

    def _samples_by_item(self, run_id: int, items: list[dict]) -> dict[int, list[dict]]:
        grouped: dict[int, list[dict]] = {}
        for sample in self.repository.list_samples(run_id):
            grouped.setdefault(sample["item_id"], []).append(sample)
        # Backward compatibility: synthesize a single sample from the item's
        # inline metrics for runs recorded before sampling existed.
        for item in items:
            if item["id"] in grouped:
                continue
            if item["status"] not in ("passed", "failed"):
                continue
            grouped[item["id"]] = [
                {
                    "item_id": item["id"],
                    "sample_index": 1,
                    "status": item["status"],
                    "fcp": item.get("fcp"),
                    "speed_index": item.get("speed_index"),
                    "lcp": item.get("lcp"),
                    "tbt": item.get("tbt"),
                    "cls": item.get("cls"),
                    "attempts": item.get("attempts"),
                    "duration_ms": item.get("duration_ms"),
                    "error_message": item.get("error_message"),
                    "completed_at": item.get("completed_at"),
                }
            ]
        return grouped

    def _sample_row(self, run: dict, item: dict, sample: dict) -> list:
        return [
            run["id"], run["label"], item["source_filename"], item["group_key"],
            item["site_key"], item["original_value"], item["generated_url"],
            item["strategy"], "sample", sample["sample_index"], "",
            sample["status"],
            self._csv_value(sample.get("fcp")),
            self._csv_value(sample.get("speed_index")),
            self._csv_value(sample.get("lcp")),
            self._csv_value(sample.get("tbt")),
            self._csv_value(sample.get("cls")),
            sample.get("attempts"),
            sample.get("duration_ms"),
            sample.get("error_message"),
            sample.get("completed_at"),
        ]

    def _summary_row(self, run: dict, item: dict, passed: list[dict], stat: str) -> list:
        return [
            run["id"], run["label"], item["source_filename"], item["group_key"],
            item["site_key"], item["original_value"], item["generated_url"],
            item["strategy"], stat, "", len(passed), "",
            self._csv_value(self._summarize(passed, "fcp", stat)),
            self._csv_value(self._summarize(passed, "speed_index", stat)),
            self._csv_value(self._summarize(passed, "lcp", stat)),
            self._csv_value(self._summarize(passed, "tbt", stat)),
            self._csv_value(self._summarize(passed, "cls", stat)),
            "", "", "", "",
        ]

    @staticmethod
    def _summarize(samples: list[dict], key: str, stat: str):
        values = [s[key] for s in samples if isinstance(s.get(key), (int, float))]
        if not values:
            return None
        if stat == "mean":
            return sum(values) / len(values)
        if stat == "median":
            return statistics.median(values)
        if stat == "min":
            return min(values)
        if stat == "max":
            return max(values)
        return None

    def _read_file_records(self, files) -> list[dict]:
        records = []
        for filename, handle in files:
            group = group_for_filename(filename)
            if group is None:
                continue
            file_bytes = self._read_limited_file(filename, handle)
            rows = parse_column_a(
                file_bytes,
                group,
                filename=filename,
            )
            if group.max_rows is not None:
                rows = rows[: group.max_rows]
            records.append(
                {
                    "filename": filename,
                    "group_key": group.key,
                    "csv_text": self._csv_text_from_values(rows),
                    "row_count": len(rows),
                    "values": rows,
                }
            )
        return records

    def _library_file_records(self) -> list[dict]:
        records = []
        for file in self.repository.list_library():
            values = [
                line.strip()
                for line in file["csv_text"].splitlines()
                if line.strip()
            ]
            records.append(
                {
                    "filename": file["filename"],
                    "group_key": file["group_key"],
                    "csv_text": file["csv_text"],
                    "row_count": file["row_count"],
                    "values": values,
                }
            )
        return records

    def _rebuild_pending_items_from_files(self, run_id: int) -> None:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        if not run:
            raise ValidationError("CSV Lighthouse run not found")
        file_records = []
        for file in self.repository.list_files(run_id):
            values = [
                str(value).strip()
                for value in file["csv_text"].splitlines()
                if str(value).strip()
            ]
            file_records.append(
                {
                    "filename": file["filename"],
                    "group_key": file["group_key"],
                    "values": values,
                }
            )
        items = self._build_items_from_file_records(
            file_records,
            run["site_keys"],
            run["strategy"],
        )
        if len(items) > CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN:
            raise ValidationError(
                "CSV Lighthouse run would create "
                f"{len(items)} items; maximum is {CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN}"
            )
        self.repository.replace_pending_items(run_id, items)

    def _build_items_from_file_records(
        self,
        file_records: list[dict],
        site_keys: list[str],
        strategy: str,
    ) -> list[dict]:
        items = []
        seen = set()
        for file_record in file_records:
            filename = file_record["filename"]
            group = group_for_filename(filename)
            if group is None:
                continue
            for original_value in file_record["values"]:
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

    def _build_items(self, files, site_keys: list[str], strategy: str) -> list[dict]:
        return self._build_items_from_file_records(
            self._read_file_records(files),
            site_keys,
            strategy,
        )

    @staticmethod
    def _csv_text_from_values(values: list[str]) -> str:
        return "\n".join(values) + ("\n" if values else "")

    def recover_interrupted_runs(self) -> int:
        return self.repository.recover_interrupted_runs(
            "Run interrupted by server restart",
            stale_seconds=CSV_LIGHTHOUSE_STALE_RUN_SECONDS,
        )

    def _read_limited_file(self, filename: str, handle: BinaryIO) -> bytes:
        size = self._stream_size_bytes(handle)
        if size > CSV_LIGHTHOUSE_MAX_FILE_BYTES:
            raise ValidationError(
                f"CSV file {filename} exceeds {CSV_LIGHTHOUSE_MAX_FILE_BYTES} bytes"
            )
        return handle.read()

    def _process_item(self, item: dict, samples_per_url: int = 1) -> None:
        if not self.repository.mark_item_running(item["id"]):
            return
        run_id = item["run_id"]
        started = time.monotonic()
        passed_samples: list[dict] = []
        total_attempts = 0
        last_error: Exception | None = None

        for sample_index in range(1, samples_per_url + 1):
            if sample_index > 1 and self.repository.should_cancel(run_id):
                break
            metrics, attempts, error = self._collect_sample(item)
            total_attempts += attempts
            if metrics is not None:
                passed_samples.append(metrics)
                self.repository.create_sample(
                    run_id=run_id,
                    item_id=item["id"],
                    sample_index=sample_index,
                    status="passed",
                    metrics=metrics,
                    attempts=attempts,
                    duration_ms=metrics.get("duration_ms"),
                    error_message=None,
                )
            else:
                last_error = error
                self.repository.create_sample(
                    run_id=run_id,
                    item_id=item["id"],
                    sample_index=sample_index,
                    status="failed",
                    metrics=None,
                    attempts=attempts,
                    duration_ms=None,
                    error_message=str(error or "PageSpeed failed"),
                )

        duration_ms = int((time.monotonic() - started) * 1000)
        if passed_samples:
            representative = self._median_metrics(passed_samples)
            # attempts here is the summed PSI attempts across all samples for this
            # item; per-sample attempts live in csv_lighthouse_samples.
            representative["attempts"] = total_attempts
            representative["duration_ms"] = duration_ms
            self.repository.mark_item_passed(item["id"], representative)
        else:
            self.repository.mark_item_failed(
                item["id"],
                str(last_error or "PageSpeed failed"),
                attempts=total_attempts or MAX_LIGHTHOUSE_ATTEMPTS,
            )

    def _collect_sample(self, item: dict):
        """Run one PSI measurement with retries.

        Returns ``(metrics | None, attempts, error)``.  ``metrics`` includes a
        ``duration_ms`` for that single sample.
        """
        started = time.monotonic()
        last_error: Exception | None = None
        for attempt in range(1, MAX_LIGHTHOUSE_ATTEMPTS + 1):
            try:
                metrics = dict(
                    self.pagespeed_client.test_url(item["generated_url"], item["strategy"])
                )
                metrics["duration_ms"] = int((time.monotonic() - started) * 1000)
                return metrics, attempt, None
            except Exception as exc:
                last_error = exc
        return None, MAX_LIGHTHOUSE_ATTEMPTS, last_error

    @staticmethod
    def _median_metrics(samples: list[dict]) -> dict:
        keys = ("fcp", "speed_index", "lcp", "tbt", "cls")
        result: dict = {}
        for key in keys:
            values = [s[key] for s in samples if isinstance(s.get(key), (int, float))]
            result[key] = statistics.median(values) if values else None
        return result

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

    def _validate_samples_per_url(self, samples_per_url) -> int:
        try:
            value = int(samples_per_url)
        except (TypeError, ValueError):
            raise ValidationError("samples per URL must be a whole number")
        if value < 1 or value > CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL:
            raise ValidationError(
                f"samples per URL must be between 1 and {CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL}"
            )
        return value

    def _validate_site_keys(self, site_keys) -> list[str]:
        if not site_keys:
            raise ValidationError("At least one site key is required")
        validated = []
        for site_key in site_keys:
            if site_key not in SITES:
                raise ValidationError(f"Unknown site key: {site_key}")
            validated.append(site_key)
        return validated
