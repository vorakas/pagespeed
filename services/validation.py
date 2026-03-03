"""Shared validation helpers used across service classes.

These are pure functions with no framework dependencies. They raise
``ValidationError`` on invalid input so that callers never need to
inspect return-value dicts for error information.
"""

from exceptions import ValidationError


def validate_required_fields(data: dict, fields: list[str]) -> None:
    """Raise ``ValidationError`` if *data* is missing any of *fields*.

    A field is considered missing when its key is absent **or** its value
    is falsy (``None``, empty string, etc.).

    Args:
        data:   The dictionary to validate (typically parsed JSON from a request).
        fields: Names of keys that must be present and non-empty.

    Raises:
        ValidationError: Lists every missing field in one error message.
    """
    missing: list[str] = [f for f in fields if not data.get(f)]
    if missing:
        label = "field" if len(missing) == 1 else "fields"
        names = ", ".join(missing)
        raise ValidationError(f"Missing required {label}: {names}")


def parse_time_range_to_minutes(time_range: str) -> int:
    """Convert an NRQL-style time range string to an integer minute count.

    Supported formats (case-insensitive):
        ``"30 minutes ago"``, ``"1 hour ago"``, ``"3 hours ago"``,
        ``"1 day ago"``, ``"7 days ago"``

    Args:
        time_range: The human-readable time range string.

    Returns:
        Equivalent number of minutes. Defaults to **60** (one hour)
        when the string cannot be parsed.
    """
    try:
        parts = time_range.lower().split()
        value = int(parts[0])
        unit = parts[1]
        if "hour" in unit:
            return value * 60
        if "minute" in unit:
            return value
        if "day" in unit:
            return value * 1440
    except (IndexError, ValueError):
        pass
    return 60
