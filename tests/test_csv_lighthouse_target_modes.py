import pytest

from exceptions import ValidationError
from services.csv_lighthouse_target_modes import (
    csv_lighthouse_site_keys,
    get_csv_lighthouse_target_mode,
)
from services.testdata_registry import GROUPS, open_url


def test_target_modes_keep_compatibility_keys_and_warmups():
    adobe = get_csv_lighthouse_target_mode("mcprod")
    lampsplus = get_csv_lighthouse_target_mode("www")

    assert csv_lighthouse_site_keys() == {"mcprod", "www"}
    assert adobe.label == "Adobe Commerce"
    assert adobe.warmup_url == "https://www.lampsplus.com/?sov=AC3624360"
    assert adobe.base_url == "https://www.lampsplus.com"
    assert lampsplus.label == "LampsPlus"
    assert lampsplus.warmup_url == "https://www.lampsplus.com/?sov=LP8675309"
    assert lampsplus.base_url == "https://www.lampsplus.com"


def test_unknown_target_mode_raises_validation_error():
    with pytest.raises(ValidationError, match="Unknown CSV Lighthouse target"):
        get_csv_lighthouse_target_mode("staging")


def test_adobe_and_lampsplus_generate_normal_www_audit_urls():
    pdp_group = GROUPS["PDP"]

    adobe_url = open_url(pdp_group, "mcprod", "brass-lamp/")
    lampsplus_url = open_url(pdp_group, "www", "brass-lamp/")

    assert adobe_url == "https://www.lampsplus.com/p/brass-lamp/"
    assert lampsplus_url == "https://www.lampsplus.com/p/brass-lamp/"
    assert "sov=" not in adobe_url
    assert "mcprod" not in adobe_url


def test_search_to_pdp_uses_www_for_both_targets():
    group = GROUPS["SearchToPDP"]

    assert open_url(group, "mcprod", "12345") == (
        "https://www.lampsplus.com/s/s_12345/?s=1"
    )
    assert open_url(group, "www", "12345") == (
        "https://www.lampsplus.com/s/s_12345/?s=1"
    )
