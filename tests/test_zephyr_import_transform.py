from services.zephyr_import_service import (
    format_step_ranges,
    prettify_field_name,
    transform_entry,
)

BASE_URL = "https://lampstrack.example.com"


def make_entry(**overrides) -> dict:
    entry = {
        "id": 547403,
        "sourceId": 30707,
        "historyDate": "2026-08-13T04:13:34.957Z",
        "userKey": "ablais",
        "type": "UPDATE",
        "source": "TEST_CASE",
        "changeHistoryItems": [],
    }
    entry.update(overrides)
    return entry


BOILERPLATE_TEST_DATA = (
    '<span class="atwho-inserted">{User Roles}</span>\u2060 '
    '<span class="atwho-inserted">{Operating System}</span>\u2060 '
    '<span class="atwho-inserted">{Browser}</span>\u2060 '
)


def test_prettify_field_name_variants() -> None:
    assert prettify_field_name("PRECONDITION") == "Precondition"
    assert prettify_field_name("FOLDER") == "Folder"
    assert prettify_field_name('TEST_SCRIPT.STEP.DESCRIPTION {"step":3}') == "Step 3 — Description"
    assert prettify_field_name('TEST_SCRIPT.STEP.EXPECTED_RESULT {"step":12}') == "Step 12 — Expected Result"
    assert prettify_field_name('TEST_SCRIPT.STEP.TEST_DATA {"step":1}') == "Step 1 — Test Data"
    assert prettify_field_name("User Role") == "User Role"


def test_format_step_ranges_compresses() -> None:
    assert format_step_ranges([1, 2, 3, 5]) == "1-3, 5"
    assert format_step_ranges([4]) == "4"
    assert format_step_ranges([3, 1, 2]) == "1-3"


def test_transform_builds_record_with_sections_and_summary() -> None:
    entry = make_entry(
        changeHistoryItems=[
            {
                "id": 873157,
                "fieldName": "PRECONDITION",
                "originalValue": "<ol><li>Old precondition</li></ol>",
                "newValue": "<ol><li>New precondition</li></ol>",
            },
            {"id": 873158, "fieldName": 'TEST_SCRIPT.STEP.ADDED {"step":5}', "newValue": "-"},
            {"id": 873159, "fieldName": 'TEST_SCRIPT.STEP.ADDED {"step":6}', "newValue": "-"},
            {
                "id": 873160,
                "fieldName": 'TEST_SCRIPT.STEP.DESCRIPTION {"step":2}',
                "originalValue": "<p>Old step two</p>",
                "newValue": "<p>New step two</p>",
            },
            {"id": 873161, "fieldName": 'TEST_SCRIPT.STEP.TEST_DATA {"step":2}', "newValue": BOILERPLATE_TEST_DATA},
            {"id": 873182, "fieldName": 'TEST_SCRIPT.STEP.REMOVED {"step":1}', "originalValue": "-"},
        ]
    )

    record = transform_entry(entry, "TC-T14481", "Cart shipping address sync", BASE_URL)

    assert record is not None
    assert record["test_case_id"] == "TC-T14481"
    assert record["title"] == "Cart shipping address sync"
    assert record["test_case_url"] == f"{BASE_URL}/secure/Tests.jspa#/testCase/TC-T14481"
    assert record["changed_by"] == "ablais"
    assert record["change_date"] == "2026-08-13T04:13:34.957Z"
    assert record["status"] == "Imported"
    assert record["tags"] == ["zephyr-import"]
    assert record["zephyr_history_id"] == 547403
    assert record["associated_bugs"] == []
    assert record["associated_tasks"] == []
    assert (
        record["change_summary"]
        == "Updated Precondition; updated step 2; added steps 5-6; removed step 1"
    )
    assert "**Precondition**\n1. Old precondition" in record["before_state"]
    assert "**Precondition**\n1. New precondition" in record["after_state"]
    assert "**Step 2 — Description**\nNew step two" in record["after_state"]
    # Boilerplate TEST_DATA item was filtered out entirely.
    assert "Test Data" not in record["before_state"]
    assert "Test Data" not in record["after_state"]


def test_transform_drops_encoding_only_diffs() -> None:
    entry = make_entry(
        changeHistoryItems=[
            {
                "id": 871397,
                "fieldName": 'TEST_SCRIPT.STEP.DESCRIPTION {"step":3}',
                "originalValue": "<p>Wait &mdash; then refresh</p>",
                "newValue": "<p>Wait — then refresh</p>",
            }
        ]
    )

    assert transform_entry(entry, "TC-T14481", "Anything", BASE_URL) is None


def test_transform_keeps_folder_move_with_special_summary() -> None:
    entry = make_entry(
        id=547247,
        changeHistoryItems=[
            {
                "id": 871420,
                "fieldName": "FOLDER",
                "originalValue": "/Data Sync/WUP to AC/Cart Data",
                "newValue": "/Data Sync/Cart/WUP to AC",
            }
        ],
    )

    record = transform_entry(entry, "TC-T14481", "Anything", BASE_URL)

    assert record is not None
    assert record["change_summary"] == "Moved folder"
    assert "**Folder**\n/Data Sync/WUP to AC/Cart Data" in record["before_state"]
    assert "**Folder**\n/Data Sync/Cart/WUP to AC" in record["after_state"]


def test_transform_create_entry() -> None:
    entry = {
        "id": 547238,
        "sourceId": 30707,
        "historyDate": "2026-08-11T04:33:52.737Z",
        "userKey": "ablais",
        "type": "CREATE",
        "source": "TEST_CASE",
    }

    record = transform_entry(entry, "TC-T14481", "Cart shipping address sync", BASE_URL)

    assert record is not None
    assert record["change_summary"] == "Test case created"
    assert record["before_state"] == ""
    assert record["after_state"] == ""
    assert record["zephyr_history_id"] == 547238


