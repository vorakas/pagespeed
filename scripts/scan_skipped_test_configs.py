"""Scan the C# test-automation sources for discovery-skipped tests.

Tests declared with ``[Theory(Skip = "...")]`` are skipped at xUnit
discovery time, so Azure DevOps never records the ``InlineData`` config
against the test result — meaning our Skipped Tests panel has no config
string to derive a user-role pill from.

The config is present in the source as ``[InlineData(TestConfiguration.X)]``.
This script walks every ``*.cs`` file under the test-automation repo,
maps each ``public class T####_<Name>`` that carries a ``[Theory(Skip=...)]``
to its first ``InlineData`` config, and writes the mapping to
``data/skipped_test_configs.json`` for pagespeed-monitor to load at
runtime.

Re-run this whenever the test suite changes:

    python scripts/scan_skipped_test_configs.py [path/to/AzureTestAutomation]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Iterable

_CLASS_RE = re.compile(
    r"^\s*public\s+(?:abstract\s+|sealed\s+|static\s+)?class\s+"
    r"(T\d+\w*)",
)
_THEORY_SKIP_RE = re.compile(r"\[\s*Theory\s*\(\s*Skip\b")
_INLINE_DATA_RE = re.compile(
    r"\[\s*InlineData\s*\(\s*TestConfiguration\.(\w+)"
)


def _scan_file(path: Path) -> dict[str, str]:
    """Return ``{class_name: config}`` for discovery-skipped theories in one file.

    If a class exposes multiple ``InlineData`` rows under a single
    ``[Theory(Skip=...)]``, the first one wins — they almost always
    share the same user-role suffix, which is what the UI cares about.
    """
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return {}

    results: dict[str, str] = {}

    for idx, line in enumerate(lines):
        if not _THEORY_SKIP_RE.search(line):
            continue

        enclosing_class = _find_enclosing_class(lines, idx)
        if not enclosing_class:
            continue

        first_config = _find_first_inline_data(lines, idx)
        if not first_config:
            continue

        # First Theory(Skip) per class wins — a class typically has one
        # Theory method anyway.
        results.setdefault(enclosing_class, first_config)

    return results


def _find_enclosing_class(lines: list[str], theory_idx: int) -> str | None:
    """Walk back from ``theory_idx`` to the nearest ``public class T####_*``."""
    for k in range(theory_idx - 1, -1, -1):
        match = _CLASS_RE.search(lines[k])
        if match:
            return match.group(1)
    return None


def _find_first_inline_data(lines: list[str], theory_idx: int) -> str | None:
    """Walk forward from Theory attribute, through sibling attributes only."""
    j = theory_idx + 1
    while j < len(lines):
        stripped = lines[j].strip()
        if not stripped:
            j += 1
            continue
        if stripped.startswith("["):
            match = _INLINE_DATA_RE.search(lines[j])
            if match:
                return match.group(1)
            # Another attribute (e.g. [Trait]) — keep scanning.
            j += 1
            continue
        # Method declaration or anything else — stop.
        return None
    return None


def scan_tree(source_root: Path) -> dict[str, str]:
    """Aggregate ``{class_name: config}`` across every ``*.cs`` under root."""
    aggregate: dict[str, str] = {}
    files: Iterable[Path] = source_root.rglob("*.cs")
    for cs_file in files:
        for cls, config in _scan_file(cs_file).items():
            aggregate.setdefault(cls, config)
    return dict(sorted(aggregate.items()))


def main() -> int:
    default_source = Path(r"C:\repos\AzureTestAutomation")
    source_root = Path(sys.argv[1]) if len(sys.argv) > 1 else default_source

    if not source_root.is_dir():
        print(f"ERROR: source root not found: {source_root}", file=sys.stderr)
        return 1

    output_path = Path(__file__).resolve().parent.parent / "data" / "skipped_test_configs.json"
    output_path.parent.mkdir(exist_ok=True)

    mapping = scan_tree(source_root)
    output_path.write_text(json.dumps(mapping, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(mapping)} entries to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
