"""OpenAI GPT AI service client.

Wraps the ``openai`` SDK to provide analysis and multi-turn
follow-up.  Raises domain exceptions — never returns error dicts.
"""

from __future__ import annotations

from config import MAX_AI_TOKENS
from exceptions import AIServiceError, AuthenticationError
from services.ai_base import AIServiceBase


class OpenAIClient(AIServiceBase):
    """Client for the OpenAI Chat Completions API.

    Args:
        api_key: OpenAI API key.
        model:   Model identifier (e.g. ``'gpt-4o'``).
    """

    def __init__(self, api_key: str, model: str = "gpt-4o") -> None:
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
            AIServiceError:      On any other OpenAI API failure.
        """
        self._validate_key()
        from openai import OpenAI

        client = OpenAI(api_key=self._api_key)

        try:
            response = client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=MAX_AI_TOKENS,
                temperature=0.3,
            )
        except Exception as exc:
            self._handle_error(exc)

        return self._parse_response(response)

    def follow_up(self, system_prompt: str, messages: list[dict]) -> dict:
        """Continue a multi-turn conversation.

        Args:
            system_prompt: System-level instructions (same as initial).
            messages:      Full conversation history.

        Returns:
            Same shape as :meth:`analyze`.

        Raises:
            AuthenticationError: On invalid API key.
            AIServiceError:      On any other OpenAI API failure.
        """
        self._validate_key()
        from openai import OpenAI

        client = OpenAI(api_key=self._api_key)
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        try:
            response = client.chat.completions.create(
                model=self._model,
                messages=full_messages,
                max_tokens=MAX_AI_TOKENS,
                temperature=0.3,
            )
        except Exception as exc:
            self._handle_error(exc)

        return self._parse_response(response)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _validate_key(self) -> None:
        """Ensure an API key is configured."""
        if not self._api_key:
            raise AuthenticationError("OpenAI API key not configured", provider="OpenAI")

    @staticmethod
    def _parse_response(response: object) -> dict:
        """Extract analysis text and token usage from an OpenAI response.

        Args:
            response: ``openai.types.chat.ChatCompletion`` object.

        Returns:
            Dict with ``analysis``, ``model``, and ``usage`` keys.
        """
        return {
            "analysis": response.choices[0].message.content,
            "model": response.model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
            },
        }

    @staticmethod
    def _handle_error(exc: Exception) -> None:
        """Translate OpenAI exceptions into domain exceptions.

        Raises:
            AuthenticationError: On auth-related errors.
            AIServiceError:      On all other errors.
        """
        error_msg = str(exc)
        lower_msg = error_msg.lower()

        if "authentication" in lower_msg or "api key" in lower_msg:
            raise AuthenticationError("Invalid OpenAI API key", provider="OpenAI") from exc
        if "rate limit" in lower_msg:
            raise AIServiceError(
                "OpenAI API rate limit exceeded. Please try again shortly.",
                provider="OpenAI",
            ) from exc
        raise AIServiceError(f"Error calling OpenAI API: {error_msg}", provider="OpenAI") from exc
