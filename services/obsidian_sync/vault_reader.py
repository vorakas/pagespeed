"""Read-only view of the Obsidian vault on disk.

Separated from the sync path so the Flask API can serve vault content
without pulling the sync machinery into its import graph.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


_FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_YAML_KEY_RE = re.compile(r"^([A-Za-z0-9_]+):\s*(.*)$")
_WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


@dataclass(frozen=True)
class VaultNode:
    """One entry in the vault tree — either a directory or a markdown file."""

    path: str          # POSIX relative path from vault root
    name: str          # last path segment
    is_dir: bool
    children: List["VaultNode"] = None  # type: ignore[assignment]

    def to_dict(self) -> dict:
        out: dict = {"path": self.path, "name": self.name, "isDir": self.is_dir}
        if self.is_dir and self.children is not None:
            out["children"] = [c.to_dict() for c in self.children]
        return out


class VaultNotFoundError(Exception):
    """Raised when the configured vault root is missing."""


class VaultPathError(Exception):
    """Raised when a requested path escapes or is invalid."""


class VaultReader:
    """Reads the vault filesystem safely.

    Prevents path-traversal (`..`, absolute paths) and limits file types to
    markdown + common plaintext. Binary content is NOT served here.
    """

    _ALLOWED_EXTS = frozenset({".md", ".markdown", ".txt"})

    def __init__(self, vault_root: str) -> None:
        self._root: Path = Path(vault_root).resolve()

    @property
    def root(self) -> Path:
        return self._root

    def exists(self) -> bool:
        return self._root.is_dir()

    def tree(self, subdir: str = "", max_depth: int = 6) -> VaultNode:
        """Return the vault tree rooted at ``subdir`` (relative to vault root)."""
        if not self.exists():
            raise VaultNotFoundError(str(self._root))

        start = self._resolve(subdir) if subdir else self._root
        if not start.is_dir():
            raise VaultPathError(f"Not a directory: {subdir}")

        return self._walk(start, depth=0, max_depth=max_depth)

    def read_page(self, rel_path: str) -> dict:
        """Return markdown content + parsed frontmatter + wikilinks."""
        target = self._resolve(rel_path)
        if not target.is_file():
            raise VaultPathError(f"Not a file: {rel_path}")
        if target.suffix.lower() not in self._ALLOWED_EXTS:
            raise VaultPathError(f"Unsupported file type: {target.suffix}")

        text = target.read_text(encoding="utf-8", errors="replace")
        frontmatter, body = _split_frontmatter(text)
        wikilinks = _WIKILINK_RE.findall(body)
        return {
            "path": target.relative_to(self._root).as_posix(),
            "name": target.name,
            "raw": text,
            "body": body,
            "frontmatter": frontmatter,
            "wikilinks": wikilinks,
            "size": target.stat().st_size,
            "modified": target.stat().st_mtime,
        }

    # ── internals ────────────────────────────────────────────────────

    def _resolve(self, rel_path: str) -> Path:
        if not rel_path or rel_path in {".", "/"}:
            return self._root
        cleaned = rel_path.replace("\\", "/").lstrip("/")
        candidate = (self._root / cleaned).resolve()
        try:
            candidate.relative_to(self._root)
        except ValueError as exc:
            raise VaultPathError(f"Path escapes vault root: {rel_path}") from exc
        return candidate

    def _walk(self, directory: Path, depth: int, max_depth: int) -> VaultNode:
        rel = directory.relative_to(self._root).as_posix() or ""
        name = directory.name or self._root.name

        if depth >= max_depth:
            return VaultNode(path=rel, name=name, is_dir=True, children=[])

        children: List[VaultNode] = []
        try:
            entries = sorted(
                directory.iterdir(),
                key=lambda p: (not p.is_dir(), p.name.lower()),
            )
        except PermissionError:
            return VaultNode(path=rel, name=name, is_dir=True, children=[])

        for entry in entries:
            if entry.name.startswith("."):
                continue  # hide .obsidian, .claude, etc.
            if entry.is_dir():
                children.append(self._walk(entry, depth + 1, max_depth))
            elif entry.suffix.lower() in self._ALLOWED_EXTS:
                children.append(
                    VaultNode(
                        path=entry.relative_to(self._root).as_posix(),
                        name=entry.name,
                        is_dir=False,
                    )
                )
        return VaultNode(path=rel, name=name, is_dir=True, children=children)


def _split_frontmatter(text: str) -> tuple[Dict[str, str], str]:
    """Split YAML frontmatter from body. Returns ({} , original_text) if absent.

    This is a deliberately tiny YAML parser — only top-level ``key: value``
    pairs, no nested structures. Callers that need full YAML should parse
    ``raw`` themselves.
    """
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}, text

    frontmatter: Dict[str, str] = {}
    for line in match.group(1).splitlines():
        line = line.rstrip()
        if not line or line.startswith("#"):
            continue
        m = _YAML_KEY_RE.match(line)
        if not m:
            continue
        key, value = m.group(1), m.group(2).strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        frontmatter[key] = value
    body = text[match.end():]
    return frontmatter, body
