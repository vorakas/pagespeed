"""TestData group registry for SKU/page URL listing.

Maps each canonical BlazeMeter TestData CSV to the browser-openable URL it
produces, plus the site-specific CSS readiness selector the JMeter load test
asserts on (kept as reference for what "loaded correctly" means per group).
"""

from __future__ import annotations

from dataclasses import dataclass

# Base origins for the two environments.
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
    selectors: dict[str, str]    # site key -> CSS readiness selector (JMeter reference)
    is_search_to_pdp: bool = False
    max_rows: int | None = None   # cap of rows to keep/show (MoreLikeThis = 5)


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
        max_rows=5,
    ),
    "Search": GroupDef(
        key="Search", label="Search", csv_filename="Search.csv",
        path_template="/s/{v}", selectors=dict(_LISTING_SELECTORS),
    ),
    "PLP": GroupDef(
        key="PLP", label="PLP", csv_filename="PLP.csv",
        path_template="/s/{v}", selectors=dict(_LISTING_SELECTORS),
    ),
    "SearchToPLP": GroupDef(
        key="SearchToPLP", label="SearchToPLP", csv_filename="SearchToPLP.csv",
        path_template="/s/s_{v}/?s=1", selectors=dict(_LISTING_SELECTORS),
    ),
    "SearchToPDP": GroupDef(
        key="SearchToPDP", label="SearchToPDP", csv_filename="SearchToPDP.csv",
        path_template="",  # no static page; see open_url()
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


def open_url(group: GroupDef, site_key: str, value: str) -> str:
    """Browser-openable URL for a column-A value.

    For most groups this is the URL the load test hits.  SearchToPDP has no
    single static page (the load test resolves the SKU via the EDS search API),
    so we point at the search-results URL for that SKU, which redirects to the
    PDP in a browser.
    """
    if group.is_search_to_pdp:
        return f"{SITES[site_key]}/s/s_{value}/?s=1"
    return f"{SITES[site_key]}{group.path_template.format(v=value)}"
