"""Target mode definitions for CSV Lighthouse browser-session runs."""
from __future__ import annotations

from dataclasses import dataclass

from exceptions import ValidationError


WWW_BASE_URL = "https://www.lampsplus.com"
AC_URL_DOMAIN_COOKIE = "cookie"
AC_URL_DOMAINS = (
    "mcprod.lampsplus.com",
    "ppe.lampsplus.com",
    "mcuat.lampsplus.com",
    "mcstaging.lampsplus.com",
    "mcstaging2.lampsplus.com",
)


@dataclass(frozen=True)
class CsvLighthouseTargetMode:
    key: str
    label: str
    warmup_url: str
    cookies: dict[str, str]
    clear_cookies: tuple[str, ...]
    base_url: str = WWW_BASE_URL


CSV_LIGHTHOUSE_TARGET_MODES: dict[str, CsvLighthouseTargetMode] = {
    "mcprod": CsvLighthouseTargetMode(
        key="mcprod",
        label="Adobe Commerce",
        warmup_url=f"{WWW_BASE_URL}/?sov=AC3624360",
        cookies={"forceNew": "true"},
        clear_cookies=("forceOld",),
    ),
    "www": CsvLighthouseTargetMode(
        key="www",
        label="LampsPlus",
        warmup_url=f"{WWW_BASE_URL}/?sov=LP8675309",
        cookies={"forceOld": "true"},
        clear_cookies=("forceNew",),
    ),
}


def get_csv_lighthouse_target_mode(site_key: str) -> CsvLighthouseTargetMode:
    try:
        return CSV_LIGHTHOUSE_TARGET_MODES[site_key]
    except KeyError as exc:
        raise ValidationError(f"Unknown CSV Lighthouse target: {site_key}") from exc


def normalize_ac_url_domain(raw_value: str | None) -> str:
    value = str(raw_value or AC_URL_DOMAIN_COOKIE).strip().lower()
    if value == AC_URL_DOMAIN_COOKIE:
        return AC_URL_DOMAIN_COOKIE
    if value in AC_URL_DOMAINS:
        return value
    raise ValidationError(f"Unknown AC URL domain: {raw_value}")


def resolve_csv_lighthouse_target_mode(
    site_key: str,
    ac_url_domain: str | None = AC_URL_DOMAIN_COOKIE,
) -> CsvLighthouseTargetMode:
    ac_domain = normalize_ac_url_domain(ac_url_domain)
    if ac_domain == AC_URL_DOMAIN_COOKIE:
        return get_csv_lighthouse_target_mode(site_key)
    if site_key == "mcprod":
        return CsvLighthouseTargetMode(
            key="mcprod",
            label=f"Adobe Commerce ({ac_domain})",
            warmup_url=f"https://{ac_domain}/",
            cookies={},
            clear_cookies=(),
            base_url=f"https://{ac_domain}",
        )
    if site_key == "www":
        return CsvLighthouseTargetMode(
            key="www",
            label="LampsPlus",
            warmup_url=f"{WWW_BASE_URL}/",
            cookies={},
            clear_cookies=(),
        )
    return get_csv_lighthouse_target_mode(site_key)


def csv_lighthouse_site_keys() -> set[str]:
    return set(CSV_LIGHTHOUSE_TARGET_MODES)
