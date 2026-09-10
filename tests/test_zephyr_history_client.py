from unittest.mock import MagicMock, patch

from services.zephyr_history_client import ZephyrHistoryClient


def _response(payload):
    response = MagicMock()
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


def make_client() -> ZephyrHistoryClient:
    return ZephyrHistoryClient(jira_pat="token", jira_base_url="https://lampstrack.example.com/")


PROJECT_RESPONSE = {"id": "14210", "key": "TC"}

FOLDER_TREE = {
    "projectId": 14210,
    "children": [
        {
            "name": "Data Sync",
            "itemsCount": 3,
            "children": [
                {
                    "name": "Cart",
                    "itemsCount": 2,
                    "children": [{"name": "WUP to AC", "itemsCount": 2, "children": []}],
                }
            ],
        },
        {"name": "Adobe Commerce E2E", "itemsCount": 426, "children": []},
    ],
}


@patch("services.zephyr_history_client.requests.get")
def test_folder_paths_walks_subtree(mock_get) -> None:
    mock_get.return_value = _response(FOLDER_TREE)

    paths = make_client().folder_paths(14210, "/Data Sync/")

    assert paths == ["/Data Sync", "/Data Sync/Cart", "/Data Sync/Cart/WUP to AC"]
    call = mock_get.call_args
    assert call.args[0] == "https://lampstrack.example.com/rest/tests/1.0/project/14210/foldertree/testcase"


@patch("services.zephyr_history_client.requests.get")
def test_folder_paths_missing_folder_returns_empty(mock_get) -> None:
    mock_get.return_value = _response(FOLDER_TREE)

    assert make_client().folder_paths(14210, "/Nope") == []
    assert make_client().folder_paths(14210, "") == []


@patch("services.zephyr_history_client.requests.get")
def test_project_id_resolves_key(mock_get) -> None:
    mock_get.return_value = _response(PROJECT_RESPONSE)

    assert make_client().project_id("TC") == 14210
    call = mock_get.call_args
    assert call.args[0] == "https://lampstrack.example.com/rest/api/2/project/TC"


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_queries_each_subtree_folder_exactly(mock_get) -> None:
    mock_get.side_effect = [
        _response(PROJECT_RESPONSE),
        _response(FOLDER_TREE),
        _response([{"key": "TC-T1", "name": "One", "folder": "/Data Sync"}]),
        _response([{"key": "TC-T2", "name": "Two", "folder": "/Data Sync/Cart"}]),
        _response(
            [
                {"key": "TC-T3", "name": "Three", "folder": "/Data Sync/Cart/WUP to AC"},
                {"key": "TC-T3", "name": "Three", "folder": "/Data Sync/Cart/WUP to AC"},
            ]
        ),
    ]

    results = make_client().search_test_cases("TC", "/Data Sync")

    assert [row["key"] for row in results] == ["TC-T1", "TC-T2", "TC-T3"]
    search_calls = mock_get.call_args_list[2:]
    queries = [call.kwargs["params"]["query"] for call in search_calls]
    assert queries == [
        'projectKey = "TC" AND folder = "/Data Sync"',
        'projectKey = "TC" AND folder = "/Data Sync/Cart"',
        'projectKey = "TC" AND folder = "/Data Sync/Cart/WUP to AC"',
    ]
    assert search_calls[0].kwargs["headers"]["Authorization"] == "Bearer token"


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_paginates_within_a_folder(mock_get) -> None:
    tree = {"projectId": 14210, "children": [{"name": "Data Sync", "children": []}]}
    page_one = [
        {"key": f"TC-T{i}", "name": f"Case {i}", "folder": "/Data Sync"} for i in range(100)
    ]
    page_two = [{"key": "TC-T100", "name": "Case 100", "folder": "/Data Sync"}]
    mock_get.side_effect = [
        _response(PROJECT_RESPONSE),
        _response(tree),
        _response(page_one),
        _response(page_two),
    ]

    results = make_client().search_test_cases("TC", "/Data Sync")

    assert len(results) == 101
    second_search = mock_get.call_args_list[3]
    assert second_search.kwargs["params"]["startAt"] == 100


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_escapes_quotes(mock_get) -> None:
    tree = {"projectId": 1, "children": [{"name": 'Data "Sync"', "children": []}]}
    mock_get.side_effect = [
        _response({"id": "1"}),
        _response(tree),
        _response([]),
    ]

    make_client().search_test_cases('T"C', '/Data "Sync"')

    query = mock_get.call_args.kwargs["params"]["query"]
    assert query == 'projectKey = "T\\"C" AND folder = "/Data \\"Sync\\""'


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
