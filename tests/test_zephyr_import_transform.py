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
    '<span class="atwho-inserted">{User Roles}</span>⁠ '
    '<span class="atwho-inserted">{Operating System}</span>⁠ '
    '<span class="atwho-inserted">{Browser}</span>⁠ '
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
    assert "<h4>Precondition</h4><ol><li>Old precondition</li></ol>" in record["before_state"]
    assert "<h4>Precondition</h4><ol><li>New precondition</li></ol>" in record["after_state"]
    assert "<h4>Step 2 — Description</h4><p>New step two</p>" in record["after_state"]
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
    assert "/Data Sync/WUP to AC/Cart Data" in record["before_state"]
    assert "/Data Sync/Cart/WUP to AC" in record["after_state"]


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
    assert "<h4>User Role</h4><p>—</p>" in record["before_state"]
    assert "<h4>User Role</h4>SNIS-PCSI" in record["after_state"]
