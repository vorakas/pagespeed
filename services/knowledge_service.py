"""Business logic for Knowledge Ledger domains and entries."""

from data_access.knowledge_repository import KnowledgeRepository
from enums import KnowledgeEntryType, KnowledgeStatus
from exceptions import ValidationError


class KnowledgeService:
    """Validate and normalize Knowledge Ledger data before persistence."""

    def __init__(self, repository: KnowledgeRepository) -> None:
        self._repository = repository

    def list_domains(self, include_archived: bool = False) -> list[dict]:
        return self._repository.list_domains(include_archived=include_archived)

    def create_domain(self, name: str, description: str = "") -> dict:
        name = self._trim(name)
        description = self._trim(description)

        if not name:
            raise ValidationError("Domain name is required")

        domain_id = self._repository.create_domain(name, description)
        if domain_id is None:
            raise ValidationError(f"Domain '{name}' already exists")

        domain = self._repository.get_domain(domain_id)
        if domain is None:
            raise ValidationError("Domain not found")
        return domain

    def update_domain(self, domain_id: int, name: str, description: str = "") -> dict:
        if not self._repository.get_domain(domain_id):
            raise ValidationError("Domain not found")

        name = self._trim(name)
        description = self._trim(description)

        if not name:
            raise ValidationError("Domain name is required")

        if not self._repository.update_domain(domain_id, name, description):
            raise ValidationError(f"Domain '{name}' already exists")

        domain = self._repository.get_domain(domain_id)
        if domain is None:
            raise ValidationError("Domain not found")
        return domain

    def archive_domain(self, domain_id: int) -> dict:
        domain = self._repository.get_domain(domain_id)
        if domain is None:
            raise ValidationError("Domain not found")
        if domain.get("archived_at"):
            raise ValidationError("Domain is already archived")

        if not self._repository.archive_domain(domain_id):
            raise ValidationError("Domain not found")

        archived_domain = self._repository.get_domain(domain_id)
        if archived_domain is None:
            raise ValidationError("Domain not found")
        return archived_domain

    def search_entries(
        self,
        query: str = "",
        domain_id: int | None = None,
        entry_type: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        include_archived: bool = False,
        include_archived_domains: bool = False,
    ) -> list[dict]:
        normalized_domain_id = self._normalize_domain_id(domain_id, required=False)
        entry_type = self._validate_entry_type(entry_type, required=False)
        status = self._validate_status(status, required=False)

        return self._repository.search_entries(
            query=self._trim(query),
            domain_id=normalized_domain_id,
            entry_type=entry_type,
            status=status,
            tag=self._trim(tag),
            include_archived=include_archived,
            include_archived_domains=include_archived_domains,
        )

    def get_entry(self, entry_id: int) -> dict:
        entry = self._repository.get_entry(entry_id)
        if entry is None:
            raise ValidationError("Entry not found")
        return entry

    def create_entry(self, data: dict) -> dict:
        payload = self._normalize_entry_payload(data, require_fields=True)
        domain = self._repository.get_domain(payload["domain_id"])
        if domain is None:
            raise ValidationError("Domain not found")
        if domain.get("archived_at"):
            raise ValidationError("Cannot create entries in archived domain")

        entry_id = self._repository.create_entry(payload)
        return self.get_entry(entry_id)

    def update_entry(self, entry_id: int, data: dict) -> dict:
        existing = self.get_entry(entry_id)
        payload = self._normalize_entry_payload(
            {**existing, **data},
            require_fields=True,
        )

        domain = self._repository.get_domain(payload["domain_id"])
        if domain is None:
            raise ValidationError("Domain not found")
        if domain.get("archived_at") and payload["domain_id"] != existing["domain_id"]:
            raise ValidationError("Cannot move entries into archived domain")

        if not self._repository.update_entry(entry_id, payload):
            raise ValidationError("Entry not found")

        return self.get_entry(entry_id)

    def archive_entry(self, entry_id: int) -> dict:
        self.get_entry(entry_id)
        if not self._repository.archive_entry(entry_id):
            raise ValidationError("Entry not found")
        return self.get_entry(entry_id)

    def _normalize_entry_payload(self, data: dict, require_fields: bool) -> dict:
        domain_id = self._normalize_domain_id(data.get("domain_id"), required=require_fields)

        entry_type = self._validate_entry_type(
            data.get("entry_type"),
            required=require_fields,
        )
        status = self._validate_status(
            data.get("status", KnowledgeStatus.ACTIVE.value),
            required=require_fields,
        )

        title = self._trim(data.get("title"))
        if require_fields and not title:
            raise ValidationError("Title is required")

        details = self._trim(data.get("details"))
        if require_fields and not details:
            raise ValidationError("Details are required")

        return {
            "domain_id": domain_id,
            "entry_type": entry_type,
            "status": status or KnowledgeStatus.ACTIVE.value,
            "title": title,
            "details": details,
            "source": self._trim(data.get("source")),
            "tags": self._normalize_tags(data.get("tags")),
        }

    def _normalize_domain_id(self, value, required: bool) -> int | None:
        if value in (None, ""):
            if required:
                raise ValidationError("Domain is required")
            return None
        if isinstance(value, bool | float):
            raise ValidationError("domain_id must be a positive integer")

        try:
            domain_id = int(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError("domain_id must be a positive integer") from exc

        if domain_id <= 0:
            if required:
                raise ValidationError("Domain is required")
            raise ValidationError("domain_id must be a positive integer")

        return domain_id

    def _validate_entry_type(self, value: str | None, required: bool) -> str | None:
        value = self._trim(value)
        if required and not value:
            raise ValidationError("Entry type is required")
        if not value:
            return None
        if value not in {entry_type.value for entry_type in KnowledgeEntryType}:
            raise ValidationError(f"Invalid entry type: {value}")
        return value

    def _validate_status(self, value: str | None, required: bool) -> str | None:
        value = self._trim(value)
        if required and not value:
            raise ValidationError("Invalid status")
        if not value:
            return None
        if value not in {status.value for status in KnowledgeStatus}:
            raise ValidationError(f"Invalid status: {value}")
        return value

    def _normalize_tags(self, value) -> str:
        if isinstance(value, list):
            tags = [self._trim(tag) for tag in value]
        else:
            tags = [
                self._trim(tag)
                for tag in self._trim(value).split(",")
            ] if value is not None else []
        return ",".join(tag for tag in tags if tag)

    @staticmethod
    def _trim(value) -> str:
        if value is None:
            return ""
        return str(value).strip()
