"""Server-side AI provider configuration storage."""

from __future__ import annotations

from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


DEFAULT_AI_MODELS = {
    "claude": "claude-sonnet-4-6",
    "openai": "gpt-5.5",
}


class AiConfigService:
    """Persist global AI API keys and model choices.

    Keys are stored server-side and returned to browsers only as masked status.
    """

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    def get_public_config(self) -> dict[str, Any]:
        return {
            "claude": self._public_provider_config("claude"),
            "openai": self._public_provider_config("openai"),
        }

    def save_config(self, data: dict[str, Any]) -> dict[str, Any]:
        for provider in ("claude", "openai"):
            model = (data.get(f"{provider}_model") or "").strip() or DEFAULT_AI_MODELS[provider]
            api_key = data.get(f"{provider}_api_key")
            self._upsert_provider(provider, model, api_key if isinstance(api_key, str) else None)
        return self.get_public_config()

    def get_provider_credentials(self, provider: str) -> dict[str, str]:
        provider_key = self._normalize_provider(provider)
        if provider_key not in DEFAULT_AI_MODELS:
            return {"provider": provider_key, "apiKey": "", "model": ""}
        row = self._get_provider_row(provider_key)
        return {
            "provider": provider_key,
            "apiKey": (row or {}).get("api_key") or "",
            "model": (row or {}).get("model") or DEFAULT_AI_MODELS[provider_key],
        }

    def merge_request_provider(
        self,
        provider: str,
        request_api_key: str | None,
        request_model: str | None,
    ) -> dict[str, str]:
        saved = self.get_provider_credentials(provider)
        return {
            "provider": saved["provider"],
            "apiKey": (request_api_key or "").strip() or saved["apiKey"],
            "model": (request_model or "").strip() or saved["model"],
        }

    def _public_provider_config(self, provider: str) -> dict[str, Any]:
        provider_key = self._normalize_provider(provider)
        row = self._get_provider_row(provider_key)
        api_key = (row or {}).get("api_key") or ""
        return {
            "model": (row or {}).get("model") or DEFAULT_AI_MODELS[provider_key],
            "hasApiKey": bool(api_key),
            "apiKeyMasked": self._mask_key(api_key) if api_key else None,
        }

    def _get_provider_row(self, provider: str) -> dict | None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(f"SELECT * FROM ai_provider_config WHERE provider = {ph}", (provider,))
                return self._cm.row_to_dict(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to load AI provider config: {exc}") from exc

    def _upsert_provider(self, provider: str, model: str, api_key: str | None) -> None:
        existing = self._get_provider_row(provider)
        current_key = (existing or {}).get("api_key") or ""
        next_key = api_key.strip() if api_key and not self._looks_masked(api_key) else current_key
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                if existing:
                    cursor.execute(
                        f"""
                        UPDATE ai_provider_config
                        SET api_key = {ph}, model = {ph}, updated_at = CURRENT_TIMESTAMP
                        WHERE provider = {ph}
                        """,
                        (next_key, model, provider),
                    )
                else:
                    cursor.execute(
                        f"""
                        INSERT INTO ai_provider_config (provider, api_key, model)
                        VALUES ({ph}, {ph}, {ph})
                        """,
                        (provider, next_key, model),
                    )
        except Exception as exc:
            raise DatabaseError(f"Failed to save AI provider config: {exc}") from exc

    @staticmethod
    def _normalize_provider(provider: str) -> str:
        provider_key = (provider or "").strip().lower()
        return "claude" if provider_key == "anthropic" else provider_key

    @staticmethod
    def _mask_key(api_key: str) -> str:
        if len(api_key) <= 10:
            return "saved"
        return f"{api_key[:7]}...{api_key[-4:]}"

    @staticmethod
    def _looks_masked(api_key: str) -> bool:
        value = api_key.strip()
        return value == "saved" or "..." in value or value.startswith("••")
