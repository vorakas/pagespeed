import pytest

from exceptions import ValidationError
from services.knowledge_service import KnowledgeService


class FakeKnowledgeRepository:
    def __init__(self):
        self.domains = {}
        self.entries = {}
        self.next_domain_id = 1
        self.next_entry_id = 1

    def list_domains(self, include_archived=False):
        domains = list(self.domains.values())
        if not include_archived:
            domains = [domain for domain in domains if domain["archived_at"] is None]
        return domains

    def get_domain(self, domain_id):
        return self.domains.get(domain_id)

    def create_domain(self, name, description=""):
        if any(domain["name"] == name for domain in self.domains.values()):
            return None

        domain_id = self.next_domain_id
        self.next_domain_id += 1
        self.domains[domain_id] = {
            "id": domain_id,
            "name": name,
            "description": description,
            "created_at": "2026-08-24T00:00:00",
            "updated_at": "2026-08-24T00:00:00",
            "archived_at": None,
        }
        return domain_id

    def update_domain(self, domain_id, name, description):
        if domain_id not in self.domains:
            return False

        if any(
            domain["id"] != domain_id and domain["name"] == name
            for domain in self.domains.values()
        ):
            return False

        self.domains[domain_id]["name"] = name
        self.domains[domain_id]["description"] = description
        return True

    def archive_domain(self, domain_id):
        if domain_id not in self.domains:
            return False

        self.domains[domain_id]["archived_at"] = "2026-08-24T00:00:00"
        return True

    def get_entry(self, entry_id):
        entry = self.entries.get(entry_id)
        if entry is None:
            return None

        return {**entry, "domain_name": self.domains[entry["domain_id"]]["name"]}

    def create_entry(self, data):
        entry_id = self.next_entry_id
        self.next_entry_id += 1
        self.entries[entry_id] = {
            "id": entry_id,
            **data,
            "created_at": "2026-08-24T00:00:00",
            "updated_at": "2026-08-24T00:00:00",
        }
        return entry_id

    def update_entry(self, entry_id, data):
        if entry_id not in self.entries:
            return False

        self.entries[entry_id].update(data)
        return True

    def archive_entry(self, entry_id):
        if entry_id not in self.entries:
            return False

        self.entries[entry_id]["status"] = "Archived"
        return True

    def search_entries(
        self,
        query="",
        domain_id=None,
        entry_type=None,
        status=None,
        tag=None,
        include_archived=False,
    ):
        return [
            self.get_entry(entry_id)
            for entry_id, entry in self.entries.items()
            if include_archived or entry["status"] != "Archived"
        ]


def make_service():
    repo = FakeKnowledgeRepository()
    return KnowledgeService(repo), repo


def test_create_domain_trims_name_and_description():
    service, _ = make_service()

    domain = service.create_domain("  Adobe Commerce Migration  ", "  Launch facts  ")

    assert domain["name"] == "Adobe Commerce Migration"
    assert domain["description"] == "Launch facts"


def test_create_domain_requires_name():
    service, _ = make_service()

    with pytest.raises(ValidationError, match="Domain name is required"):
        service.create_domain("   ", "description")


def test_duplicate_domain_raises_validation_error():
    service, _ = make_service()
    service.create_domain("Pharos")

    with pytest.raises(ValidationError, match="already exists"):
        service.create_domain("Pharos")


def test_create_entry_requires_domain_type_title_details():
    service, _ = make_service()

    with pytest.raises(ValidationError, match="Domain is required"):
        service.create_entry({})

    with pytest.raises(ValidationError, match="Entry type is required"):
        service.create_entry({"domain_id": 1})

    with pytest.raises(ValidationError, match="Title is required"):
        service.create_entry({"domain_id": 1, "entry_type": "Decision"})

    with pytest.raises(ValidationError, match="Details are required"):
        service.create_entry(
            {"domain_id": 1, "entry_type": "Decision", "title": "Source of truth"}
        )


def test_create_entry_rejects_unknown_type_and_status():
    service, _ = make_service()
    domain = service.create_domain("Adobe Commerce Migration")

    with pytest.raises(ValidationError, match="Invalid entry type"):
        service.create_entry(
            {
                "domain_id": domain["id"],
                "entry_type": "Note",
                "title": "Source of truth",
                "details": "Migration team owns checkout requirements.",
            }
        )

    with pytest.raises(ValidationError, match="Invalid status"):
        service.create_entry(
            {
                "domain_id": domain["id"],
                "entry_type": "Decision",
                "status": "Open",
                "title": "Source of truth",
                "details": "Migration team owns checkout requirements.",
            }
        )


def test_create_entry_rejects_archived_domain():
    service, _ = make_service()
    domain = service.create_domain("Adobe Commerce Migration")
    service.archive_domain(domain["id"])

    with pytest.raises(
        ValidationError, match="Cannot create entries in archived domain"
    ):
        service.create_entry(
            {
                "domain_id": domain["id"],
                "entry_type": "Decision",
                "title": "Source of truth",
                "details": "Migration team owns checkout requirements.",
            }
        )


def test_create_entry_defaults_status_to_active_and_normalizes_tags_list():
    service, _ = make_service()
    domain = service.create_domain("Adobe Commerce Migration")

    entry = service.create_entry(
        {
            "domain_id": domain["id"],
            "entry_type": "Decision",
            "title": "  Source of truth  ",
            "details": "  Migration team owns checkout requirements.  ",
            "source": "  meeting notes  ",
            "tags": [" checkout ", "", " launch ", "  "],
        }
    )

    assert entry["status"] == "Active"
    assert entry["title"] == "Source of truth"
    assert entry["details"] == "Migration team owns checkout requirements."
    assert entry["source"] == "meeting notes"
    assert entry["tags"] == "checkout,launch"
