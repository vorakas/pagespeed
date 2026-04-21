#!/usr/bin/env python3
"""
Jira Attachment Downloader
==========================
Scans existing Obsidian markdown files for Jira attachment URLs,
downloads them locally, and updates the markdown references to
point to the local files.

Designed to run AFTER JiraToObsidia.py has already exported issues.

Usage:
    python download_attachments.py

    # Dry run (show what would be downloaded without doing it):
    python download_attachments.py --dry-run
"""

import os
import re
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests --break-system-packages -q")
    import requests

# ──────────────────────────────────────────────
# CONFIGURATION — must match JiraToObsidia.py
# ──────────────────────────────────────────────
JIRA_BASE_URL = os.environ.get("JIRA_BASE_URL", "https://lampstrack.lampsplus.com")
JIRA_PAT = os.environ.get("JIRA_PAT", "")
RAW_DIR = os.environ.get("OUTPUT_DIR", r"C:\Users\AdamB\Desktop\LPAdobe\raw")
ASSETS_DIR = os.path.join(RAW_DIR, "assets")

# Matches markdown links to Jira attachment URLs
# Pattern: [filename](https://lampstrack.lampsplus.com/secure/attachment/123456/filename)
ATTACHMENT_URL_PATTERN = re.compile(
    r"\[([^\]]+)\]\((https?://[^\s)]*?/secure/attachment/\d+/[^\s)]+)\)"
)

# Also matches image references that use the Jira attachment URL
IMAGE_URL_PATTERN = re.compile(
    r"!\[([^\]]*)\]\((https?://[^\s)]*?/secure/attachment/\d+/[^\s)]+)\)"
)

# Extract issue key from filename (e.g., "ACE2E-10 - Some Title.md" -> "ACE2E-10")
ISSUE_KEY_PATTERN = re.compile(r"^([A-Z][A-Z0-9]+-\d+)")


def jira_session():
    """Create an authenticated requests session."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {JIRA_PAT}",
    })
    return session


def extract_issue_key(filepath):
    """Extract the Jira issue key from a markdown filename."""
    match = ISSUE_KEY_PATTERN.match(filepath.stem)
    if match:
        return match.group(1)
    return None


def find_attachment_urls(filepath):
    """Scan a markdown file and return all Jira attachment URLs with their display names."""
    content = filepath.read_text(encoding="utf-8")
    attachments = []

    for pattern in [ATTACHMENT_URL_PATTERN, IMAGE_URL_PATTERN]:
        for match in pattern.finditer(content):
            display_name = match.group(1)
            url = match.group(2)
            attachments.append({
                "display_name": display_name,
                "url": url,
                "full_match": match.group(0),
            })

    return attachments


def download_attachment(session, url, destination):
    """Download a single attachment file. Returns True on success."""
    try:
        response = session.get(url, stream=True, timeout=60)
        response.raise_for_status()

        destination.parent.mkdir(parents=True, exist_ok=True)

        with open(destination, "wb") as file:
            for chunk in response.iter_content(chunk_size=8192):
                file.write(chunk)

        return True
    except requests.RequestException as error:
        print(f"    FAILED: {error}")
        return False


def update_markdown_references(filepath, issue_key, replacements):
    """Update attachment URLs in a markdown file to point to local paths."""
    content = filepath.read_text(encoding="utf-8")

    for old_text, new_text in replacements:
        content = content.replace(old_text, new_text)

    filepath.write_text(content, encoding="utf-8")


def main():
    dry_run = "--dry-run" in sys.argv

    raw_path = Path(RAW_DIR)
    assets_path = Path(ASSETS_DIR)

    if not raw_path.exists():
        print(f"Raw directory not found: {raw_path}")
        sys.exit(1)

    if dry_run:
        print("DRY RUN — no files will be downloaded or modified.\n")

    print(f"Scanning markdown files in: {raw_path}\n")

    session = jira_session()

    # Verify auth
    try:
        auth_check = session.get(f"{JIRA_BASE_URL}/rest/api/2/myself")
        auth_check.raise_for_status()
        user = auth_check.json()
        print(f"Authenticated as: {user.get('displayName', user.get('name', '?'))}\n")
    except Exception as error:
        print(f"Authentication failed: {error}")
        sys.exit(1)

    total_found = 0
    total_downloaded = 0
    total_skipped = 0
    total_failed = 0

    # Scan all markdown files in raw/ and subfolders
    markdown_files = sorted(raw_path.rglob("*.md"))

    for md_file in markdown_files:
        # Skip non-issue files (MOC, Dashboard, etc.)
        issue_key = extract_issue_key(md_file)
        if not issue_key:
            continue

        attachments = find_attachment_urls(md_file)
        if not attachments:
            continue

        print(f"{issue_key}: {len(attachments)} attachment(s)")
        total_found += len(attachments)

        replacements = []

        for attachment in attachments:
            url = attachment["url"]
            display_name = attachment["display_name"]

            # Extract filename from URL (last path segment, URL-decoded)
            url_filename = url.rstrip("/").split("/")[-1]
            # URL decode common patterns
            url_filename = requests.utils.unquote(url_filename)

            # Build local path: assets/{issue_key}/{filename}
            local_dir = assets_path / issue_key
            local_path = local_dir / url_filename

            # Relative path from the markdown file to the asset
            # For Obsidian, use relative path from raw/ root
            try:
                relative_path = local_path.relative_to(raw_path)
            except ValueError:
                relative_path = local_path

            # Use forward slashes for Obsidian compatibility
            relative_path_str = str(relative_path).replace("\\", "/")

            if local_path.exists():
                print(f"  SKIP (exists): {url_filename}")
                total_skipped += 1
                # Still update the reference if it points to the remote URL
                old_text = attachment["full_match"]
                if url in old_text:
                    if old_text.startswith("!"):
                        new_text = f"![{display_name}]({relative_path_str})"
                    else:
                        new_text = f"[{display_name}]({relative_path_str})"
                    replacements.append((old_text, new_text))
                continue

            if dry_run:
                print(f"  WOULD DOWNLOAD: {url_filename}")
                print(f"    -> {local_path}")
                total_downloaded += 1
                continue

            print(f"  Downloading: {url_filename}...", end=" ")
            if download_attachment(session, url, local_path):
                size_kb = round(local_path.stat().st_size / 1024, 1)
                print(f"OK ({size_kb} KB)")
                total_downloaded += 1

                # Build replacement for markdown
                old_text = attachment["full_match"]
                if old_text.startswith("!"):
                    new_text = f"![{display_name}]({relative_path_str})"
                else:
                    new_text = f"[{display_name}]({relative_path_str})"
                replacements.append((old_text, new_text))
            else:
                total_failed += 1

        # Update markdown file with local paths
        if replacements and not dry_run:
            update_markdown_references(md_file, issue_key, replacements)
            print(f"  Updated {len(replacements)} reference(s) in {md_file.name}")

    print(f"\n{'DRY RUN ' if dry_run else ''}Summary:")
    print(f"  Attachments found:      {total_found}")
    print(f"  Downloaded:             {total_downloaded}")
    print(f"  Skipped (already local): {total_skipped}")
    print(f"  Failed:                 {total_failed}")

    if total_downloaded > 0 and not dry_run:
        print(f"\nAttachments saved to: {assets_path}")
        print("Markdown files updated with local paths.")


if __name__ == "__main__":
    main()