def test_transform_missing_side_renders_dash_placeholder() -> None:
    entry = make_entry(
        changeHistoryItems=[
            {
                "id": 871394,
                "fieldName": "User Role",
                "newValue": "SNIS-PCSI",
            }
        ]
    )

    record = transform_entry(entry, "TC-T14481", "Anything", BASE_URL)

    assert record is not None
    assert record["change_summary"] == "Updated User Role"
    assert "**User Role**\n—" in record["before_state"]
    assert "**User Role**\nSNIS-PCSI" in record["after_state"]


def test_html_to_rich_text_converts_zephyr_markup() -> None:
    from services.zephyr_import_service import html_to_rich_text

    value = (
        "<ol><li><strong>User role:</strong> professional.</li>"
        "<li>Note the <code>Cart #</code>.<pre>SELECT 1\nFROM t</pre></li></ol>"
    )
    assert html_to_rich_text(value) == (
        "1. **User role:** professional.\n2. Note the Cart #.\nSELECT 1\nFROM t"
    )
    assert html_to_rich_text("<p>one</p><p>two &mdash; three</p>") == "one\n\ntwo — three"
    assert html_to_rich_text("<ul><li>a</li><li>b</li></ul>") == "- a\n- b"
    assert html_to_rich_text(None) == ""
    assert html_to_rich_text(123) == "123"


def test_transform_added_only_entry_has_summary_but_empty_states() -> None:
    entry = make_entry(
        changeHistoryItems=[
            {"id": 1, "fieldName": 'TEST_SCRIPT.STEP.ADDED {"step":5}', "newValue": "-"},
            {"id": 2, "fieldName": 'TEST_SCRIPT.STEP.ADDED {"step":6}', "newValue": "-"},
        ]
    )

    record = transform_entry(entry, "TC-T1", "Anything", BASE_URL)

    assert record is not None
    assert record["change_summary"] == "Added steps 5-6"
    assert record["before_state"] == ""
    assert record["after_state"] == ""


def test_transform_keeps_one_sided_placeholder_test_data() -> None:
    entry = make_entry(
        changeHistoryItems=[
            {
                "id": 3,
                "fieldName": 'TEST_SCRIPT.STEP.TEST_DATA {"step":1}',
                "originalValue": "<p>Real recorded data</p>",
                "newValue": BOILERPLATE_TEST_DATA,
            }
        ]
    )

    record = transform_entry(entry, "TC-T1", "Anything", BASE_URL)

    assert record is not None
    assert "Real recorded data" in record["before_state"]
    assert "{User Roles} {Operating System} {Browser}" in record["after_state"]


def test_transform_entry_without_id_is_skipped() -> None:
    entry = make_entry(id=None)
    entry["changeHistoryItems"] = [
        {"id": 9, "fieldName": "PRECONDITION", "originalValue": "<p>a</p>", "newValue": "<p>b</p>"}
    ]

    assert transform_entry(entry, "TC-T1", "Anything", BASE_URL) is None


def test_format_step_ranges_empty_returns_empty_string() -> None:
    assert format_step_ranges([]) == ""


def test_transform_tolerates_non_string_values() -> None:
    entry = make_entry(
        changeHistoryItems=[{"id": 4, "fieldName": "Estimate", "originalValue": 5, "newValue": 10}]
    )

    record = transform_entry(entry, "TC-T1", "Anything", BASE_URL)

    assert record is not None
    assert "**Estimate**\n5" in record["before_state"]
    assert "**Estimate**\n10" in record["after_state"]


def test_transform_tolerates_malformed_items_container() -> None:
    entry = make_entry(changeHistoryItems="not-a-list")

    assert transform_entry(entry, "TC-T1", "Anything", BASE_URL) is None


def test_html_to_rich_text_handles_block_tags() -> None:
    from services.zephyr_import_service import html_to_rich_text

    assert html_to_rich_text("<div>alpha</div><div>beta</div>") == "alpha\nbeta"
    assert html_to_rich_text("<h2>Setup</h2><h2>Teardown</h2>") == "**Setup**\n**Teardown**"
    assert (
        html_to_rich_text("<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>")
        == "a b\nc d"
    )


def test_html_to_rich_text_wraps_emphasis_per_line() -> None:
    from services.zephyr_import_service import html_to_rich_text

    assert html_to_rich_text("<strong>line one<br/>line two</strong>") == "**line one**\n**line two**"
    assert html_to_rich_text("x<strong></strong>y") == "xy"
    assert html_to_rich_text("<strong>a*b</strong>") == "**ab**"


def test_html_to_rich_text_preserves_falsy_values() -> None:
    from services.zephyr_import_service import html_to_rich_text

    assert html_to_rich_text(0) == "0"
    assert html_to_rich_text(None) == ""


def test_transform_preserves_zero_values() -> None:
    entry = make_entry(
        changeHistoryItems=[{"id": 5, "fieldName": "Estimate", "originalValue": 0, "newValue": 5}]
    )

    record = transform_entry(entry, "TC-T1", "Anything", BASE_URL)

    assert record is not None
    assert "**Estimate**\n0" in record["before_state"]
    assert "**Estimate**\n5" in record["after_state"]


def test_html_to_rich_text_deduplicates_nested_bold() -> None:
    from services.zephyr_import_service import html_to_rich_text

    assert html_to_rich_text("<h2><strong>Title</strong></h2>") == "**Title**"
    assert html_to_rich_text("<h3><b>Bold head</b> plus tail</h3>") == "**Bold head plus tail**"
