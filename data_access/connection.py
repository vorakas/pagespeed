"""Database connection management and query-building helpers.

Single Responsibility: this class owns the connection lifecycle, dialect
differences (PostgreSQL vs SQLite), and schema initialisation.  Repository
classes depend on it for connections and dialect-aware helpers, but never
import database drivers or branch on the database engine themselves.
"""

import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg2
import psycopg2.extras
import psycopg2.pool

from config import DATABASE_URL, DB_POOL_MAX_CONNECTIONS, DB_POOL_MIN_CONNECTIONS
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
        self._pool: psycopg2.pool.ThreadedConnectionPool | None = None
        self._pool_lock = threading.Lock()

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    @property
    def is_postgres(self) -> bool:
        return self._db_url is not None

    @property
    def _is_postgres(self) -> bool:
        """Backward-compatible alias for older repository code."""
        return self.is_postgres

    def _get_pool(self) -> psycopg2.pool.ThreadedConnectionPool:
        """Return the process-local PostgreSQL connection pool."""
        if self._pool is None:
            with self._pool_lock:
                if self._pool is None:
                    self._pool = psycopg2.pool.ThreadedConnectionPool(
                        DB_POOL_MIN_CONNECTIONS,
                        DB_POOL_MAX_CONNECTIONS,
                        self._db_url,
                    )
        return self._pool

    def _create_connection(self) -> Any:
        """Borrow a connection from the pool or open a local SQLite connection."""
        if self.is_postgres:
            return self._get_pool().getconn()
        conn = sqlite3.connect(_SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _release_connection(self, conn: Any, discard: bool = False) -> None:
        """Return a PostgreSQL connection to the pool, or close SQLite."""
        if self.is_postgres:
            pool = self._pool
            if pool is not None:
                pool.putconn(conn, close=discard)
            return
        conn.close()

    def close_all(self) -> None:
        """Close all pooled PostgreSQL connections owned by this process."""
        if self._pool is None:
            return
        with self._pool_lock:
            if self._pool is not None:
                self._pool.closeall()
                self._pool = None

    @contextmanager
    def get_connection(self) -> Iterator[Any]:
        """Context manager that yields a connection.

        * On clean exit the transaction is committed.
        * On exception the transaction is rolled back and the error
          propagates.
        * PostgreSQL connections are returned to the pool in ``finally``.
          SQLite connections are closed, matching local-dev behavior.
        """
        conn = self._create_connection()
        discard = False
        try:
            yield conn
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                discard = True
            raise
        finally:
            if self.is_postgres and getattr(conn, "closed", 0):
                discard = True
            self._release_connection(conn, discard=discard)

    # ------------------------------------------------------------------
    # Dialect helpers (package-internal — used by repositories)
    # ------------------------------------------------------------------

    def placeholder(self) -> str:
        """Parameter placeholder for the active engine."""
        return "%s" if self.is_postgres else "?"

    def returning_id(self) -> str:
        """SQL clause appended to INSERT to retrieve the new row id."""
        return " RETURNING id" if self.is_postgres else ""

    def last_insert_id(self, cursor: Any) -> int:
        """Return the id produced by the most recent INSERT.

        For PostgreSQL the INSERT must include a ``RETURNING id`` clause
        (use :meth:`returning_id`).  For SQLite, ``cursor.lastrowid``
        is used.
        """
        if self.is_postgres:
            return cursor.fetchone()[0]
        return cursor.lastrowid

    def date_ago_expression(self) -> str:
        """SQL expression for *now minus N days* with one placeholder."""
        ph = self.placeholder()
        if self.is_postgres:
            return f"NOW() - INTERVAL '{ph} days'"
        return f"datetime('now', '-' || {ph} || ' days')"

    def is_integrity_error(self, exc: Exception) -> bool:
        """Return ``True`` if *exc* is a unique-constraint violation."""
        return isinstance(exc, (sqlite3.IntegrityError, psycopg2.IntegrityError))

    def _placeholder(self) -> str:
        """Backward-compatible alias for older repository code."""
        return self.placeholder()

    def _returning_id(self) -> str:
        """Backward-compatible alias for older repository code."""
        return self.returning_id()

    def _last_insert_id(self, cursor: Any) -> int:
        """Backward-compatible alias for older repository code."""
        return self.last_insert_id(cursor)

    def _date_ago_expression(self) -> str:
        """Backward-compatible alias for older repository code."""
        return self.date_ago_expression()

    def _is_integrity_error(self, exc: Exception) -> bool:
        """Backward-compatible alias for older repository code."""
        return self.is_integrity_error(exc)

    # ------------------------------------------------------------------
    # Result-set conversion
    # ------------------------------------------------------------------

    def rows_to_dicts(self, cursor: Any) -> list[dict]:
        """Convert all remaining rows to a list of dicts.

        Handles both psycopg2 (``cursor.description``) and sqlite3
        (``sqlite3.Row``) result types in one place.
        """
        rows = cursor.fetchall()
        if not rows:
            return []
        if self.is_postgres:
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
        return [dict(row) for row in rows]

    def row_to_dict(self, cursor: Any) -> dict | None:
        """Fetch a single row and return it as a dict, or ``None``."""
        row = cursor.fetchone()
        if row is None:
            return None
        if self.is_postgres:
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        return dict(row)

    def _rows_to_dicts(self, cursor: Any) -> list[dict]:
        """Backward-compatible alias for older repository code."""
        return self.rows_to_dicts(cursor)

    def _row_to_dict(self, cursor: Any) -> dict | None:
        """Backward-compatible alias for older repository code."""
        return self.row_to_dict(cursor)

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

            if self.is_postgres:
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
        cursor.execute("UPDATE test_results SET strategy = 'desktop' WHERE strategy IS NULL")

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

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS blazemeter_presets (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                project_id BIGINT,
                project_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS blazemeter_preset_tests (
                id SERIAL PRIMARY KEY,
                preset_id INTEGER NOT NULL,
                test_id BIGINT NOT NULL,
                test_name TEXT NOT NULL,
                project_id BIGINT,
                project_name TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (preset_id) REFERENCES blazemeter_presets (id) ON DELETE CASCADE,
                UNIQUE(preset_id, test_id)
            )
        """)

        cursor.execute("ALTER TABLE blazemeter_preset_tests ADD COLUMN IF NOT EXISTS project_id BIGINT")
        cursor.execute("ALTER TABLE blazemeter_preset_tests ADD COLUMN IF NOT EXISTS project_name TEXT")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS blazemeter_runs (
                id SERIAL PRIMARY KEY,
                master_id BIGINT NOT NULL UNIQUE,
                test_id BIGINT NOT NULL,
                test_name TEXT NOT NULL,
                project_id BIGINT,
                project_name TEXT,
                status TEXT NOT NULL,
                last_status TEXT,
                error TEXT,
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migration: add trigger execution tracking columns
        cursor.execute("ALTER TABLE scheduled_triggers ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMP")
        cursor.execute("ALTER TABLE scheduled_triggers ADD COLUMN IF NOT EXISTS last_run_status TEXT")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS migration_snapshots (
                id SERIAL PRIMARY KEY,
                snapshot_date DATE NOT NULL UNIQUE,
                overall TEXT,
                headline TEXT,
                payload TEXT NOT NULL,
                source_path TEXT,
                ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS applitools_batches (
                batch_id TEXT PRIMARY KEY,
                tests_json TEXT NOT NULL,
                fetched_at TEXT NOT NULL,
                platform TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        self._create_postgres_requirement_tables(cursor)
        self._create_postgres_indexes(cursor)

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

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS blazemeter_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                project_id INTEGER,
                project_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS blazemeter_preset_tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                preset_id INTEGER NOT NULL,
                test_id INTEGER NOT NULL,
                test_name TEXT NOT NULL,
                project_id INTEGER,
                project_name TEXT,
                position INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (preset_id) REFERENCES blazemeter_presets (id) ON DELETE CASCADE,
                UNIQUE(preset_id, test_id)
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS blazemeter_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                master_id INTEGER NOT NULL UNIQUE,
                test_id INTEGER NOT NULL,
                test_name TEXT NOT NULL,
                project_id INTEGER,
                project_name TEXT,
                status TEXT NOT NULL,
                last_status TEXT,
                error TEXT,
                started_at TIMESTAMP,
                ended_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS migration_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date TEXT NOT NULL UNIQUE,
                overall TEXT,
                headline TEXT,
                payload TEXT NOT NULL,
                source_path TEXT,
                ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS applitools_batches (
                batch_id TEXT PRIMARY KEY,
                tests_json TEXT NOT NULL,
                fetched_at TEXT NOT NULL,
                platform TEXT,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        self._create_sqlite_requirement_tables(cursor)

        # SQLite lacks IF NOT EXISTS for ALTER TABLE — tolerate failures.
        _SQLITE_MIGRATIONS = [
            "ALTER TABLE test_results ADD COLUMN inp REAL",
            "ALTER TABLE test_results ADD COLUMN ttfb REAL",
            "ALTER TABLE test_results ADD COLUMN total_byte_weight REAL",
            "ALTER TABLE test_results ADD COLUMN strategy TEXT DEFAULT 'desktop'",
            "ALTER TABLE scheduled_triggers ADD COLUMN last_run_at TIMESTAMP",
            "ALTER TABLE scheduled_triggers ADD COLUMN last_run_status TEXT",
            "ALTER TABLE blazemeter_preset_tests ADD COLUMN project_id INTEGER",
            "ALTER TABLE blazemeter_preset_tests ADD COLUMN project_name TEXT",
        ]
        for statement in _SQLITE_MIGRATIONS:
            try:
                cursor.execute(statement)
            except sqlite3.OperationalError:
                pass  # Column already exists

        cursor.execute("UPDATE test_results SET strategy = 'desktop' WHERE strategy IS NULL")
        self._create_sqlite_indexes(cursor)

    def _create_postgres_requirement_tables(self, cursor: Any) -> None:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_knowledge_bases (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_sources (
                id SERIAL PRIMARY KEY,
                kb_id INTEGER NOT NULL REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                source_type TEXT NOT NULL,
                source_system TEXT NOT NULL,
                source_id TEXT,
                title TEXT NOT NULL,
                source_path TEXT,
                parse_status TEXT NOT NULL DEFAULT 'indexed',
                metadata_json TEXT,
                extracted_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(kb_id, source_path)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_chunks (
                id SERIAL PRIMARY KEY,
                kb_id INTEGER NOT NULL REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                source_id INTEGER NOT NULL REFERENCES requirement_sources (id) ON DELETE CASCADE,
                chunk_index INTEGER NOT NULL,
                heading TEXT,
                content TEXT NOT NULL,
                token_count INTEGER DEFAULT 0,
                metadata_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_notes (
                id SERIAL PRIMARY KEY,
                kb_id INTEGER NOT NULL REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                source_id INTEGER REFERENCES requirement_sources (id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                category TEXT NOT NULL,
                tags_json TEXT,
                source_link TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_discovery_runs (
                id SERIAL PRIMARY KEY,
                kb_id INTEGER NOT NULL REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                search_terms_json TEXT NOT NULL,
                selected_candidates_json TEXT NOT NULL,
                excluded_candidates_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_common_questions (
                id SERIAL PRIMARY KEY,
                kb_id INTEGER NOT NULL REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                question TEXT NOT NULL,
                normalized_question TEXT NOT NULL,
                answer TEXT NOT NULL,
                citations_json TEXT NOT NULL,
                usage_count INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(kb_id, normalized_question)
            )
        """)

    def _create_sqlite_requirement_tables(self, cursor: Any) -> None:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_knowledge_bases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kb_id INTEGER NOT NULL,
                source_type TEXT NOT NULL,
                source_system TEXT NOT NULL,
                source_id TEXT,
                title TEXT NOT NULL,
                source_path TEXT,
                parse_status TEXT NOT NULL DEFAULT 'indexed',
                metadata_json TEXT,
                extracted_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kb_id) REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                UNIQUE(kb_id, source_path)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kb_id INTEGER NOT NULL,
                source_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                heading TEXT,
                content TEXT NOT NULL,
                token_count INTEGER DEFAULT 0,
                metadata_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kb_id) REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                FOREIGN KEY (source_id) REFERENCES requirement_sources (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kb_id INTEGER NOT NULL,
                source_id INTEGER,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                category TEXT NOT NULL,
                tags_json TEXT,
                source_link TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kb_id) REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                FOREIGN KEY (source_id) REFERENCES requirement_sources (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_discovery_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kb_id INTEGER NOT NULL,
                search_terms_json TEXT NOT NULL,
                selected_candidates_json TEXT NOT NULL,
                excluded_candidates_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kb_id) REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS requirement_common_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kb_id INTEGER NOT NULL,
                question TEXT NOT NULL,
                normalized_question TEXT NOT NULL,
                answer TEXT NOT NULL,
                citations_json TEXT NOT NULL,
                usage_count INTEGER NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (kb_id) REFERENCES requirement_knowledge_bases (id) ON DELETE CASCADE,
                UNIQUE(kb_id, normalized_question)
            )
        """)

    def _create_postgres_indexes(self, cursor: Any) -> None:
        """Create indexes for the repository query shapes used by the app."""
        index_statements = [
            """
            CREATE INDEX IF NOT EXISTS idx_test_results_url_strategy_tested_at
            ON test_results (url_id, strategy, tested_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_test_results_strategy_url_tested_at
            ON test_results (strategy, url_id, tested_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_test_results_url_tested_at
            ON test_results (url_id, tested_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_urls_site_url
            ON urls (site_id, url)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_trigger_urls_url_id
            ON trigger_urls (url_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_trigger_urls_trigger_id
            ON trigger_urls (trigger_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_migration_snapshots_date_desc
            ON migration_snapshots (snapshot_date DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_applitools_batches_uploaded_at
            ON applitools_batches (uploaded_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_requirement_sources_kb
            ON requirement_sources (kb_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_requirement_chunks_kb
            ON requirement_chunks (kb_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_requirement_chunks_source
            ON requirement_chunks (source_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_requirement_common_questions_kb
            ON requirement_common_questions (kb_id, usage_count DESC, last_asked_at DESC)
            """,
        ]
        for statement in index_statements:
            cursor.execute(statement)

    def _create_sqlite_indexes(self, cursor: Any) -> None:
        """Create SQLite equivalents of the production indexes."""
        index_statements = [
            """
            CREATE INDEX IF NOT EXISTS idx_test_results_url_strategy_tested_at
            ON test_results (url_id, strategy, tested_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_test_results_strategy_url_tested_at
            ON test_results (strategy, url_id, tested_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_test_results_url_tested_at
            ON test_results (url_id, tested_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_urls_site_url
            ON urls (site_id, url)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_trigger_urls_url_id
            ON trigger_urls (url_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_trigger_urls_trigger_id
            ON trigger_urls (trigger_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_migration_snapshots_date_desc
            ON migration_snapshots (snapshot_date DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_applitools_batches_uploaded_at
            ON applitools_batches (uploaded_at DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_requirement_sources_kb
            ON requirement_sources (kb_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_requirement_chunks_kb
            ON requirement_chunks (kb_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_requirement_chunks_source
            ON requirement_chunks (source_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_requirement_common_questions_kb
            ON requirement_common_questions (kb_id, usage_count DESC, last_asked_at DESC)
            """,
        ]
        for statement in index_statements:
            cursor.execute(statement)
