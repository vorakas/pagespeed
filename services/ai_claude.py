"""Anthropic Claude AI service client.

Wraps the ``anthropic`` SDK to provide analysis and multi-turn
follow-up.  Raises domain exceptions — never returns error dicts.
"""

from __future__ import annotations

from typing import Optional

from config import MAX_AI_TOKENS
from exceptions import AIServiceError, AuthenticationError
from services.ai_base import AIServiceBase


class ClaudeClient(AIServiceBase):
    """Client for the Anthropic Claude Messages API.

    Args:
        api_key: Anthropic API key.
        model:   Model identifier (e.g. ``'claude-sonnet-4-20250514'``).
    """

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514") -> None:
        self._api_key: str = api_key
        self._model: str = model

    def analyze(self, system_prompt: str, user_message: str) -> dict:
        """Run an initial analysis.

        Args:
            system_prompt: System-level instructions for the model.
            user_message:  The data payload to analyse.

        Returns:
            Dict with ``analysis``, ``model``, and ``usage`` keys.

        Raises:
            AuthenticationError: On invalid API key.
            AIServiceError:      On any other Claude API failure.
        """
        self._validate_key()
        import anthropic

        client = anthropic.Anthropic(api_key=self._api_key)

        try:
            message = client.messages.create(
                model=self._model,
                max_tokens=MAX_AI_TOKENS,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
        except anthropic.AuthenticationError as exc:
            raise AuthenticationError("Invalid Claude API key", provider="Claude") from exc
        except anthropic.RateLimitError as exc:
            raise AIServiceError(
                "Claude API rate limit exceeded. Please try again shortly.",
                provider="Claude",
            ) from exc
        except anthropic.APIError as exc:
            raise AIServiceError(f"Claude API error: {exc}", provider="Claude") from exc
        except Exception as exc:
            raise AIServiceError(f"Error calling Claude API: {exc}", provider="Claude") from exc

        return self._parse_response(message)

    def follow_up(self, system_prompt: str, messages: list[dict]) -> dict:
        """Continue a multi-turn conversation.

        Args:
            system_prompt: System-level instructions (same as initial).
            messages:      Full conversation history.

        Returns:
            Same shape as :meth:`analyze`.

        Raises:
            AuthenticationError: On invalid API key.
            AIServiceError:      On any other Claude API failure.
        """
        self._validate_key()
        import anthropic

        client = anthropic.Anthropic(api_key=self._api_key)

        try:
            message = client.messages.create(
                model=self._model,
                max_tokens=MAX_AI_TOKENS,
                system=system_prompt,
                messages=messages,
            )
        except anthropic.AuthenticationError as exc:
            raise AuthenticationError("Invalid Claude API key", provider="Claude") from exc
        except anthropic.RateLimitError as exc:
            raise AIServiceError(
                "Claude API rate limit exceeded. Please try again shortly.",
                provider="Claude",
            ) from exc
        except anthropic.APIError as exc:
            raise AIServiceError(f"Claude API error: {exc}", provider="Claude") from exc
        except Exception as exc:
            raise AIServiceError(f"Error calling Claude API: {exc}", provider="Claude") from exc

        return self._parse_response(message)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _validate_key(self) -> None:
        """Ensure an API key is configured."""
        if not self._api_key:
            raise AuthenticationError("Claude API key not configured", provider="Claude")

    def _parse_response(self, message: object) -> dict:
        """Extract analysis text and token usage from a Claude response.

        Args:
            message: ``anthropic.types.Message`` object.

        Returns:
            Dict with ``analysis``, ``model``, and ``usage`` keys.
        """
        analysis_text = "".join(
            block.text for block in message.content if block.type == "text"
        )
        return {
            "analysis": analysis_text,
            "model": self._model,
            "usage": {
                "input_tokens": message.usage.input_tokens,
                "output_tokens": message.usage.output_tokens,
            },
        }
