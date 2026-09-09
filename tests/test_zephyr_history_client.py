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
    page_one = [{"key": f"TC-T{i}", "name": f"Case {i}"} for i in range(100)]
    page_two = [{"key": "TC-T100", "name": "Case 100"}]
    mock_get.side_effect = [_response(page_one), _response(page_two)]

    client = make_client()
    results = client.search_test_cases(14210, "/Data Sync")

    assert len(results) == 101
    first_call = mock_get.call_args_list[0]
    assert first_call.args[0] == "https://lampstrack.example.com/rest/atm/1.0/testcase/search"
    assert first_call.kwargs["params"]["query"] == 'projectId = 14210 AND folder = "/Data Sync"'
    assert first_call.kwargs["headers"]["Authorization"] == "Bearer token"
    second_call = mock_get.call_args_list[1]
    assert second_call.kwargs["params"]["startAt"] == 100


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_handles_dict_payload_and_dedupes(mock_get) -> None:
    mock_get.return_value = _response(
        {"results": [{"key": "TC-T1", "name": "One"}, {"key": "TC-T1", "name": "One"}]}
    )

    results = make_client().search_test_cases(14210, "/Data Sync")

    assert [row["key"] for row in results] == ["TC-T1"]


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
