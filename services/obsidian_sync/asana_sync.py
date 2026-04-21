#!/usr/bin/env python3
"""
Asana -> Obsidian Second Brain Exporter
=======================================
Pulls all tasks from one or more Asana projects and generates
Obsidian-compatible markdown files with rich frontmatter,
wikilinks, and a Map of Content (MOC) index.

Each project gets its own subfolder inside your vault:
    raw/asana/LAMPSPLUS/...   raw/asana/LPWE/...

Tasks are organized by section (Asana's equivalent of columns/groups).

Supports incremental sync: on re-runs, only tasks modified since
the last sync are re-fetched and rewritten.  Use --full to force
a complete refresh.

Usage:
    # First, put your PAT in .env:
    #   ASANA_PAT=1/1234567890:abcdef...

    # Sync default projects:
    python AsanaToObsidia.py

    # Sync specific projects by name:
    python AsanaToObsidia.py LAMPSPLUS

    # Force full refresh:
    python AsanaToObsidia.py --full

Prerequisites:
    pip install requests python-dotenv
"""

import os
import re
import json
import sys
import html
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests --break-system-packages -q")
    import requests

try:
    from dotenv import load_dotenv
except ImportError:
    print("Installing python-dotenv...")
    os.system(f"{sys.executable} -m pip install python-dotenv --break-system-packages -q")
    from dotenv import load_dotenv

# Load .env from the same directory as this script
load_dotenv(Path(__file__).parent / ".env")

# ──────────────────────────────────────────────
# CONFIGURATION
# ──────────────────────────────────────────────
ASANA_PAT = os.environ.get("ASANA_PAT", "")

ASANA_BASE_URL = "https://app.asana.com/api/1.0"

VAULT_ROOT = os.environ.get("VAULT_ROOT", r"C:\Users\AdamB\Desktop\LPAdobe\raw\asana")

# Project name -> Asana project GID mapping
PROJECT_MAP = {
    "LAMPSPLUS": "1209008749804809",
    "LPWE": "1209196359608155",
}

DEFAULT_PROJECTS = list(PROJECT_MAP.keys())

SYNC_STATE_FILE = ".asana_sync_state.json"
CHECKPOINT_FILE = ".asana_checkpoint.json"
FILE_INDEX_FILE = ".asana_file_index.json"
PAGE_SIZE = 100  # Asana max per page

