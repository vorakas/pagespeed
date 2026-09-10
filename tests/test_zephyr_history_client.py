from unittest.mock import MagicMock, patch

from services.zephyr_history_client import ZephyrHistoryClient


def _response(payload):
    response = MagicMock()
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


def make_client() -> ZephyrHistoryClient:
    return ZephyrHistoryClient(jira_pat="token", jira_base_url="https://lampstrack.example.com/")


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_paginates_and_sends_bearer(mock_get) -> None:
    page_one = [
        {"key": f"TC-T{i}", "name": f"Case {i}", "folder": "/Data Sync/Cart"} for i in range(100)
    ]
    page_two = [{"key": "TC-T100", "name": "Case 100", "folder": "/Data Sync"}]
    mock_get.side_effect = [_response(page_one), _response(page_two)]

    client = make_client()
    results = client.search_test_cases("TC", "/Data Sync")

    assert len(results) == 101
    first_call = mock_get.call_args_list[0]
    assert first_call.args[0] == "https://lampstrack.example.com/rest/atm/1.0/testcase/search"
    assert first_call.kwargs["params"]["query"] == 'projectKey = "TC"'
    assert first_call.kwargs["headers"]["Authorization"] == "Bearer token"
    second_call = mock_get.call_args_list[1]
    assert second_call.kwargs["params"]["startAt"] == 100


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_handles_dict_payload_and_dedupes(mock_get) -> None:
    mock_get.return_value = _response(
        {
            "results": [
                {"key": "TC-T1", "name": "One", "folder": "/Data Sync/Cart"},
                {"key": "TC-T1", "name": "One", "folder": "/Data Sync/Cart"},
            ]
        }
    )

    results = make_client().search_test_cases("TC", "/Data Sync")

    assert [row["key"] for row in results] == ["TC-T1"]


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_filters_to_folder_subtree(mock_get) -> None:
    mock_get.return_value = _response(
        [
            {"key": "TC-T1", "name": "In subtree", "folder": "/Data Sync/Cart/WUP to AC"},
            {"key": "TC-T2", "name": "Exact folder", "folder": "/Data Sync"},
            {"key": "TC-T3", "name": "Sibling prefix", "folder": "/Data Sync 2/Cart"},
            {"key": "TC-T4", "name": "Elsewhere", "folder": "/Adobe/Regression"},
            {"key": "TC-T5", "name": "No folder"},
        ]
    )

    results = make_client().search_test_cases("TC", "/Data Sync/")

    assert [row["key"] for row in results] == ["TC-T1", "TC-T2"]


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_escapes_quotes_in_project_key(mock_get) -> None:
    mock_get.return_value = _response([])

    make_client().search_test_cases('T"C', "/Data Sync")

    query = mock_get.call_args.kwargs["params"]["query"]
    assert query == 'projectKey = "T\\"C"'


@patch("services.zephyr_history_client.requests.get")
def test_version_ids_extracts_ints(mock_get) -> None:
    mock_get.return_value = _response([{"id": 30707}, {"id": "30901"}, {"id": None}])

    ids = make_client().version_ids("TC-T14481")

    assert ids == [30707, 30901]
    call = mock_get.call_args
    assert call.args[0] == "https://lampstrack.example.com/rest/tests/1.0/testcase/TC-T14481/allVersions"
    assert call.kwargs["params"] == {"fields": "id"}


@patch("services.zephyr_history_client.requests.get")
def test_fetch_history_returns_list_or_empty(mock_get) -> None:
    mock_get.return_value = _response([{"id": 547403}])
    assert make_client().fetch_history(30707) == [{"id": 547403}]

    mock_get.return_value = _response({"unexpected": True})
    assert make_client().fetch_history(30707) == []
