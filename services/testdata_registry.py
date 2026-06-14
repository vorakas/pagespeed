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
