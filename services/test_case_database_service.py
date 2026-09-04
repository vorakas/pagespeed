"""Business logic for the Test Case Database."""

from __future__ import annotations

from urllib.parse import urlparse

from data_access.test_case_database_repository import TestCaseDatabaseRepository
from exceptions import ValidationError

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
VALID_STATUSES = {"Active", "Draft", "Superseded", "Archived"}
WRITABLE_STATUSES = {"Active", "Draft", "Superseded"}


class TestCaseDatabaseService:
    """Validate and normalize manual test case change records."""

    def __init__(self, repository: TestCaseDatabaseRepository) -> None:
        self._repository = repository

    def search_changes(
        self,
        query: str = "",
        test_case_id: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        include_archived: bool = False,
    ) -> list[dict]:
        normalized_status = self._validate_status(status, required=False)
        return self._repository.search_changes(
            query=(query or "").strip(),
            test_case_id=(test_case_id or "").strip() or None,
            status=normalized_status,
            tag=(tag or "").strip() or None,
            include_archived=include_archived,
        )

    def get_change(self, change_id: int) -> dict:
        change = self._repository.get_change(change_id)
        if not change:
            raise ValidationError("Test case change not found")
        return change

    def create_change(self, data: dict) -> dict:
        payload = self._normalize_payload(data)
        change_id = self._repository.create_change(payload)
        return self.get_change(change_id)

    def update_change(self, change_id: int, data: dict) -> dict:
        current = self.get_change(change_id)
        if current.get("archived_at"):
            raise ValidationError("Archived test case changes cannot be edited")
        payload = self._normalize_payload(data)
        if not self._repository.update_change(change_id, payload):
            raise ValidationError("Test case change not found")
        return self.get_change(change_id)

    def archive_change(self, change_id: int) -> dict:
        self.get_change(change_id)
        if not self._repository.archive_change(change_id):
            raise ValidationError("Test case change is already archived")
        return self.get_change(change_id)

    def list_change_attachments(self, change_id: int) -> list[dict]:
        self.get_change(change_id)
        return self._repository.list_change_attachments(change_id)

    def add_change_attachments(self, change_id: int, attachments: list[dict]) -> list[dict]:
        self.get_change(change_id)
        normalized_attachments = self._normalize_attachments(attachments)
        created_attachments = []
        for attachment in normalized_attachments:
            created_attachments.append(
                self.add_change_attachment(
                    change_id=change_id,
                    filename=attachment["filename"],
                    mime_type=attachment["mime_type"],
                    file_size=attachment["file_size"],
                    file_bytes=attachment["file_bytes"],
                )
            )
        return created_attachments

    def add_change_attachment(
        self,
        change_id: int,
        filename: str,
        mime_type: str,
        file_size: int,
        file_bytes: bytes,
    ) -> dict:
        self.get_change(change_id)
        filename = (filename or "").strip()
        mime_type = (mime_type or "").strip()
        if not filename:
            raise ValidationError("Attachment filename is required")
        if not file_bytes:
            raise ValidationError("Attachment file is required")
        if file_size > MAX_ATTACHMENT_BYTES or len(file_bytes) > MAX_ATTACHMENT_BYTES:
            raise ValidationError(f"Attachment '{filename}' exceeds the 10 MB limit")
        attachment_id = self._repository.create_change_attachment(
            change_id=change_id,
            filename=filename,
            mime_type=mime_type or "application/octet-stream",
            file_size=file_size,
            file_bytes=file_bytes,
        )
        attachment = self._repository.get_change_attachment(change_id, attachment_id)
        if not attachment:
            raise ValidationError("Attachment not found")
        attachment.pop("file_bytes", None)
        return attachment

    def get_change_attachment(self, change_id: int, attachment_id: int) -> dict:
        self.get_change(change_id)
        attachment = self._repository.get_change_attachment(change_id, attachment_id)
        if not attachment:
            raise ValidationError("Attachment not found")
        file_bytes = attachment.get("file_bytes")
        if isinstance(file_bytes, memoryview):
            attachment["file_bytes"] = file_bytes.tobytes()
        return attachment

    def delete_change_attachment(self, change_id: int, attachment_id: int) -> None:
        self.get_change(change_id)
        if not self._repository.delete_change_attachment(change_id, attachment_id):
            raise ValidationError("Attachment not found")

    def _normalize_attachments(self, attachments: object) -> list[dict]:
        if not isinstance(attachments, list) or not attachments:
            raise ValidationError("At least one attachment file is required")

        normalized_attachments = []
        for raw_attachment in attachments:
            if not isinstance(raw_attachment, dict):
                raise ValidationError("Attachment file is required")
            filename = (raw_attachment.get("filename") or "").strip()
            mime_type = (raw_attachment.get("mime_type") or "").strip()
            file_bytes = raw_attachment.get("file_bytes") or b""
            file_size = raw_attachment.get("file_size")
            if isinstance(file_bytes, memoryview):
                file_bytes = file_bytes.tobytes()
            if not isinstance(file_bytes, bytes):
                raise ValidationError("Attachment file is required")
            if not isinstance(file_size, int):
                file_size = len(file_bytes)
            self._validate_attachment(
                filename=filename,
                mime_type=mime_type,
                file_size=file_size,
                file_bytes=file_bytes,
            )
            normalized_attachments.append(
                {
                    "filename": filename,
                    "mime_type": mime_type,
                    "file_size": file_size,
                    "file_bytes": file_bytes,
                }
            )
        return normalized_attachments

    def _validate_attachment(
        self,
        filename: str,
        mime_type: str,
        file_size: int,
        file_bytes: bytes,
    ) -> None:
        del mime_type
        if not filename:
            raise ValidationError("Attachment filename is required")
        if not file_bytes:
            raise ValidationError("Attachment file is required")
        if file_size > MAX_ATTACHMENT_BYTES or len(file_bytes) > MAX_ATTACHMENT_BYTES:
            raise ValidationError(f"Attachment '{filename}' exceeds the 10 MB limit")

    def _normalize_payload(self, data: dict) -> dict:
        self._require_object_payload(data)
        payload = {
            "test_case_id": self._trim(data.get("test_case_id")),
            "title": self._trim(data.get("title")),
            "test_case_url": self._trim(data.get("test_case_url")),
            "change_summary": self._trim(data.get("change_summary")),
            "before_state": self._trim(data.get("before_state")),
            "after_state": self._trim(data.get("after_state")),
            "changed_by": self._trim(data.get("changed_by")),
            "change_date": self._trim(data.get("change_date")),
            "status": self._validate_status(
                data.get("status") or "Active",
                allow_archived=False,
            ),
            "tags": self._normalize_tags(data.get("tags")),
            "associated_bugs": self._normalize_links(
                data.get("associated_bugs"),
                "Associated Bugs",
            ),
            "associated_tasks": self._normalize_links(
                data.get("associated_tasks"),
                "Associated Tasks",
            ),
        }
        if not payload["test_case_id"]:
            raise ValidationError("Test case ID is required")
        if not payload["title"]:
            raise ValidationError("Title is required")
        if not payload["change_summary"]:
            raise ValidationError("Change summary is required")
        if payload["test_case_url"]:
            self._validate_http_url(
                payload["test_case_url"],
                "Test case URL must be an http or https URL",
            )
        return payload

    def _require_object_payload(self, data: object) -> None:
        if not isinstance(data, dict):
            raise ValidationError("Request body must be a JSON object")

    def _normalize_links(self, value: object, label: str) -> list[dict]:
        if not value:
            return []
        if not isinstance(value, list):
            raise ValidationError(f"{label} must be a list")
        links = []
        for index, raw_link in enumerate(value, start=1):
            if not isinstance(raw_link, dict):
                raise ValidationError(f"{label} row {index} must be an object")
            row_label = self._trim(raw_link.get("label"))
            row_url = self._trim(raw_link.get("url"))
            if not row_label:
                raise ValidationError(f"{label} row {index} label is required")
            if not row_url:
                raise ValidationError(f"{label} row {index} URL is required")
            self._validate_http_url(
                row_url,
                f"{label} row {index} URL must be an http or https URL",
            )
            links.append({"label": row_label, "url": row_url})
        return links

    def _validate_http_url(self, value: str, message: str) -> None:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValidationError(message)

    def _validate_status(
        self,
        status: str | None,
        required: bool = True,
        allow_archived: bool = True,
    ) -> str | None:
        value = self._trim(status)
        if not value:
            if required:
                raise ValidationError("Status is required")
            return None
        if value not in VALID_STATUSES:
            raise ValidationError(f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        if not allow_archived and value not in WRITABLE_STATUSES:
            raise ValidationError("Archived status is only set by archive_change")
        return value

    def _normalize_tags(self, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            raw_tags = value.split(",")
        elif isinstance(value, list):
            raw_tags = value
        else:
            raise ValidationError("Tags must be a list or comma-separated string")
        tags = []
        for raw_tag in raw_tags:
            tag = self._trim(raw_tag)
            if tag and tag not in tags:
                tags.append(tag)
        return tags

    def _trim(self, value: object) -> str:
        return str(value or "").strip()
