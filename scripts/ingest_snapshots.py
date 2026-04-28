"""CLI: ingest migration status snapshots from the Obsidian vault.

Usage:
    python -m scripts.ingest_snapshots                 # ingest every status file on disk
    python -m scripts.ingest_snapshots PATH [PATH ...]  # ingest specific files

Typically you don't need to run this manually — ``app.py`` seeds on boot
and the Obsidian sync service re-ingests after each sync. This CLI is
useful when bootstrapping a fresh DB or testing the parser against a
markdown file outside the vault.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# Make sibling packages importable when run as ``python scripts/ingest_snapshots.py``.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import OBSIDIAN_VAULT_ROOT  # noqa: E402
from data_access import ConnectionManager, SnapshotRepository  # noqa: E402
from services.obsidian_sync.vault_reader import VaultReader  # noqa: E402
from services.snapshot_service import SnapshotService  # noqa: E402


def main(argv: list[str]) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    conn = ConnectionManager()
    conn.init_schema()
    repo = SnapshotRepository(conn)
    service = SnapshotService(repo, VaultReader(OBSIDIAN_VAULT_ROOT))

    if len(argv) > 1:
        targets = [Path(p).resolve() for p in argv[1:]]
        dates: list[str] = []
        for target in targets:
            if not target.is_file():
                print(f"skip (not a file): {target}", file=sys.stderr)
                continue
            record = service.ingest_path(target)
            if record is not None:
                dates.append(record.date)
                print(f"ingested {record.date} ← {target}")
        print(f"\nDone. {len(dates)} snapshot(s) upserted.")
        return 0

    dates = service.ingest_vault()
    for d in dates:
        print(f"ingested {d}")
    print(f"\nDone. {len(dates)} snapshot(s) upserted from {OBSIDIAN_VAULT_ROOT}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
