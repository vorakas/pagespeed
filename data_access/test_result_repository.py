"""Repository for test-result queries and persistence."""
import json
from data_access.connection import ConnectionManager
from enums import Strategy
from exceptions import DatabaseError

# Shared join: latest test result per URL (no strategy filter)
_LATEST_JOIN = """LEFT JOIN (
        SELECT url_id, MAX(tested_at) AS max_date
        FROM test_results GROUP BY url_id
    ) latest ON u.id = latest.url_id
    LEFT JOIN test_results tr
        ON u.id = tr.url_id AND tr.tested_at = latest.max_date"""


class TestResultRepository:
    """Data-access object for the ``test_results`` table."""

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    def save(self, url_id: int, result_data: dict, strategy: str = Strategy.DESKTOP) -> int:
        """Persist a PageSpeed test result and return its id."""
        ph = self._cm._placeholder()
        cols = ("url_id, performance_score, accessibility_score, best_practices_score, "
                "seo_score, fcp, lcp, cls, tti, tbt, speed_index, inp, ttfb, "
                "total_byte_weight, raw_data, strategy")
        phs = ", ".join([ph] * 16)
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"INSERT INTO test_results ({cols}) VALUES ({phs}){self._cm._returning_id()}",
                    (url_id,
                     result_data.get("performance_score"), result_data.get("accessibility_score"),
                     result_data.get("best_practices_score"), result_data.get("seo_score"),
                     result_data.get("fcp"), result_data.get("lcp"), result_data.get("cls"),
                     result_data.get("tti"), result_data.get("tbt"), result_data.get("speed_index"),
                     result_data.get("inp"), result_data.get("ttfb"), result_data.get("total_byte_weight"),
                     json.dumps(result_data.get("raw_data", {})), strategy),
                )
                return self._cm._last_insert_id(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to save test result: {exc}") from exc

    def delete_by_url(self, url_id: int) -> None:
        """Remove all test results for a given URL (cascade helper)."""
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(f"DELETE FROM test_results WHERE url_id = {ph}", (url_id,))
        except Exception as exc:
            raise DatabaseError(f"Failed to delete results for URL {url_id}: {exc}") from exc

    def get_latest_by_site(self, site_id: int, strategy: str = Strategy.DESKTOP) -> list[dict]:
        """Latest test result per URL in *site_id*, filtered by strategy."""
        ph = self._cm._placeholder()
        query = f"""
            SELECT
                u.id AS url_id, u.url,
                tr.performance_score, tr.accessibility_score,
                tr.best_practices_score, tr.seo_score,
                tr.fcp, tr.lcp, tr.cls, tr.inp, tr.ttfb,
                tr.total_byte_weight, tr.tested_at,
                COALESCE(tr.strategy, 'desktop') AS strategy
            FROM urls u
            LEFT JOIN (
                SELECT url_id, MAX(tested_at) AS max_date
                FROM test_results
                WHERE COALESCE(strategy, 'desktop') = {ph}
                GROUP BY url_id
            ) latest ON u.id = latest.url_id
            LEFT JOIN test_results tr
                ON u.id = tr.url_id AND tr.tested_at = latest.max_date
                AND COALESCE(tr.strategy, 'desktop') = {ph}
            WHERE u.site_id = {ph}
            ORDER BY u.url
        """
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (strategy, strategy, site_id))
            return self._cm._rows_to_dicts(cursor)

    def get_history(
        self, url_id: int, days: int = 30, strategy: str = Strategy.DESKTOP,
    ) -> list[dict]:
        """Historical scores for *url_id* over the last *days* days."""
        ph = self._cm._placeholder()
        date_expr = self._cm._date_ago_expression()
        query = f"""
            SELECT performance_score, accessibility_score,
                   best_practices_score, seo_score,
                   fcp, lcp, cls, tested_at
            FROM test_results
            WHERE url_id = {ph}
              AND tested_at >= {date_expr}
              AND COALESCE(strategy, 'desktop') = {ph}
            ORDER BY tested_at ASC
        """
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (url_id, days, strategy))
            return self._cm._rows_to_dicts(cursor)

    def get_details(self, url_id: int) -> dict | None:
        """Full detail row (including raw_data JSON) for the latest result."""
        ph = self._cm._placeholder()
        query = f"""
            SELECT u.url, s.name AS site_name,
                tr.performance_score, tr.accessibility_score,
                tr.best_practices_score, tr.seo_score,
                tr.fcp, tr.lcp, tr.cls, tr.tti, tr.tbt,
                tr.speed_index, tr.inp, tr.ttfb,
                tr.total_byte_weight, tr.raw_data, tr.tested_at
            FROM urls u
            JOIN sites s ON u.site_id = s.id
            {_LATEST_JOIN}
            WHERE u.id = {ph}
        """
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (url_id,))
            result = self._cm._row_to_dict(cursor)
        if result and result.get("raw_data"):
            result["raw_data"] = json.loads(result["raw_data"])
        return result

    def get_worst_performing(
        self, limit_per_site: int = 5, strategy: str = Strategy.DESKTOP,
    ) -> list[dict]:
        """Return the worst-performing URLs grouped by site.

        Retrieves the latest test result per URL (filtered by strategy),
        ranks them within each site by performance_score ascending, and
        returns the bottom *limit_per_site* results for every site.  Each
        row includes ``site_name`` and ``site_id`` so callers can group
        results by site.

        Design decision — **Single Responsibility**: this query lives in the
        repository because it is purely data retrieval with no business rules
        beyond filtering and ordering.  The ``ROW_NUMBER`` window function
        handles the per-group limit in a single pass, avoiding N+1 queries.

        Args:
            limit_per_site: Maximum results to return *per site*.
            strategy:       Test strategy filter (``desktop`` or ``mobile``).

        Returns:
            List of result dicts ordered by site name then worst score first.
        """
        ph = self._cm._placeholder()
        query = f"""
            SELECT * FROM (
                SELECT
                    u.id AS url_id, u.url,
                    s.id AS site_id, s.name AS site_name,
                    tr.performance_score, tr.accessibility_score,
                    tr.best_practices_score, tr.seo_score,
                    tr.fcp, tr.lcp, tr.cls, tr.inp, tr.ttfb,
                    tr.total_byte_weight, tr.tested_at,
                    COALESCE(tr.strategy, 'desktop') AS strategy,
                    ROW_NUMBER() OVER (
                        PARTITION BY s.id
                        ORDER BY tr.performance_score ASC
                    ) AS rank
                FROM urls u
                JOIN sites s ON u.site_id = s.id
                LEFT JOIN (
                    SELECT url_id, MAX(tested_at) AS max_date
                    FROM test_results
                    WHERE COALESCE(strategy, 'desktop') = {ph}
                    GROUP BY url_id
                ) latest ON u.id = latest.url_id
                LEFT JOIN test_results tr
                    ON u.id = tr.url_id AND tr.tested_at = latest.max_date
                    AND COALESCE(tr.strategy, 'desktop') = {ph}
                WHERE tr.performance_score IS NOT NULL
            ) ranked
            WHERE rank <= {ph}
            ORDER BY site_name ASC, performance_score ASC
        """
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (strategy, strategy, limit_per_site))
            return self._cm._rows_to_dicts(cursor)

    def get_url_comparison(self, url1_id: int, url2_id: int) -> dict:
        """Side-by-side latest results for two URLs."""
        ph = self._cm._placeholder()
        query = f"""
            SELECT u.url, s.name AS site_name,
                tr.performance_score, tr.accessibility_score,
                tr.best_practices_score, tr.seo_score,
                tr.fcp, tr.lcp, tr.cls, tr.inp, tr.ttfb,
                tr.total_byte_weight, tr.tested_at
            FROM urls u
            JOIN sites s ON u.site_id = s.id
            {_LATEST_JOIN}
            WHERE u.id = {ph}
        """
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (url1_id,))
            url1_data = self._cm._row_to_dict(cursor)
            cursor.execute(query, (url2_id,))
            url2_data = self._cm._row_to_dict(cursor)
        return {"url1": url1_data, "url2": url2_data}
