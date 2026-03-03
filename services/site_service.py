"""Business logic for site and URL management.

Orchestrates validation and repository calls for site/URL CRUD.
Raises domain exceptions — never returns ``{'error': ...}`` dicts.
"""

from data_access import SiteRepository, UrlRepository, TestResultRepository
from exceptions import ValidationError


class SiteService:
    """Coordinates site and URL operations across repositories.

    Single Responsibility: owns the business rules around site/URL
    lifecycle (name uniqueness, cascade deletes, input validation)
    while delegating persistence to the injected repositories.

    Args:
        site_repo:        Repository for the ``sites`` table.
        url_repo:         Repository for the ``urls`` table.
        test_result_repo: Repository for the ``test_results`` table.
    """

    def __init__(
        self,
        site_repo: SiteRepository,
        url_repo: UrlRepository,
        test_result_repo: TestResultRepository,
    ) -> None:
        self._sites: SiteRepository = site_repo
        self._urls: UrlRepository = url_repo
        self._results: TestResultRepository = test_result_repo

    # ------------------------------------------------------------------
    # Sites
    # ------------------------------------------------------------------

    def get_sites(self) -> list[dict]:
        """Return all sites ordered by name."""
        return self._sites.get_all()

    def create_site(self, name: str) -> int:
        """Create a new site and return its id.

        Args:
            name: Display name for the site (must be unique).

        Returns:
            The auto-generated id of the new site row.

        Raises:
            ValidationError: If *name* is empty or already exists.
        """
        stripped = name.strip() if name else ""
        if not stripped:
            raise ValidationError("Site name is required")

        site_id = self._sites.create(stripped)
        if site_id is None:
            raise ValidationError(f"Site '{stripped}' already exists")
        return site_id

    def update_site(self, site_id: int, name: str) -> None:
        """Rename an existing site.

        Args:
            site_id: Id of the site to rename.
            name:    New display name (must be non-empty).

        Raises:
            ValidationError: If *name* is empty.
        """
        stripped = name.strip() if name else ""
        if not stripped:
            raise ValidationError("Site name is required")
        self._sites.update(site_id, stripped)

    def delete_site(self, site_id: int) -> None:
        """Delete a site and cascade through its URLs and test results.

        Args:
            site_id: Id of the site to remove.
        """
        self._sites.delete(site_id)

    # ------------------------------------------------------------------
    # URLs
    # ------------------------------------------------------------------

    def get_urls(self, site_id: int) -> list[dict]:
        """Return all URLs belonging to *site_id*.

        Args:
            site_id: Parent site whose URLs to retrieve.
        """
        return self._urls.get_by_site(site_id)

    def add_url(self, site_id: int, url: str) -> int:
        """Add a URL to a site and return its id.

        Args:
            site_id: Parent site id.
            url:     Full URL string.

        Returns:
            The auto-generated id of the new URL row.

        Raises:
            ValidationError: If *url* is empty or already exists for the site.
        """
        stripped = url.strip() if url else ""
        if not stripped:
            raise ValidationError("URL is required")

        url_id = self._urls.create(site_id, stripped)
        if url_id is None:
            raise ValidationError(f"URL '{stripped}' already exists for this site")
        return url_id

    def delete_url(self, url_id: int) -> None:
        """Delete a URL and all its associated test results.

        Args:
            url_id: Id of the URL to remove.
        """
        self._results.delete_by_url(url_id)
        self._urls.delete(url_id)
