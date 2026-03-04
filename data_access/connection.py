"""Database connection management and query-building helpers.

Single Responsibility: this class owns the connection lifecycle, dialect
differences (PostgreSQL vs SQLite), and schema initialisation.  Repository
classes depend on it for connections and dialect-aware helpers, but never
import database drivers or branch on the database engine themselves.
"""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg2
import psycopg2.extras

from config import DATABASE_URL
from exceptions import DatabaseError

_SQLITE_PATH = "pagespeed.db"


class ConnectionManager:
    """Manages database connections and abstracts dialect differences.

    Args:
        db_url: PostgreSQL connection string.  Falls back to the
                ``DATABASE_URL`` env-var, then to a local SQLite file.
    """

    def __init__(self, db_url: str | None = None) -> None:
        self._db_url: str | None = db_url or DATABASE_URL

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    @property
    def _is_postgres(self) -> bool:
        return self._db_url is not None

    def _create_connection(self) -> Any:
        """Open a raw connection (caller is responsible for closing)."""
        if self._is_postgres:
            return psycopg2.connect(self._db_url)
        conn = sqlite3.connect(_SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    @contextmanager
    def get_connection(self) -> Iterator[Any]:
        """Context manager that yields a connection.

        * On clean exit the transaction is committed.
        * On exception the transaction is rolled back and the error
          propagates.
        * The connection is always closed in the ``finally`` block.
        """
        conn = self._create_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    # ------------------------------------------------------------------
    # Dialect helpers (package-internal — used by repositories)
    # ------------------------------------------------------------------

    def _placeholder(self) -> str:
        """Parameter placeholder for the active engine."""
        return "%s" if self._is_postgres else "?"

    def _returning_id(self) -> str:
        """SQL clause appended to INSERT to retrieve the new row id."""
        return " RETURNING id" if self._is_postgres else ""

    def _last_insert_id(self, cursor: Any) -> int:
        """Return the id produced by the most recent INSERT.

        For PostgreSQL the INSERT must include a ``RETURNING id`` clause
        (use :meth:`_returning_id`).  For SQLite, ``cursor.lastrowid``
        is used.
        """
        if self._is_postgres:
            return cursor.fetchone()[0]
        return cursor.lastrowid

    def _date_ago_expression(self) -> str:
        """SQL expression for *now minus N days* with one placeholder."""
        ph = self._placeholder()
        if self._is_postgres:
            return f"NOW() - INTERVAL '{ph} days'"
        return f"datetime('now', '-' || {ph} || ' days')"

    def _is_integrity_error(self, exc: Exception) -> bool:
        """Return ``True`` if *exc* is a unique-constraint violation."""
        return isinstance(exc, (sqlite3.IntegrityError, psycopg2.IntegrityError))

    # ------------------------------------------------------------------
    # Result-set conversion
    # ------------------------------------------------------------------

    def _rows_to_dicts(self, cursor: Any) -> list[dict]:
        """Convert all remaining rows to a list of dicts.

        Handles both psycopg2 (``cursor.description``) and sqlite3
        (``sqlite3.Row``) result types in one place.
        """
        rows = cursor.fetchall()
        if not rows:
            return []
        if self._is_postgres:
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
        return [dict(row) for row in rows]

    def _row_to_dict(self, cursor: Any) -> dict | None:
        """Fetch a single row and return it as a dict, or ``None``."""
        row = cursor.fetchone()
        if row is None:
            return None
        if self._is_postgres:
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        return dict(row)

    # ------------------------------------------------------------------
    # Schema initialisation
    # ------------------------------------------------------------------

    def init_schema(self) -> None:
        """Create tables and run migrations.

        Safe to call on every startup — uses ``IF NOT EXISTS`` guards
        and tolerates already-applied column additions.
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            if self._is_postgres:
                self._init_postgres_schema(cursor)
            else:
                self._init_sqlite_schema(cursor)

    # -- private schema helpers ----------------------------------------

    def _init_postgres_schema(self, cursor: Any) -> None:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sites (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS urls (
                id SERIAL PRIMARY KEY,
                site_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (site_id) REFERENCES sites (id),
                UNIQUE(site_id, url)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_results (
                id SERIAL PRIMARY KEY,
                url_id INTEGER NOT NULL,
                performance_score REAL,
                accessibility_score REAL,
                best_practices_score REAL,
                seo_score REAL,
                fcp REAL,
                lcp REAL,
                cls REAL,
                tti REAL,
                tbt REAL,
                speed_index REAL,
                inp REAL,
                ttfb REAL,
                total_byte_weight REAL,
                raw_data TEXT,
                strategy TEXT DEFAULT 'desktop',
                tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (url_id) REFERENCES urls (id)
            )
        """)

        cursor.execute("ALTER TABLE test_results ADD COLUMN IF NOT EXISTS inp REAL")
        cursor.execute("ALTER TABLE test_results ADD COLUMN IF NOT EXISTS ttfb REAL")
        cursor.execute("ALTER TABLE test_results ADD COLUMN IF NOT EXISTS total_byte_weight REAL")
        cursor.execute("ALTER TABLE test_results ADD COLUMN IF NOT EXISTS strategy TEXT DEFAULT 'desktop'")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_triggers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                schedule_type TEXT NOT NULL,
                schedule_value TEXT NOT NULL,
                strategy TEXT NOT NULL DEFAULT 'desktop',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trigger_urls (
                id SERIAL PRIMARY KEY,
                trigger_id INTEGER NOT NULL,
                url_id INTEGER NOT NULL,
                FOREIGN KEY (trigger_id) REFERENCES scheduled_triggers (id),
                FOREIGN KEY (url_id) REFERENCES urls (id),
                UNIQUE(trigger_id, url_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schedule_presets (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                cron_expression TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migration: add trigger execution tracking columns
        cursor.execute("ALTER TABLE scheduled_triggers ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP")
        cursor.execute("ALTER TABLE scheduled_triggers ADD COLUMN IF NOT EXISTS last_run_status TEXT")

    def _init_sqlite_schema(self, cursor: Any) -> None:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                site_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (site_id) REFERENCES sites (id),
                UNIQUE(site_id, url)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url_id INTEGER NOT NULL,
                performance_score REAL,
                accessibility_score REAL,
                best_practices_score REAL,
                seo_score REAL,
                fcp REAL,
                lcp REAL,
                cls REAL,
                tti REAL,
                tbt REAL,
                speed_index REAL,
                inp REAL,
                ttfb REAL,
                total_byte_weight REAL,
                raw_data TEXT,
                strategy TEXT DEFAULT 'desktop',
                tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (url_id) REFERENCES urls (id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_triggers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                schedule_type TEXT NOT NULL,
                schedule_value TEXT NOT NULL,
                strategy TEXT NOT NULL DEFAULT 'desktop',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trigger_urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trigger_id INTEGER NOT NULL,
                url_id INTEGER NOT NULL,
                FOREIGN KEY (trigger_id) REFERENCES scheduled_triggers (id),
                FOREIGN KEY (url_id) REFERENCES urls (id),
                UNIQUE(trigger_id, url_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schedule_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                cron_expression TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # SQLite lacks IF NOT EXISTS for ALTER TABLE — tolerate failures.
        _SQLITE_MIGRATIONS = [
            "ALTER TABLE test_results ADD COLUMN inp REAL",
            "ALTER TABLE test_results ADD COLUMN ttfb REAL",
            "ALTER TABLE test_results ADD COLUMN total_byte_weight REAL",
            "ALTER TABLE test_results ADD COLUMN strategy TEXT DEFAULT 'desktop'",
            "ALTER TABLE scheduled_triggers ADD COLUMN last_run_at TIMESTAMP",
            "ALTER TABLE scheduled_triggers ADD COLUMN last_run_status TEXT",
        ]
        for statement in _SQLITE_MIGRATIONS:
            try:
                cursor.execute(statement)
            except sqlite3.OperationalError:
                pass  # Column already exists
