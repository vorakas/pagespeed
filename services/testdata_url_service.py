"""TestData URL listing.

Parses uploaded BlazeMeter TestData CSVs and builds the browser-openable URLs
for each entry, grouped by CSV.  No network I/O — the user opens the links to
verify SKUs manually.  MoreLikeThis is capped to its first ``max_rows`` rows.
"""

from __future__ import annotations

import csv
import io

from services.testdata_registry import (
    SITES,
    GroupDef,
    group_for_filename,
    open_url,
)


def parse_column_a(file_bytes: bytes) -> list[str]:
    """Extract trimmed, non-empty column-A values from CSV bytes.

    TestData CSVs have no header row and use a comma delimiter; only the first
    field of each row is significant.
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


class TestDataUrlService:
    """Builds per-site openable URLs for uploaded TestData CSV entries."""

    def build_listing(
        self, files: list[tuple[str, bytes]], site_keys: list[str],
    ) -> dict:
        """Parse files and build the grouped URL listing.

        Args:
            files:     (filename, raw bytes) pairs from the upload.
            site_keys: which sites to build links for (defaults to all).

        Returns:
            ``{"groups": {key: {...}}, "unrecognized": [filename, ...]}``.
        """
        site_keys = [s for s in site_keys if s in SITES] or list(SITES.keys())

        groups: dict[str, dict] = {}
        unrecognized: list[str] = []

        for filename, raw in files:
            group = group_for_filename(filename)
            if group is None:
                unrecognized.append(filename)
                continue
            all_values = parse_column_a(raw)
            shown = (
                all_values[: group.max_rows]
                if group.max_rows is not None
                else all_values
            )
            entries = [
                {
                    "value": value,
                    "urls": {s: open_url(group, s, value) for s in site_keys},
                }
                for value in shown
            ]
            groups[group.key] = {
                "key": group.key,
                "label": group.label,
                "filename": group.csv_filename,
                "totalRows": len(all_values),
                "shownRows": len(shown),
                "capped": group.max_rows is not None and len(all_values) > group.max_rows,
                "maxRows": group.max_rows,
                "entries": entries,
                "trimmedCsv": self._trimmed_csv(group, shown),
            }

        return {"groups": groups, "unrecognized": unrecognized}

    @staticmethod
    def _trimmed_csv(group: GroupDef, shown: list[str]) -> str | None:
        """CSV text of the kept rows — only for capped groups (MoreLikeThis)."""
        if group.max_rows is None or not shown:
            return None
        return "\n".join(shown) + "\n"
