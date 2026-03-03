"""Abstract base class for AI service providers.

Defines the contract that ``ClaudeClient`` and ``OpenAIClient`` must
fulfil so the ``AIOrchestrator`` can treat them interchangeably.
"""

from abc import ABC, abstractmethod


class AIServiceBase(ABC):
    """Interface for AI analysis providers.

    Each concrete implementation wraps a single provider SDK and
    translates provider-specific errors into domain exceptions.
    """

    @abstractmethod
    def analyze(self, system_prompt: str, user_message: str) -> dict:
        """Run an initial analysis.

        Args:
            system_prompt: Role instructions for the model.
            user_message:  The data payload to analyse.

        Returns:
            Dict with keys ``analysis`` (str), ``model`` (str), and
            ``usage`` (dict with token counts).

        Raises:
            AIServiceError:       On provider API failures.
            AuthenticationError:  On invalid / expired credentials.
        """

    @abstractmethod
    def follow_up(self, system_prompt: str, messages: list[dict]) -> dict:
        """Continue a multi-turn conversation.

        Args:
            system_prompt: Role instructions (same as initial analysis).
            messages:      Conversation history as ``[{"role": ..., "content": ...}]``.

        Returns:
            Same shape as :meth:`analyze`.

        Raises:
            AIServiceError:       On provider API failures.
            AuthenticationError:  On invalid / expired credentials.
        """
