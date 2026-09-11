"""Target mode definitions for CSV Lighthouse browser-session runs."""
from __future__ import annotations

from dataclasses import dataclass

from exceptions import ValidationError


WWW_BASE_URL = "https://www.lampsplus.com"


@dataclass(frozen=True)
class CsvLighthouseTargetMode:
    key: str
    label: str
    warmup_url: str
    base_url: str = WWW_BASE_URL


CSV_LIGHTHOUSE_TARGET_MODES: dict[str, CsvLighthouseTargetMode] = {
    "mcprod": CsvLighthouseTargetMode(
        key="mcprod",
        label="Adobe Commerce",
        warmup_url=f"{WWW_BASE_URL}/?sov=AC3624360",
    ),
    "www": CsvLighthouseTargetMode(
        key="www",
        label="LampsPlus",
        warmup_url=f"{WWW_BASE_URL}/?sov=LP8675309",
    ),
}


def get_csv_lighthouse_target_mode(site_key: str) -> CsvLighthouseTargetMode:
    try:
        return CSV_LIGHTHOUSE_TARGET_MODES[site_key]
    except KeyError as exc:
        raise ValidationError(f"Unknown CSV Lighthouse target: {site_key}") from exc


def csv_lighthouse_site_keys() -> set[str]:
    return set(CSV_LIGHTHOUSE_TARGET_MODES)