# Sections to skip entirely (not relevant to migration)
SKIP_SECTIONS = {"PTO", "Holidays", "CNX PTO", "LP PTO", "CNX IN HOLIDAY", "CNX MX Holiday", "LP HOLIDAY"}


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def asana_session():
    """Create an authenticated requests session."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {ASANA_PAT}",
        "Accept": "application/json",
    })
    return session


def asana_get(session, endpoint, params=None):
    """Make a GET request to the Asana API with pagination support."""
    url = f"{ASANA_BASE_URL}/{endpoint}"
    if params is None:
        params = {}
    params.setdefault("limit", PAGE_SIZE)

    all_data = []
    while True:
        resp = session.get(url, params=params)
        resp.raise_for_status()
        body = resp.json()
        all_data.extend(body.get("data", []))
        next_page = body.get("next_page")
        if next_page and next_page.get("offset"):
            params["offset"] = next_page["offset"]
        else:
            break
    return all_data


def asana_get_single(session, endpoint, params=None):
    """Make a GET request expecting a single object response."""
    url = f"{ASANA_BASE_URL}/{endpoint}"
    resp = session.get(url, params=params or {})
    resp.raise_for_status()
    return resp.json().get("data", {})


def sanitize_filename(text):
    """Remove characters that are problematic in file paths or Obsidian wikilinks."""
    return re.sub(r'[\\/:*?"<>|\[\]]', "-", text).strip()


def task_filename(gid, name):
    """Generate a clean Obsidian-friendly filename for a task.

    Uses ticket ID (e.g., LAMPSPLUS-483) when present, otherwise
    falls back to the last 6 digits of the GID for uniqueness.
    """
    ticket_match = re.search(r'\[(LAMPSPLUS|LPWE)-(\d+)\]', name)
    if ticket_match:
        proj = ticket_match.group(1)
        num = ticket_match.group(2)
        # Strip the ticket prefix from the display name
        clean_name = re.sub(r'\[' + proj + r'-' + num + r'\]\s*', '', name).strip()
        return sanitize_filename(f"{proj}-{num} - {clean_name}")
    else:
        short_gid = str(gid)[-6:]
        return sanitize_filename(f"{short_gid} - {name}")


def format_date(iso_str):
    """Convert ISO timestamp -> YYYY-MM-DD."""
    if not iso_str:
        return ""
    try:
        if "T" in iso_str:
            dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d")
        return iso_str[:10]
    except Exception:
        return iso_str[:10] if len(iso_str) >= 10 else iso_str


def format_datetime(iso_str):
    """Convert ISO timestamp -> YYYY-MM-DD HH:MM."""
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return iso_str


def person_name(user_obj):
    """Extract display name from an Asana user object."""
    if not user_obj:
        return "Unassigned"
    return user_obj.get("name", "Unknown")


def rich_text_to_md(notes, html_notes=None):
    """Convert Asana task notes to markdown.

    Asana stores notes as plain text and optionally as html_notes.
    If html_notes is available, do a basic HTML->MD conversion.
    Otherwise, return the plain text as-is.
    """
    if html_notes:
        text = html_notes
        # Convert common HTML to markdown
        text = re.sub(r"<h1[^>]*>(.*?)</h1>", r"# \1", text, flags=re.DOTALL)
        text = re.sub(r"<h2[^>]*>(.*?)</h2>", r"## \1", text, flags=re.DOTALL)
        text = re.sub(r"<h3[^>]*>(.*?)</h3>", r"### \1", text, flags=re.DOTALL)
        text = re.sub(r"<strong>(.*?)</strong>", r"**\1**", text, flags=re.DOTALL)
        text = re.sub(r"<b>(.*?)</b>", r"**\1**", text, flags=re.DOTALL)
        text = re.sub(r"<em>(.*?)</em>", r"*\1*", text, flags=re.DOTALL)
        text = re.sub(r"<i>(.*?)</i>", r"*\1*", text, flags=re.DOTALL)
        text = re.sub(r"<s>(.*?)</s>", r"~~\1~~", text, flags=re.DOTALL)
        text = re.sub(r"<u>(.*?)</u>", r"\1", text, flags=re.DOTALL)
        text = re.sub(r"<code>(.*?)</code>", r"`\1`", text, flags=re.DOTALL)
        text = re.sub(r"<a\s+href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", r"[\2](\1)", text, flags=re.DOTALL)
        text = re.sub(r"<br\s*/?>", "\n", text)
        text = re.sub(r"<hr\s*/?>", "\n---\n", text)
        # Lists
        text = re.sub(r"<li>(.*?)</li>", r"- \1", text, flags=re.DOTALL)
        text = re.sub(r"</?[uo]l[^>]*>", "", text)
        # Strip remaining HTML tags
        text = re.sub(r"<[^>]+>", "", text)
        text = html.unescape(text)
        # Clean up whitespace
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    if notes:
        return notes.strip()
    return ""


# ──────────────────────────────────────────────
# USER-NAME RESOLUTION (for @mention URLs in descriptions/comments)
# ──────────────────────────────────────────────

USERS_CACHE_FILE = ".asana_users_cache.json"

# Asana serves two profile-URL shapes in notes/html_notes/stories:
#   /1/<workspace_gid>/profile/<user_gid>  (the user-facing URL in the address bar)
#   /0/profile/<user_gid>                  (legacy form Asana still emits in comments)
# Match either by accepting one or more numeric path segments before /profile/.
_PROFILE_URL_RE = re.compile(r"https://app\.asana\.com/(?:\d+/)+profile/(\d+)")
_MD_LINK_PROFILE_RE = re.compile(
    r"\[(https://app\.asana\.com/(?:\d+/)+profile/\d+)\]"
    r"\((https://app\.asana\.com/(?:\d+/)+profile/(\d+))\)"
)
_BARE_PROFILE_RE = re.compile(
    r"(?<!\]\()"
    r"https://app\.asana\.com/(?:\d+/)+profile/(\d+)"
)


def load_user_cache(vault_root):
    """Load the persisted GID → name cache. Missing/corrupt file returns {}."""
    path = Path(vault_root) / USERS_CACHE_FILE
    if not path.is_file():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return {str(k): v for k, v in data.items() if isinstance(v, str) and v}
    except (OSError, json.JSONDecodeError):
        return {}


def save_user_cache(vault_root, cache):
    """Persist only positively-resolved entries (ignore sentinels)."""
    path = Path(vault_root) / USERS_CACHE_FILE
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        clean = {gid: name for gid, name in cache.items() if name}
        with path.open("w", encoding="utf-8") as f:
            json.dump(clean, f, indent=2, sort_keys=True)
    except OSError as exc:
        print(f"  Warning: could not persist user cache: {exc}")


def seed_cache_from_workspace(session, workspace_gid, name_cache):
    """Pull every workspace member's (gid, name) in one paginated call.

    This is the canonical GID Asana embeds in ``/profile/<gid>`` URLs
    — the same user's ``created_by.gid`` on stories is a different,
    workspace-agnostic representation that won't match those URLs.
    Calling this once per workspace at the start of a sync covers
    every @mentioned person (active or guest) without needing the
    ``/users/<gid>`` endpoint, which 404s for users outside the PAT
    owner's direct workspace.

    Returns the number of new names added.
    """
    if not workspace_gid:
        return 0
    try:
        users = asana_get(session, f"workspaces/{workspace_gid}/users", {"opt_fields": "name"})
    except requests.HTTPError as exc:
        resp = getattr(exc, "response", None)
        status = getattr(resp, "status_code", "?")
        body = getattr(resp, "text", "")[:300] if resp is not None else ""
        print(f"    Workspace users fetch failed (ws={workspace_gid}, status={status}) body={body!r}")
        return 0
    added = 0
    for u in users or []:
        gid = u.get("gid")
        name = u.get("name")
        if gid and name and not name_cache.get(gid):
            name_cache[gid] = name
            added += 1
    return added


def harvest_known_users(task, subtasks, stories, name_cache):
    """Populate name_cache with GID->name pairs we already have in-hand.

    The /users/<gid> endpoint 404s for users outside the PAT owner's
    workspace, which covers most @mentioned people on migration tasks
    (CNX team, vendor guests, etc.). But we already receive their GIDs
    and names attached to task.assignee, subtask.assignee, and
    story.created_by. Harvesting those makes the resolver work for
    anyone who has ever commented on or been assigned to a task — no
    extra API calls required.
    """
    def _add(user_obj):
        if not user_obj:
            return
        gid = user_obj.get("gid")
        name = user_obj.get("name")
        # Only fill in if missing or previously recorded as "unresolvable";
        # a positive resolution always wins.
        if gid and name and not name_cache.get(gid):
            name_cache[gid] = name

    _add(task.get("assignee"))
    for st in subtasks or []:
        _add(st.get("assignee"))
    for story in stories or []:
        _add(story.get("created_by"))


def resolve_profile_mentions(text, session, name_cache):
    """Replace bare Asana profile URLs in text with [Name](url) markdown links.

    Uses ``name_cache`` (GID → name, or GID → None for unresolvable) so each
    unique GID is looked up at most once per sync. Handles two input shapes
    that our HTML→MD converter produces:

    1. ``[<profile-url>](<same-profile-url>)`` — the link text equals the href
       because Asana's ``html_notes`` wraps @mentions without a visible label
       and our regex copies the URL into both positions.
    2. Bare ``https://app.asana.com/.../profile/<gid>`` URLs that never made
       it into an anchor tag.

    Unresolvable GIDs (deleted users, 403s) are left as plain URLs.
    """
    if not text or "/profile/" not in text:
        return text

    gids = set(_PROFILE_URL_RE.findall(text))
    for gid in gids:
        if gid in name_cache:
            continue
        try:
            user = asana_get_single(session, f"users/{gid}", {"opt_fields": "name"})
            name = (user or {}).get("name")
            name_cache[gid] = name if name else None
        except requests.HTTPError as exc:
            status = getattr(getattr(exc, "response", None), "status_code", "?")
            print(f"    Asana users/{gid}: {status} — leaving as bare URL")
            name_cache[gid] = None
        except requests.RequestException as exc:
            print(f"    Asana users/{gid}: network error ({exc}) — leaving as bare URL")
            name_cache[gid] = None

    def _fix_link(match):
        href = match.group(2)
        gid = match.group(3)
        name = name_cache.get(gid)
        return f"[{name}]({href})" if name else match.group(0)

    text = _MD_LINK_PROFILE_RE.sub(_fix_link, text)

    def _wrap_bare(match):
        url = match.group(0)
        gid = match.group(1)
        name = name_cache.get(gid)
        return f"[{name}]({url})" if name else url

    text = _BARE_PROFILE_RE.sub(_wrap_bare, text)
    return text


# ──────────────────────────────────────────────
# DATA FETCHING
# ──────────────────────────────────────────────

TASK_OPT_FIELDS = ",".join([
    "name", "notes", "html_notes", "completed", "completed_at",
    "assignee.name", "assignee.email", "assignee.gid",
    "created_at", "modified_at", "due_on", "due_at", "start_on", "start_at",
    "tags.name", "memberships.section.name",
    "custom_fields.name", "custom_fields.display_value",
    "parent.name", "parent.gid",
    "num_subtasks", "permalink_url",
])


def fetch_project_info(session, project_gid):
    """Fetch project metadata."""
    return asana_get_single(session, f"projects/{project_gid}", {
        "opt_fields": "name,notes,owner.name,created_at,modified_at,team.name,workspace.gid",
    })


def fetch_sections(session, project_gid):
    """Fetch all sections in a project."""
    return asana_get(session, f"projects/{project_gid}/sections", {
        "opt_fields": "name",
    })


def fetch_project_tasks(session, project_gid, since=None):
    """Fetch all tasks in a project.

    Args:
        project_gid: The Asana project GID.
        since: ISO datetime string. If provided, only fetch tasks
               modified on or after this timestamp (incremental sync).
    """
    params = {
        "opt_fields": TASK_OPT_FIELDS,
    }
    if since:
        params["modified_since"] = since

    print(f"  Fetching tasks...")
    tasks = asana_get(session, f"projects/{project_gid}/tasks", params)
    print(f"  Retrieved {len(tasks)} tasks.")
    return tasks


def fetch_subtasks(session, task_gid):
    """Fetch subtasks of a given task."""
    return asana_get(session, f"tasks/{task_gid}/subtasks", {
        "opt_fields": "name,completed,assignee.name,assignee.gid,due_on,permalink_url",
    })


def fetch_stories(session, task_gid):
    """Fetch comments/stories for a task."""
    return asana_get(session, f"tasks/{task_gid}/stories", {
        "opt_fields": "type,text,html_text,created_by.name,created_by.gid,created_at",
    })


def fetch_attachments(session, task_gid):
    """Fetch attachment metadata for a task."""
    return asana_get(session, f"tasks/{task_gid}/attachments", {
        "opt_fields": "name,download_url,host,size,created_at,permalink_url",
    })


# ──────────────────────────────────────────────
# MARKDOWN GENERATION
# ──────────────────────────────────────────────

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"}
ATTACHMENTS_FOLDER = "_attachments"


def download_task_attachments(session, task_gid, task_name, attachments, output_dir):
    """Download all attachments for a task into _attachments folder.

    Returns a dict mapping original filename -> local filename.
    """
    if not attachments:
        return {}

    att_dir = output_dir / ATTACHMENTS_FOLDER
    att_dir.mkdir(exist_ok=True)

    safe_task_prefix = sanitize_filename(task_gid)
    downloaded = {}

    for att in attachments:
        name = att.get("name", "file")
        download_url = att.get("download_url")
        host = att.get("host", "")

        if not download_url:
            continue

        local_name = f"{safe_task_prefix}_{sanitize_filename(name)}"
        local_path = att_dir / local_name

        if local_path.exists():
            downloaded[name] = local_name
            continue

        try:
            resp = session.get(download_url, stream=True, timeout=60)
            resp.raise_for_status()
            with open(local_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            downloaded[name] = local_name
        except Exception as e:
            print(f"   Warning: Failed to download {name} for task {task_gid}: {e}")

    return downloaded


def build_task_markdown(
    task,
    subtasks=None,
    stories=None,
    downloaded_attachments=None,
    session=None,
    name_cache=None,
):
    """Build full Obsidian markdown for a single Asana task.

    When ``session`` and ``name_cache`` are supplied, any Asana profile URLs
    in the task description and comments are rewritten as ``[Name](url)``
    markdown links; missing resolutions fall through as plain URLs.
    """
    if subtasks is None:
        subtasks = []
    if stories is None:
        stories = []
    if downloaded_attachments is None:
        downloaded_attachments = {}

    gid = task["gid"]
    name = task.get("name", "Untitled")
    completed = task.get("completed", False)
    completed_at = format_date(task.get("completed_at"))
    assignee = person_name(task.get("assignee"))
    created_at = format_date(task.get("created_at"))
    modified_at = format_date(task.get("modified_at"))
    due_on = task.get("due_on", "") or ""
    start_on = task.get("start_on", "") or ""
    tags = [t.get("name", "") for t in (task.get("tags") or [])]
    permalink = task.get("permalink_url", "")
    notes = task.get("notes", "")
    html_notes = task.get("html_notes", "")
    description = rich_text_to_md(notes, html_notes)
    if session is not None and name_cache is not None:
        # Seed the cache with any identities we already have on this task
        # so users outside the PAT's workspace still get resolved.
        harvest_known_users(task, subtasks, stories, name_cache)
        description = resolve_profile_mentions(description, session, name_cache)

    # Section from memberships
    section = ""
    memberships = task.get("memberships") or []
    for membership in memberships:
        sec = membership.get("section")
        if sec:
            section = sec.get("name", "")
            break

    # Custom fields — filter out vendor Jira fields and clean up names
    custom_fields = {}
    # Fields to skip (vendor Jira or redundant)
    skip_prefixes = ("jira_", "jira ")
    # Field name cleanup mapping
    field_renames = {
        "task_priority_": "priority",
        "task_status": "task_status",
        "completion__": "completion",
        "original_v_new_requirement": "original_vs_new",
        "estimate_approval": "estimate_approval",
    }
    for cf in (task.get("custom_fields") or []):
        cf_name = cf.get("name", "")
        cf_value = cf.get("display_value", "")
        if not cf_name or not cf_value:
            continue
        safe_key = re.sub(r"[^a-z0-9_]", "_", cf_name.lower()).strip("_")
        # Skip vendor Jira fields
        if any(safe_key.startswith(p) for p in ("jira_",)):
            continue
        # Apply renames
        safe_key = field_renames.get(safe_key, safe_key)
        # Skip if it duplicates a core field
        if safe_key in ("section", "name", "status"):
            # Use "subsection" for the second section field from custom fields
            if safe_key == "section":
                safe_key = "subsection"
            else:
                continue
        custom_fields[safe_key] = cf_value

    # Parent task
    parent = task.get("parent")
    parent_name = parent.get("name", "") if parent else ""
    parent_gid = parent.get("gid", "") if parent else ""

    # Status
    status = "Completed" if completed else "Open"

    # ── Frontmatter ──
    fm_lines = [
        "---",
        f"status: {status}",
        f"assignee: \"{assignee}\"",
        f"created: {created_at}",
        f"modified: {modified_at}",
    ]
    if section:
        fm_lines.append(f"section: \"{section}\"")
    if due_on:
        fm_lines.append(f"due: {due_on}")
    if start_on:
        fm_lines.append(f"start: {start_on}")
    if completed_at:
        fm_lines.append(f"completed_at: {completed_at}")
    if tags:
        fm_lines.append(f"tags: [{', '.join(f'{chr(34)}{t}{chr(34)}' for t in tags)}]")
    if custom_fields:
        for cf_key, cf_value in custom_fields.items():
            fm_lines.append(f"{cf_key}: \"{cf_value}\"")
    if permalink:
        fm_lines.append(f"asana_url: {permalink}")
    fm_lines.append("---")

    parts = ["\n".join(fm_lines), ""]

    # ── Title ──
    status_icon = "x" if completed else " "
    parts.append(f"# [{status_icon}] {name}")
    parts.append("")
    parts.append(f"> **Status:** {status}  ·  **Assignee:** {assignee}")
    if permalink:
        parts.append(f"> [Open in Asana]({permalink})")
    parts.append("")

    # ── Parent link ──
    if parent_name:
        parent_filename = task_filename(parent_gid, parent_name)
        parts.append(f"**Parent:** [[{parent_filename}]]")
        parts.append("")

    # ── Section ──
    if section:
        parts.append(f"**Section:** {section}")
        parts.append("")

    # ── Custom Fields ──
    if custom_fields:
        parts.append("## Custom Fields")
        parts.append("")
        for cf_name, cf_value in custom_fields.items():
            parts.append(f"- **{cf_name}:** {cf_value}")
        parts.append("")

    # ── Description ──
    parts.append("## Description")
    parts.append("")
    if description:
        parts.append(description)
    else:
        parts.append("*No description provided.*")
    parts.append("")

    # ── Subtasks ──
    if subtasks:
        parts.append("## Subtasks")
        parts.append("")
        for st in subtasks:
            st_name = st.get("name", "Untitled")
            st_done = st.get("completed", False)
            st_assignee = person_name(st.get("assignee"))
            st_due = st.get("due_on", "")
            check = "x" if st_done else " "
            st_gid = st.get("gid", "")
            st_filename = task_filename(st_gid, st_name)
            line = f"- [{check}] [[{st_filename}|{st_name}]]"
            if st_assignee != "Unassigned":
                line += f"  ({st_assignee})"
            if st_due:
                line += f"  due {st_due}"
            parts.append(line)
        parts.append("")

    # ── Attachments ──
    if downloaded_attachments:
        parts.append("## Attachments")
        parts.append("")
        for original_name, local_name in downloaded_attachments.items():
            ext = Path(original_name).suffix.lower()
            if ext in IMAGE_EXTENSIONS:
                parts.append(f"![[{ATTACHMENTS_FOLDER}/{local_name}]]")
                parts.append(f"*{original_name}*")
            else:
                parts.append(f"- [[{ATTACHMENTS_FOLDER}/{local_name}|{original_name}]]")
            parts.append("")

    # ── Comments ──
    comments = [s for s in stories if s.get("type") == "comment" and s.get("text")]
    if comments:
        parts.append("## Comments")
        parts.append("")
        for comment in comments:
            author = person_name(comment.get("created_by"))
            date = format_datetime(comment.get("created_at"))
            text = comment.get("text", "")
            if session is not None and name_cache is not None:
                text = resolve_profile_mentions(text, session, name_cache)
            parts.append(f"### {author} — {date}")
            parts.append("")
            parts.append(text)
            parts.append("")

    return "\n".join(parts)


def build_section_moc(project_name, section_name, tasks):
    """Build a Map of Content for a section."""
    parts = [
        "---",
        f"type: section-moc",
        f"project: \"{project_name}\"",
        f"section: \"{section_name}\"",
        f"task_count: {len(tasks)}",
        "---",
        "",
        f"# {section_name}",
        "",
    ]

    open_tasks = [t for t in tasks if not t.get("completed", False)]
    done_tasks = [t for t in tasks if t.get("completed", False)]

    if open_tasks:
        parts.append(f"## Open ({len(open_tasks)})")
        parts.append("")
        for t in open_tasks:
            gid = t["gid"]
            name = t.get("name", "Untitled")
            assignee = person_name(t.get("assignee"))
            due = t.get("due_on", "")
            filename = task_filename(gid, name)
            line = f"- [[{filename}|{name}]]"
            if assignee != "Unassigned":
                line += f"  ({assignee})"
            if due:
                line += f"  due {due}"
            parts.append(line)
        parts.append("")

    if done_tasks:
        parts.append(f"## Completed ({len(done_tasks)})")
        parts.append("")
        for t in done_tasks:
            gid = t["gid"]
            name = t.get("name", "Untitled")
            filename = task_filename(gid, name)
            parts.append(f"- [x] [[{filename}|{name}]]")
        parts.append("")

    return "\n".join(parts)


def build_project_moc(project_name, project_info, sections_with_tasks, all_tasks):
    """Build the top-level MOC for a project."""
    total = len(all_tasks)
    completed = sum(1 for t in all_tasks if t.get("completed", False))
    open_count = total - completed

    parts = [
        "---",
        f"type: project-moc",
        f"project: \"{project_name}\"",
        f"total_tasks: {total}",
        f"open_tasks: {open_count}",
        f"completed_tasks: {completed}",
        f"synced: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "---",
        "",
        f"# {project_name}",
        "",
    ]

    owner = person_name(project_info.get("owner"))
    if owner != "Unassigned":
        parts.append(f"**Owner:** {owner}")
    team = project_info.get("team", {})
    if team:
        parts.append(f"**Team:** {team.get('name', '')}")
    parts.append(f"**Tasks:** {open_count} open / {completed} completed / {total} total")
    parts.append("")

    notes = project_info.get("notes", "")
    if notes:
        parts.append("## Project Description")
        parts.append("")
        parts.append(notes)
        parts.append("")

    parts.append("## Sections")
    parts.append("")
    for section_name, tasks in sections_with_tasks:
        section_open = sum(1 for t in tasks if not t.get("completed", False))
        section_filename = sanitize_filename(f"section - {section_name}")
        parts.append(f"- [[{section_filename}|{section_name}]] — {section_open} open / {len(tasks)} total")
    parts.append("")

    return "\n".join(parts)


# ──────────────────────────────────────────────
# SYNC STATE
# ──────────────────────────────────────────────

def load_sync_state(project_dir):
    """Load the last sync timestamp for a project."""
    state_file = project_dir / SYNC_STATE_FILE
    if state_file.exists():
        try:
            with open(state_file) as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_sync_state(project_dir, state):
    """Save sync state for a project."""
    state_file = project_dir / SYNC_STATE_FILE
    with open(state_file, "w") as f:
        json.dump(state, f, indent=2)


def load_checkpoint(project_dir):
    """Load the set of task GIDs already fully processed in this run."""
    cp_file = project_dir / CHECKPOINT_FILE
    if cp_file.exists():
        try:
            with open(cp_file) as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()


def save_checkpoint(project_dir, processed_gids):
    """Save the set of processed task GIDs."""
    cp_file = project_dir / CHECKPOINT_FILE
    with open(cp_file, "w") as f:
        json.dump(list(processed_gids), f)


def clear_checkpoint(project_dir):
    """Remove checkpoint file after a successful full sync."""
    cp_file = project_dir / CHECKPOINT_FILE
    if cp_file.exists():
        cp_file.unlink()


# ──────────────────────────────────────────────
# FILE INDEX (stale file cleanup)
# ──────────────────────────────────────────────

def load_file_index(project_dir):
    """Load the GID -> relative filepath index for a project.

    Used during incremental syncs to detect when a task has moved
    between sections so the old file can be deleted.

    If no index file exists (first run after this feature was added),
    builds the index by scanning existing markdown files on disk.
    """
    index_file = project_dir / FILE_INDEX_FILE
    if index_file.exists():
        try:
            with open(index_file, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # No index file — seed from existing files on disk
    print("  File index not found — building from existing files...")
    index = build_file_index_from_disk(project_dir)
    if index:
        save_file_index(project_dir, index)
        print(f"  Built file index with {len(index)} entries.")
    return index


def build_file_index_from_disk(project_dir):
    """Build a GID -> relative filepath index by scanning existing markdown files.

    Reads the asana_url frontmatter field from each .md file to extract
    the task GID. This is used to seed the index on first run without
    requiring a full refresh.
    """
    index = {}
    asana_url_pattern = re.compile(r"asana_url:\s*https://app\.asana\.com/\d+/\d+/(\d+)")
    for md_file in project_dir.rglob("*.md"):
        # Skip MOCs, section indexes, and hidden files
        if md_file.name.startswith(".") or md_file.name.startswith("section - "):
            continue
        if md_file.name.endswith("- MOC.md"):
            continue
        try:
            # Only need to read the frontmatter (first ~30 lines)
            with open(md_file, "r", encoding="utf-8") as f:
                for line in f:
                    match = asana_url_pattern.search(line)
                    if match:
                        task_gid = match.group(1)
                        relative_path = str(md_file.relative_to(project_dir))
                        index[task_gid] = relative_path
                        break
                    # Stop reading past frontmatter
                    if line.strip() == "---" and len(index) == 0:
                        continue
                    if line.strip() == "---":
                        break
        except Exception:
            continue
    return index


def save_file_index(project_dir, index):
    """Save the GID -> relative filepath index for a project."""
    index_file = project_dir / FILE_INDEX_FILE
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2)


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

def sync_project(session, project_name, project_gid, full_refresh=False, name_cache=None):
    """Sync a single Asana project to markdown files."""
    print(f"\n{'='*60}")
    print(f"  Syncing: {project_name} (GID: {project_gid})")
    print(f"{'='*60}")

    project_dir = Path(VAULT_ROOT) / project_name
    project_dir.mkdir(parents=True, exist_ok=True)

    # Load sync state
    state = load_sync_state(project_dir)
    since = None
    if not full_refresh and state.get("last_sync"):
        since = state["last_sync"]
        print(f"  Incremental sync since {since}")
    else:
        print(f"  Full sync")

    # Load file index for stale file cleanup
    file_index = load_file_index(project_dir)
    if full_refresh:
        file_index = {}  # Rebuild from scratch on full refresh

    # Fetch project info and sections
    print(f"\n  Fetching project info...")
    project_info = fetch_project_info(session, project_gid)
    sections = fetch_sections(session, project_gid)
    print(f"  Found {len(sections)} sections")

    # Seed the user-name cache with every workspace member so @mention URLs
    # in task descriptions and comments resolve to real names.
    if name_cache is not None:
        workspace_gid = ((project_info or {}).get("workspace") or {}).get("gid")
        if workspace_gid:
            added = seed_cache_from_workspace(session, workspace_gid, name_cache)
            if added:
                print(f"  Seeded {added} workspace user name(s) into cache.")

    # Fetch all tasks
    tasks = fetch_project_tasks(session, project_gid, since=since)
    print(f"  Total tasks to process: {len(tasks)}")

    if not tasks and since:
        print("  No changes since last sync.")
        return

    # Build section -> task mapping (skip PTO/Holiday sections)
    section_map = {}
    skipped_sections = set()
    for section in sections:
        sec_name = section.get("name", "Uncategorized")
        if sec_name in SKIP_SECTIONS:
            skipped_sections.add(section["gid"])
            print(f"  Skipping section: {sec_name}")
            continue
        section_map[section["gid"]] = {
            "name": sec_name,
            "tasks": [],
        }

    skipped_task_count = 0
    skipped_task_gids = set()
    for task in tasks:
        # Skip tasks in PTO/Holiday sections
        in_skipped = False
        for membership in (task.get("memberships") or []):
            sec = membership.get("section")
            if sec and sec.get("gid") in skipped_sections:
                in_skipped = True
                break
        if in_skipped:
            skipped_task_count += 1
            skipped_task_gids.add(task["gid"])
            continue

        placed = False
        for membership in (task.get("memberships") or []):
            sec = membership.get("section")
            if sec and sec.get("gid") in section_map:
                section_map[sec["gid"]]["tasks"].append(task)
                placed = True
                break
        if not placed:
            # Put in first section or create uncategorized
            if sections:
                first_valid = next((s["gid"] for s in sections if s["gid"] in section_map), None)
                if first_valid:
                    section_map[first_valid]["tasks"].append(task)
            else:
                if "uncategorized" not in section_map:
                    section_map["uncategorized"] = {"name": "Uncategorized", "tasks": []}
                section_map["uncategorized"]["tasks"].append(task)

    if skipped_task_count:
        print(f"  Skipped {skipped_task_count} tasks in PTO/Holiday sections")

    # Process each task — fetch subtasks, comments, attachments
    # Load checkpoint to skip already-processed tasks on resume
    processed_gids = load_checkpoint(project_dir)
    if processed_gids:
        print(f"  Resuming — {len(processed_gids)} tasks already processed, skipping them.")

    task_count = len(tasks)
    for idx, task in enumerate(tasks, 1):
        gid = task["gid"]
        name = task.get("name", "Untitled")

        if gid in skipped_task_gids:
            continue

        if gid in processed_gids:
            print(f"  [{idx}/{task_count}] (cached) {name[:60]}")
            continue

        print(f"  [{idx}/{task_count}] {name[:60]}...")

        # Fetch subtasks if any
        subtasks = []
        num_subtasks = task.get("num_subtasks", 0)
        if num_subtasks and num_subtasks > 0:
            subtasks = fetch_subtasks(session, gid)

        # Fetch comments
        stories = fetch_stories(session, gid)

        # Fetch and download attachments
        attachments = fetch_attachments(session, gid)
        downloaded = download_task_attachments(session, gid, name, attachments, project_dir)

        # Build markdown
        md_content = build_task_markdown(
            task,
            subtasks,
            stories,
            downloaded,
            session=session,
            name_cache=name_cache,
        )

        # Write file — organized by section
        section_name = ""
        for membership in (task.get("memberships") or []):
            sec = membership.get("section")
            if sec:
                section_name = sec.get("name", "")
                break

        if section_name:
            section_dir = project_dir / sanitize_filename(section_name)
            section_dir.mkdir(exist_ok=True)
        else:
            section_dir = project_dir

        filename = task_filename(gid, name) + ".md"
        # Truncate filename to avoid Windows 260-char path limit
        max_filename_len = 250 - len(str(section_dir))
        if max_filename_len < 30:
            max_filename_len = 30
        if len(filename) > max_filename_len:
            filename = filename[:max_filename_len - 3].rstrip() + ".md"
        filepath = section_dir / filename
        relative_path = str(filepath.relative_to(project_dir))

        # Delete old file if the task moved to a different section/path
        old_relative_path = file_index.get(gid)
        if old_relative_path and old_relative_path != relative_path:
            old_filepath = project_dir / old_relative_path
            if old_filepath.exists():
                old_filepath.unlink()
                print(f"    Removed stale file: {old_relative_path}")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(md_content)

        # Update file index with current path
        file_index[gid] = relative_path

        # Checkpoint after each task
        processed_gids.add(gid)
        if idx % 50 == 0:
            save_checkpoint(project_dir, processed_gids)

    # Write section MOCs
    sections_with_tasks = []
    for section_gid, section_data in section_map.items():
        section_name = section_data["name"]
        section_tasks = section_data["tasks"]
        if not section_tasks:
            continue
        sections_with_tasks.append((section_name, section_tasks))
        moc_content = build_section_moc(project_name, section_name, section_tasks)
        moc_filename = sanitize_filename(f"section - {section_name}") + ".md"
        with open(project_dir / moc_filename, "w", encoding="utf-8") as f:
            f.write(moc_content)

    # Write project MOC
    moc_content = build_project_moc(project_name, project_info, sections_with_tasks, tasks)
    with open(project_dir / f"{project_name} - MOC.md", "w", encoding="utf-8") as f:
        f.write(moc_content)

    # Save sync state, file index, and clear checkpoint (all tasks succeeded)
    save_sync_state(project_dir, {
        "last_sync": datetime.now(timezone.utc).isoformat(),
        "task_count": len(tasks),
        "project_gid": project_gid,
    })
    save_file_index(project_dir, file_index)
    clear_checkpoint(project_dir)

    print(f"\n  Done! Wrote {len(tasks)} tasks to {project_dir}")
    print(f"  Sections: {', '.join(s[0] for s in sections_with_tasks)}")


def main():
    if not ASANA_PAT or ASANA_PAT == "paste-your-pat-here":
        print("ERROR: Set ASANA_PAT in .env or as an environment variable.")
        sys.exit(1)

    args = sys.argv[1:]
    full_refresh = "--full" in args
    if full_refresh:
        args.remove("--full")

    # Determine which projects to sync
    if args:
        project_names = [a.upper() for a in args]
    else:
        project_names = DEFAULT_PROJECTS

    # Validate project names
    for name in project_names:
        if name not in PROJECT_MAP:
            print(f"ERROR: Unknown project '{name}'. Known projects: {', '.join(PROJECT_MAP.keys())}")
            sys.exit(1)

    session = asana_session()

    # Quick connectivity test
    print("Testing Asana API connection...")
    try:
        me = asana_get_single(session, "users/me", {"opt_fields": "name,email"})
        print(f"Authenticated as: {me.get('name', '?')} ({me.get('email', '?')})")
    except requests.HTTPError as e:
        print(f"ERROR: Authentication failed. Check your ASANA_PAT.\n{e}")
        sys.exit(1)

    # Load user-name cache once so every project shares it within this run
    # and across runs via the persisted JSON file.
    name_cache = load_user_cache(VAULT_ROOT)
    cache_start_size = len(name_cache)

    # Sync each project
    for name in project_names:
        gid = PROJECT_MAP[name]
        sync_project(session, name, gid, full_refresh, name_cache=name_cache)

    save_user_cache(VAULT_ROOT, name_cache)
    added = sum(1 for v in name_cache.values() if v) - cache_start_size
    if added > 0:
        print(f"  User cache: +{added} new name(s), {sum(1 for v in name_cache.values() if v)} total.")

    print(f"\n{'='*60}")
    print(f"  All done! Synced {len(project_names)} project(s).")
    print(f"  Output: {VAULT_ROOT}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
