"""Data access layer — owns ALL SQL and database interactions.

Re-exports the public API so callers can write:
    from data_access import ConnectionManager, SiteRepository, ...
"""

from data_access.connection import ConnectionManager
from data_access.site_repository import SiteRepository
from data_access.url_repository import UrlRepository
from data_access.test_result_repository import TestResultRepository

__all__ = [
    "ConnectionManager",
    "SiteRepository",
    "UrlRepository",
    "TestResultRepository",
]
