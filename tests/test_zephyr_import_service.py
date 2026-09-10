import pytest
import requests

from services.zephyr_import_service import ZephyrImportService


class FakeClient:
    def __init__(self) -> None:
        self.test_cases = [
            {"key": "TC-T1", "name": "Case One"},
            {"key": "TC-T2", "name": "Case Two"},
        ]
        self.versions = {"TC-T1": [101], "TC-T2": [201, 202]}
        self.histories = {
            101: [
                {
                    "id": 9001,
                    "historyDate": "2026-08-13T04:13:34.957Z",
                    "userKey": "ablais",
                    "type": "UPDATE",
                    "changeHistoryItems": [
                        {"id": 1, "fieldName": "PRECONDITION", "originalValue": "<p>a</p>", "newValue": "<p>b</p>"}
                    ],
                },
                {
                    "id": 9002,
                    "historyDate": "2026-08-11T04:33:52.737Z",
                    "userKey": "ablais",
                    "type": "UPDATE",
                    # Encoding-only diff -> filtered out entirely (skippedEmpty).
                    "changeHistoryItems": [
                        {"id": 2, "fieldName": "OBJECTIVE", "originalValue": "<p>x &mdash; y</p>", "newValue": "<p>x — y</p>"}
                    ],
                },
            ],
            # Both versions of TC-T2 return the same entry -> merged by entry id.
            201: [
                {
                    "id": 9003,
                    "historyDate": "2026-08-01T00:00:00.000Z",
                    "userKey": "ablais",
                    "type": "UPDATE",
                    "changeHistoryItems": [
                        {"id": 3, "fieldName": "OBJECTIVE", "originalValue": "<p>old</p>", "newValue": "<p>new</p>"}
                    ],
                },
            ],
            202: [
                {
                    "id": 9003,
                    "historyDate": "2026-08-01T00:00:00.000Z",
                    "userKey": "ablais",
                    "type": "UPDATE",
                    "changeHistoryItems": [
                        {"id": 3, "fieldName": "OBJECTIVE", "originalValue": "<p>old</p>", "newValue": "<p>new</p>"}
                    ],
                },
            ],
        }

    def search_test_cases(self, project_key, folder):
        assert project_key == "TC"
        assert folder == "/Data Sync"
        return self.test_cases

    def version_ids(self, key):
        return self.versions[key]

    def fetch_history(self, numeric_id):
        return self.histories[numeric_id]


class FakeRepository:
    def __init__(self, existing=frozenset()) -> None:
        self.existing = set(existing)
        self.created: list[dict] = []

    def existing_zephyr_history_ids(self, history_ids):
        return self.existing & set(history_ids)

    def create_change(self, data):
        self.created.append(data)
        return len(self.created)


def make_service(repo=None, client=None) -> ZephyrImportService:
    return ZephyrImportService(
        jira_pat="token",
        repository=repo or FakeRepository(),
        client=client or FakeClient(),
    )


def test_run_import_creates_deduped_records_and_counts() -> None:
    repo = FakeRepository()
    service = make_service(repo=repo)

    summary = service.run_import("TC", "/Data Sync")

    assert summary["testCases"] == 2
    assert summary["recordsCreated"] == 2  # 9001 update + 9003 update (dup across versions); 9002 was noise
    assert summary["skippedExisting"] == 0
    assert summary["skippedEmpty"] == 1
    assert summary["failures"] == []
    created_ids = {record["zephyr_history_id"] for record in repo.created}
    assert created_ids == {9001, 9003}
    titles = {record["test_case_id"]: record["title"] for record in repo.created}
    assert titles == {"TC-T1": "Case One", "TC-T2": "Case Two"}


def test_run_import_skips_already_imported_entries() -> None:
    repo = FakeRepository(existing={9001})
    summary = make_service(repo=repo).run_import("TC", "/Data Sync")

    assert summary["recordsCreated"] == 1
    assert summary["skippedExisting"] == 1
    assert {record["zephyr_history_id"] for record in repo.created} == {9003}


def test_run_import_collects_per_case_failures() -> None:
    client = FakeClient()

    def broken_versions(key):
        if key == "TC-T2":
            raise requests.ConnectionError("boom")
        return {"TC-T1": [101]}[key]

    client.version_ids = broken_versions
    repo = FakeRepository()

    summary = make_service(repo=repo, client=client).run_import("TC", "/Data Sync")

    assert summary["recordsCreated"] == 1
    assert summary["failures"] == [{"key": "TC-T2", "error": "boom"}]


def test_run_import_requires_pat() -> None:
    service = ZephyrImportService(jira_pat="", repository=FakeRepository(), client=FakeClient())
    with pytest.raises(ValueError, match="JIRA_PAT is not configured"):
        service.run_import("TC", "/Data Sync")


def test_run_import_counts_insert_failures_as_failures() -> None:
    class ExplodingRepository(FakeRepository):
        def create_change(self, data):
            if data["zephyr_history_id"] == 9001:
                raise RuntimeError("UNIQUE constraint failed: test_case_changes.zephyr_history_id")
            return super().create_change(data)

    repo = ExplodingRepository()
    summary = make_service(repo=repo).run_import("TC", "/Data Sync")

    assert summary["recordsCreated"] == 1
    assert {record["zephyr_history_id"] for record in repo.created} == {9003}
    assert summary["failures"] == [
        {"key": "TC-T1", "error": "UNIQUE constraint failed: test_case_changes.zephyr_history_id"}
    ]


def test_run_import_ignores_cases_without_key() -> None:
    client = FakeClient()
    client.test_cases = [{"name": "No key"}, {"key": "TC-T1", "name": "Case One"}]

    summary = make_service(client=client).run_import("TC", "/Data Sync")

    assert summary["testCases"] == 1
