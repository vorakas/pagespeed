"""AI usage pricing and routing helpers."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any


MODEL_PRICING_USD_PER_1M: dict[str, dict[str, dict[str, Decimal]]] = {
    "openai": {
        "gpt-5.2": {"input": Decimal("1.75"), "output": Decimal("14.00")},
        "gpt-5.1": {"input": Decimal("1.25"), "output": Decimal("10.00")},
        "gpt-5": {"input": Decimal("1.25"), "output": Decimal("10.00")},
        "gpt-5-mini": {"input": Decimal("0.25"), "output": Decimal("2.00")},
        "gpt-5-nano": {"input": Decimal("0.05"), "output": Decimal("0.40")},
        "gpt-4.1": {"input": Decimal("2.00"), "output": Decimal("8.00")},
        "gpt-4.1-mini": {"input": Decimal("0.40"), "output": Decimal("1.60")},
        "gpt-4.1-nano": {"input": Decimal("0.10"), "output": Decimal("0.40")},
        "gpt-4o": {"input": Decimal("2.50"), "output": Decimal("10.00")},
        "gpt-4o-mini": {"input": Decimal("0.15"), "output": Decimal("0.60")},
    },
    "claude": {
        "claude-sonnet-4-6": {"input": Decimal("3.00"), "output": Decimal("15.00")},
        "claude-sonnet-4-5": {"input": Decimal("3.00"), "output": Decimal("15.00")},
        "claude-sonnet-4": {"input": Decimal("3.00"), "output": Decimal("15.00")},
        "claude-sonnet-4-20250514": {"input": Decimal("3.00"), "output": Decimal("15.00")},
        "claude-haiku-4-5": {"input": Decimal("1.00"), "output": Decimal("5.00")},
        "claude-3-5-haiku": {"input": Decimal("0.80"), "output": Decimal("4.00")},
        "claude-3-haiku": {"input": Decimal("0.25"), "output": Decimal("1.25")},
        "claude-opus-4": {"input": Decimal("15.00"), "output": Decimal("75.00")},
        "claude-opus-4-1": {"input": Decimal("15.00"), "output": Decimal("75.00")},
    },
}

AI_TRIGGER_TERMS = {
    "analyze",
    "compare",
    "explain",
    "how",
    "interpret",
    "should",
    "summarize",
    "summary",
    "synthesize",
    "why",
}


def normalize_provider(provider: str) -> str:
    return (provider or "").strip().lower()


def normalize_model(provider: str, model: str) -> str:
    provider_key = normalize_provider(provider)
    model_key = (model or "").strip().lower()
    if provider_key == "openai":
        if model_key.startswith("gpt-4.1-mini"):
            return "gpt-4.1-mini"
        if model_key.startswith("gpt-4.1-nano"):
            return "gpt-4.1-nano"
        if model_key.startswith("gpt-4.1"):
            return "gpt-4.1"
        if model_key.startswith("gpt-4o-mini"):
            return "gpt-4o-mini"
        if model_key.startswith("gpt-4o"):
            return "gpt-4o"
        if model_key.startswith("gpt-5-mini"):
            return "gpt-5-mini"
        if model_key.startswith("gpt-5-nano"):
            return "gpt-5-nano"
        if model_key.startswith("gpt-5.2"):
            return "gpt-5.2"
        if model_key.startswith("gpt-5.1"):
            return "gpt-5.1"
        if model_key.startswith("gpt-5"):
            return "gpt-5"
    if provider_key == "claude":
        if "sonnet-4-6" in model_key or "sonnet-4.6" in model_key:
            return "claude-sonnet-4-6"
        if "sonnet-4-5" in model_key or "sonnet-4.5" in model_key:
            return "claude-sonnet-4-5"
        if "sonnet-4" in model_key:
            return "claude-sonnet-4-20250514" if "20250514" in model_key else "claude-sonnet-4"
        if "haiku-4-5" in model_key or "haiku-4.5" in model_key:
            return "claude-haiku-4-5"
        if "haiku-3.5" in model_key or "3-5-haiku" in model_key:
            return "claude-3-5-haiku"
        if "haiku-3" in model_key or "3-haiku" in model_key:
            return "claude-3-haiku"
        if "opus-4.1" in model_key or "opus-4-1" in model_key:
            return "claude-opus-4-1"
        if "opus-4" in model_key:
            return "claude-opus-4"
    return model_key


def estimate_ai_cost(provider: str, model: str, usage: dict[str, Any]) -> dict[str, Any]:
    provider_key = normalize_provider(provider)
    model_key = normalize_model(provider_key, model)
    input_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    output_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    pricing = MODEL_PRICING_USD_PER_1M.get(provider_key, {}).get(model_key)

    if not pricing:
        return {
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "estimatedCost": 0.0,
            "pricingFound": False,
        }

    cost = (
        Decimal(input_tokens) * pricing["input"] / Decimal(1_000_000)
        + Decimal(output_tokens) * pricing["output"] / Decimal(1_000_000)
    )
    rounded = cost.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    return {
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "estimatedCost": float(rounded),
        "pricingFound": True,
    }


def should_use_ai_for_requirement_question(question: str, scored_chunks: list[dict[str, Any]]) -> bool:
    if not scored_chunks:
        return False

    normalized = f" {(question or '').strip().lower()} "
    has_trigger = any(f" {term} " in normalized for term in AI_TRIGGER_TERMS)
    if has_trigger and len(scored_chunks) >= 2:
        return True

    best_score = max(int(chunk.get("score", 0) or 0) for chunk in scored_chunks)
    return has_trigger and best_score < 3
