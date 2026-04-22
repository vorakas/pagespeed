#!/usr/bin/env python3
"""
Jira → Obsidian Second Brain Exporter
======================================
Pulls all issues from one or more Jira Data Center/Server projects and
generates Obsidian-compatible markdown files with rich frontmatter,
wikilinks, and a Map of Content (MOC) index.

Each project gets its own subfolder inside your vault:
    raw/ACE2E/Epic/...   raw/ACE2E/Story/...
    raw/ACEDS/Epic/...   raw/ACEDS/Task/...

Supports incremental sync: on re-runs, only issues modified since
the last sync are re-fetched and rewritten.  Use --full to force
a complete refresh.

Usage:
    # Sync default projects (ACE2E + ACEDS):
    JIRA_PAT="xxx" python jira_to_obsidian.py

    # Sync specific projects:
    JIRA_PAT="xxx" python jira_to_obsidian.py ACE2E ACEDS PROJ3

    # Sync just one project:
    JIRA_PAT="xxx" python jira_to_obsidian.py ACEDS

    # Force full refresh for all:
    JIRA_PAT="xxx" python jira_to_obsidian.py --full

    # Custom JQL query (results go into --output folder):
    JIRA_PAT="xxx" python jira_to_obsidian.py --jql "key in (WPM-4610, childIssuesOf(WPM-4610))" --output WPM

    # Scheduled via Task Scheduler / cron:
    set JIRA_PAT=xxx && python jira_to_obsidian.py

Configure the variables below or set environment variables:
    JIRA_BASE_URL, JIRA_PAT, VAULT_ROOT
"""

import os
import re
import json
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    print("Installing requests...")
    os.system(f"{sys.executable} -m pip install requests --break-system-packages -q")
    import requests

# ──────────────────────────────────────────────
# CONFIGURATION — edit these or use env vars
# ──────────────────────────────────────────────
JIRA_BASE_URL = os.environ.get("JIRA_BASE_URL", "https://lampstrack.lampsplus.com")
JIRA_PAT = os.environ.get("JIRA_PAT", "")

# ⬇️  Your Obsidian vault root. Each project gets its own subfolder:2. P
#       raw/WPM/Epic/...    raw/WPM/Story/...
#       raw/ACEDS/Epic/...  raw/ACEDS/Story/...
VAULT_ROOT = os.environ.get("VAULT_ROOT", r"C:\Users\AdamB\Desktop\LPAdobe\raw")

# Default projects to sync when none are specified on the command line.
# Override by passing project keys as arguments:
#   python jira_to_obsidian.py WPM ACEDS
DEFAULT_PROJECTS = ["ACE2E", "ACEDS", "ACAB", "ACAQA", "ACCMS", "ACM"]

MAX_RESULTS_PER_PAGE = 50  # Jira pagination limit
SYNC_STATE_FILE = ".jira_sync_state.json"  # Per-project, stored in each subfolder


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def jira_session():
    """Create an authenticated requests session."""
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {JIRA_PAT}",
        "Accept": "application/json",
    })
    return s


def fetch_all_issues(session, project_key, since=None):
    """Paginate through all issues in the project via JQL search.

    Args:
        project_key: Jira project key (e.g. "WPM", "ACEDS").
        since: ISO datetime string. If provided, only fetch issues
               updated on or after this timestamp (incremental sync).
    """
    jql = f"project = {project_key}"
    if since:
        # Jira JQL expects: updated >= "2025-04-10 12:00"
        jql += f' AND updated >= "{since}"'
    jql += " ORDER BY key ASC"
    url = f"{JIRA_BASE_URL}/rest/api/2/search"
    fields = ",".join([
        "summary", "status", "issuetype", "priority", "assignee",
        "reporter", "created", "updated", "duedate", "resolutiondate",
        "resolution", "description", "comment", "issuelinks",
        "subtasks", "parent", "labels", "components", "fixVersions",
        "attachment", "worklog", "timetracking",
        # Sprint & story points live in custom fields — we grab all
        "customfield_10004",  # story points (common default)
        "customfield_10007",  # sprint (common default)
    ])

    all_issues = []
    start_at = 0

    while True:
        params = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": MAX_RESULTS_PER_PAGE,
            "fields": fields,
            "expand": "names",
        }
        print(f"  Fetching issues {start_at}–{start_at + MAX_RESULTS_PER_PAGE}...")
        resp = session.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        issues = data.get("issues", [])
        names_map = data.get("names", {})
        all_issues.extend(issues)

        if start_at + MAX_RESULTS_PER_PAGE >= data["total"]:
            break
        start_at += MAX_RESULTS_PER_PAGE

    print(f"  ✓ Retrieved {len(all_issues)} issues total.\n")
    return all_issues, names_map


def fetch_all_issues_jql(session, jql):
    """Paginate through all issues matching a raw JQL query.

    Args:
        jql: Complete JQL string (used as-is, no modifications).

    Returns:
        Tuple of (issues_list, names_map).
    """
    url = f"{JIRA_BASE_URL}/rest/api/2/search"
    fields = ",".join([
        "summary", "status", "issuetype", "priority", "assignee",
        "reporter", "created", "updated", "duedate", "resolutiondate",
        "resolution", "description", "comment", "issuelinks",
        "subtasks", "parent", "labels", "components", "fixVersions",
        "attachment", "worklog", "timetracking",
        "customfield_10004",  # story points
        "customfield_10007",  # sprint
    ])

    all_issues = []
    start_at = 0

    while True:
        params = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": MAX_RESULTS_PER_PAGE,
            "fields": fields,
            "expand": "names",
        }
        print(f"  Fetching issues {start_at}–{start_at + MAX_RESULTS_PER_PAGE}...")
        resp = session.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

        issues = data.get("issues", [])
        names_map = data.get("names", {})
        all_issues.extend(issues)

        if start_at + MAX_RESULTS_PER_PAGE >= data["total"]:
            break
        start_at += MAX_RESULTS_PER_PAGE

    print(f"  ✓ Retrieved {len(all_issues)} issues total.\n")
    return all_issues, names_map


def sanitize_filename(text):
    """Strip characters problematic in file paths.

    Handles NTFS-illegal characters and whitespace controls (newlines, CR,
    tabs) that would produce filenames Windows cannot check out. Runs of
    spaces and dashes are collapsed to singles for readability.
    """
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[\\/:*?"<>|]', "-", text)
    text = re.sub(r'-+', '-', text)
    return text.strip().strip('-').strip()


def format_date(iso_str):
    """Convert Jira ISO timestamp → YYYY-MM-DD."""
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return iso_str[:10] if len(iso_str) >= 10 else iso_str


def format_datetime(iso_str):
    """Convert Jira ISO timestamp → YYYY-MM-DD HH:MM."""
    if not iso_str:
        return ""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except Exception:
        return iso_str


def person_name(field):
    """Extract display name from a Jira user object."""
    if not field:
        return "Unassigned"
    return field.get("displayName", field.get("name", "Unknown"))


def extract_sprint_names(sprint_field):
    """Parse sprint info — can be a list of sprint objects or strings."""
    if not sprint_field:
        return []
    if isinstance(sprint_field, list):
        names = []
        for s in sprint_field:
            if isinstance(s, dict):
                names.append(s.get("name", str(s)))
            elif isinstance(s, str):
                # Jira sometimes returns sprint as a serialized string
                match = re.search(r"name=([^,\]]+)", s)
                if match:
                    names.append(match.group(1))
                else:
                    names.append(s)
        return names
    return [str(sprint_field)]


def jira_markup_to_md(text, issue_key=None):
    """
    Best-effort conversion of Jira wiki markup → Markdown.
    Covers the most common patterns.

    Args:
        text: Raw Jira wiki markup text.
        issue_key: Optional issue key (e.g. "WPM-4785") used to resolve
                   inline image references to _attachments/ paths.

    Order matters:
    1. Code/noformat blocks first (protect their contents)
    2. Strip HTML and Jira macros
    3. Convert tables
    4. Structural elements (headings, lists) before inline formatting
    5. Inline formatting (bold, italic, strikethrough) last
    """
    if not text:
        return ""

    t = text

    # ── Phase 1: Code blocks — protect their contents from later transforms ──

    # Code blocks: {code}...{code} → ```...```
    t = re.sub(r"\{code(?::([^}]*))?\}(.*?)\{code\}", r"```\1\n\2\n```", t, flags=re.DOTALL)

    # No-format blocks: {noformat}...{noformat} → ```...```
    t = re.sub(r"\{noformat\}(.*?)\{noformat\}", r"```\n\1\n```", t, flags=re.DOTALL)

    # ── Phase 2: Strip HTML tags and Jira macros ──

    # Convert <br> and <br/> to newlines FIRST (before stripping)
    t = re.sub(r"<br\s*/?>", "\n", t)
    # Strip common HTML tags (preserve content inside them)
    t = re.sub(r"</?(?:p|div|span|font|b|i|u|em|strong|ul|ol|li|td|tr|th|table|thead|tbody|h[1-6]|a|img|hr|sup|sub|pre|code|blockquote)(?:\s[^>]*)?>", "", t)

    # Color macros — just strip them
    t = re.sub(r"\{color:[^}]*\}(.*?)\{color\}", r"\1", t, flags=re.DOTALL)

    # Panels — convert to blockquote with optional title
    def panel_to_blockquote(m):
        params = m.group(1) or ""
        content = m.group(2).strip()
        # Extract title if present
        title_match = re.search(r"title=([^|}]+)", params)
        lines = []
        if title_match:
            lines.append(f"> **{title_match.group(1).strip()}**")
            lines.append(">")
        for line in content.split("\n"):
            lines.append(f"> {line}")
        return "\n".join(lines)
    t = re.sub(r"\{panel(?::([^}]*))?\}(.*?)\{panel\}", panel_to_blockquote, t, flags=re.DOTALL)

    # Quote blocks
    t = re.sub(r"\{quote\}(.*?)\{quote\}", lambda m: "\n".join("> " + l for l in m.group(1).strip().split("\n")), t,
               flags=re.DOTALL)

    # Info/warning/tip/note macros → blockquotes with label
    for macro in ["info", "warning", "tip", "note"]:
        def macro_to_blockquote(m, label=macro):
            content = m.group(1).strip()
            lines = [f"> **{label.upper()}**", ">"]
            for line in content.split("\n"):
                lines.append(f"> {line}")
            return "\n".join(lines)
        t = re.sub(r"\{" + macro + r"(?::[^}]*)?\}(.*?)\{" + macro + r"\}", macro_to_blockquote, t, flags=re.DOTALL)

    # Expand macros — convert to details/summary or just show content
    def expand_to_md(m):
        title = m.group(1) or "Details"
        content = m.group(2).strip()
        return f"**{title.strip()}**\n\n{content}"
    t = re.sub(r"\{expand(?::([^}]*))?\}(.*?)\{expand\}", expand_to_md, t, flags=re.DOTALL)

    # Strip remaining Jira macros: {toc}, {children}, {anchor:...}, {status:...}, etc.
    t = re.sub(r"\{toc(?::[^}]*)?\}", "", t)
    t = re.sub(r"\{children(?::[^}]*)?\}", "", t)
    t = re.sub(r"\{anchor:[^}]*\}", "", t)
    t = re.sub(r"\{status:([^}]*)\}", lambda m: f"`{re.search(r'title=([^|}]+)', m.group(1)).group(1) if re.search(r'title=([^|}]+)', m.group(1)) else 'status'}`", t)

    # User mentions: [~username] → @username
    t = re.sub(r"\[~([^\]]+)\]", r"@\1", t)

    # Jira emoticons → Unicode or text equivalents
    emoticon_map = {
        "(/)": "✅", "(x)": "❌", "(!)": "⚠️",
        "(?)": "❓", "(+)": "👍", "(-)": "👎",
        "(on)": "💡", "(off)": "🔌", "(*)": "⭐",
        "(i)": "ℹ️", "(flag)": "🚩",
    }
    for jira_icon, unicode_icon in emoticon_map.items():
        t = t.replace(jira_icon, unicode_icon)

    # ── Phase 3: Tables ──

    # Jira tables: ||header1||header2|| → | header1 | header2 |
    #              |cell1|cell2|        → | cell1   | cell2   |
    def convert_table_block(text):
        """Convert a block of Jira table lines to markdown table."""
        lines = text.split("\n")
        result = []
        in_table = False

        for line in lines:
            stripped = line.strip()

            # Header row: ||col1||col2||
            if stripped.startswith("||") and stripped.endswith("||"):
                cells = [c.strip() for c in stripped.split("||") if c.strip()]
                md_row = "| " + " | ".join(cells) + " |"
                separator = "| " + " | ".join("---" for _ in cells) + " |"
                result.append(md_row)
                result.append(separator)
                in_table = True

            # Data row: |col1|col2|  (but not || which is header)
            elif stripped.startswith("|") and not stripped.startswith("||") and stripped.endswith("|"):
                cells = [c.strip() for c in stripped.split("|")]
                # split on | gives empty strings at start/end
                cells = [c for c in cells if c or cells.index(c) not in (0, len(cells)-1)]
                cells = [c.strip() for c in stripped[1:-1].split("|")]
                md_row = "| " + " | ".join(cells) + " |"
                if not in_table:
                    # Data row without a preceding header — add a generic header
                    header = "| " + " | ".join(f"Col {i+1}" for i in range(len(cells))) + " |"
                    separator = "| " + " | ".join("---" for _ in cells) + " |"
                    result.append(header)
                    result.append(separator)
                    in_table = True
                result.append(md_row)

            elif stripped == "" and in_table:
                # Skip blank lines inside a table block — Jira often
                # inserts them between rows
                continue

            else:
                in_table = False
                result.append(line)

        return "\n".join(result)

    t = convert_table_block(t)

    # ── Phase 4: Structural elements (must run before inline formatting) ──

    # Bullet lists: * → -, ** → indented -, *** → double-indented -
    # MUST run before bold conversion, because ** at line start is a bullet, not bold
    # Allow optional leading whitespace — Jira often indents sub-bullets
    t = re.sub(r"^\s*(\*+)\s", lambda m: "  " * (len(m.group(1)) - 1) + "- ", t, flags=re.MULTILINE)

    # Numbered lists: # → 1., ## → indented 1.
    # MUST run BEFORE headings — Jira headings use "h1." not "#", so no conflict.
    # Allow optional leading whitespace.
    t = re.sub(r"^\s*(#+)\s", lambda m: "  " * (len(m.group(1)) - 1) + "1. ", t, flags=re.MULTILINE)

    # Headings: h1. → #, h2. → ##, etc.
    # Runs AFTER numbered lists so "## " (from Jira ##) is already converted to "  1. "
    t = re.sub(r"^h([1-6])\.\s*", lambda m: "#" * int(m.group(1)) + " ", t, flags=re.MULTILINE)

    # Block quotes: bq. text → > text
    t = re.sub(r"^bq\.\s*", "> ", t, flags=re.MULTILINE)

    # ── Phase 5: Inline formatting ──

    # Monospace: {{text}} → `text`
    t = re.sub(r"\{\{(.+?)\}\}", r"`\1`", t)

    # Bold: *text* → **text**  (only when not at line start — bullets already handled)
    t = re.sub(r"(?<!\w)\*([^\*\n]+?)\*(?!\w)", r"**\1**", t)

    # Italic: _text_ → *text*
    t = re.sub(r"(?<!\w)_([^_\n]+?)_(?!\w)", r"*\1*", t)

    # Strikethrough: -text- → ~~text~~
    # More restrictive: require whitespace or line boundary on both sides to avoid
    # matching hyphenated words like "real-time" or "line-level"
    t = re.sub(r"(?:^|(?<=\s))-([^\-\n]+?)-(?=\s|$)", r"~~\1~~", t, flags=re.MULTILINE)

    # Superscript: ^text^ → <sup>text</sup>  (markdown doesn't have native superscript)
    t = re.sub(r"\^([^\^\n]+?)\^", r"<sup>\1</sup>", t)

    # Subscript: ~text~ → <sub>text</sub>
    # Avoid matching inside ~~ (strikethrough) or @user patterns
    t = re.sub(r"(?<!~)~([^\~\n@]+?)~(?!~)", r"<sub>\1</sub>", t)

    # Citation: ??text?? → *text*  (render as italic)
    t = re.sub(r"\?\?([^\?\n]+?)\?\?", r"*\1*", t)

    # Links: [title|url] or [url]
    t = re.sub(r"\[([^|\]]+)\|([^\]]+)\]", r"[\1](\2)", t)
    t = re.sub(r"\[([^\]]+)\]", r"[\1](\1)", t)

    # Images: !image.png! or !image.png|thumbnail! → proper reference
    # If issue_key is provided, point to _attachments/ISSUEKEY_filename
    def convert_image(m):
        ref = m.group(1)
        # Strip Jira image params like |thumbnail, |width=300
        filename = ref.split("|")[0].strip()
        if issue_key:
            safe_name = re.sub(r'[\\/:*?"<>|]', "-", f"{issue_key}_{filename}")
            return f"![[_attachments/{safe_name}]]"
        return f"![{filename}]({filename})"
    t = re.sub(r"!([^!\n]+?)!", convert_image, t)

    # ── Phase 6: Spacing cleanup ──

    # Collapse 3+ consecutive newlines to 2 (one blank line)
    t = re.sub(r"\n{3,}", "\n\n", t)

    # Remove blank lines between consecutive list items (- or 1.)
    # so bullet lists aren't double-spaced
    t = re.sub(r"(^[ \t]*(?:- |\d+\. ).+)\n\n([ \t]*(?:- |\d+\. ))", r"\1\n\2", t, flags=re.MULTILINE)
    # Run twice to catch chains of 3+ items
    t = re.sub(r"(^[ \t]*(?:- |\d+\. ).+)\n\n([ \t]*(?:- |\d+\. ))", r"\1\n\2", t, flags=re.MULTILINE)
    t = re.sub(r"(^[ \t]*(?:- |\d+\. ).+)\n\n([ \t]*(?:- |\d+\. ))", r"\1\n\2", t, flags=re.MULTILINE)

    # Remove blank lines between consecutive table rows
    t = re.sub(r"(\|.*\|)\n\n(\|)", r"\1\n\2", t, flags=re.MULTILINE)
    t = re.sub(r"(\|.*\|)\n\n(\|)", r"\1\n\2", t, flags=re.MULTILINE)

    # Remove blank lines between consecutive blockquote lines
    t = re.sub(r"(^>.*)\n\n(^>)", r"\1\n\2", t, flags=re.MULTILINE)
    t = re.sub(r"(^>.*)\n\n(^>)", r"\1\n\2", t, flags=re.MULTILINE)

    return t.strip()


def issue_wikilink(key, summary=None):
    """Generate an Obsidian wikilink to another issue."""
    if summary:
        return f"[[{key} - {sanitize_filename(summary)}|{key}]]"
    return f"[[{key}]]"


# Image extensions that Obsidian can render inline
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"}
ATTACHMENTS_FOLDER = "_attachments"


def download_attachments(session, issue_key, attachments, output_dir):
    """Download all attachments for an issue into the _attachments folder.

    Returns a dict mapping original filename → local filename (with key prefix).
    Skips files that already exist on disk (unless size differs).
    """
    if not attachments:
        return {}

    att_dir = output_dir / ATTACHMENTS_FOLDER
    att_dir.mkdir(exist_ok=True)

    downloaded = {}
    for att in attachments:
        original_name = att.get("filename", "file")
        content_url = att.get("content", "")
        remote_size = att.get("size", 0)

        if not content_url:
            continue

        # Prefix with issue key to avoid collisions across issues
        local_name = f"{issue_key}_{original_name}"
        local_name = sanitize_filename(local_name)
        local_path = att_dir / local_name

        # Skip if already downloaded and same size
        if local_path.exists() and abs(local_path.stat().st_size - remote_size) < 100:
            downloaded[original_name] = local_name
            continue

        try:
            resp = session.get(content_url, stream=True, timeout=60)
            resp.raise_for_status()
            with open(local_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            downloaded[original_name] = local_name
        except Exception as e:
            print(f"   ⚠ Failed to download {original_name} from {issue_key}: {e}")

    return downloaded


# ──────────────────────────────────────────────
# MARKDOWN GENERATION
# ──────────────────────────────────────────────

def build_issue_markdown(issue, issue_lookup, downloaded_attachments=None):
    """Build the full Obsidian markdown for a single Jira issue."""
    if downloaded_attachments is None:
        downloaded_attachments = {}
    fields = issue["fields"]
    key = issue["key"]
    summary = fields.get("summary", "Untitled")
    issue_type = fields.get("issuetype", {}).get("name", "Task")
    status = fields.get("status", {}).get("name", "Unknown")
    priority = fields.get("priority", {}).get("name", "None") if fields.get("priority") else "None"
    assignee = person_name(fields.get("assignee"))
    reporter = person_name(fields.get("reporter"))
    created = format_date(fields.get("created"))
    updated = format_date(fields.get("updated"))
    due_date = format_date(fields.get("duedate"))
    resolved = format_date(fields.get("resolutiondate"))
    resolution = fields.get("resolution", {}).get("name", "") if fields.get("resolution") else ""
    labels = fields.get("labels", [])
    components = [c.get("name", "") for c in (fields.get("components") or [])]
    fix_versions = [v.get("name", "") for v in (fields.get("fixVersions") or [])]
    description = jira_markup_to_md(fields.get("description", ""), issue_key=key)
    story_points = fields.get("customfield_10004", "")
    sprints = extract_sprint_names(fields.get("customfield_10007"))
    jira_url = f"{JIRA_BASE_URL}/browse/{key}"

    # Time tracking
    tt = fields.get("timetracking") or {}
    original_estimate = tt.get("originalEstimate", "")
    time_spent = tt.get("timeSpent", "")
    remaining = tt.get("remainingEstimate", "")

    # ── Frontmatter ──
    tags = [f"jira/{issue_type.lower().replace(' ', '-')}",
            f"status/{status.lower().replace(' ', '-')}"]
    if priority != "None":
        tags.append(f"priority/{priority.lower()}")
    for label in labels:
        tags.append(f"label/{label}")

    # YAML-escape the summary — double quotes inside must become \" so the
    # frontmatter parser treats the whole string as one value. Extracted
    # outside the f-string because Python 3.11 (Railway) rejects backslashes
    # inside f-string expressions.
    summary_escaped = summary.replace('"', '\\"')
    fm_lines = [
        "---",
        f"key: {key}",
        f'summary: "{summary_escaped}"',
        f"type: {issue_type}",
        f"status: {status}",
        f"priority: {priority}",
        f"assignee: \"{assignee}\"",
        f"reporter: \"{reporter}\"",
        f"created: {created}",
        f"updated: {updated}",
    ]
    if due_date:
        fm_lines.append(f"due: {due_date}")
    if resolved:
        fm_lines.append(f"resolved: {resolved}")
    if resolution:
        fm_lines.append(f"resolution: {resolution}")
    if story_points:
        fm_lines.append(f"story_points: {story_points}")
    # Nested f-strings with escaped quotes break Python 3.11 (Railway),
    # which forbids backslashes anywhere inside an f-string expression —
    # including in a nested f-string that lives inside the outer expression.
    # Build the joined YAML list outside the outer f-string.
    if sprints:
        sprints_yaml = ", ".join('"' + s + '"' for s in sprints)
        fm_lines.append(f"sprints: [{sprints_yaml}]")
    if labels:
        labels_yaml = ", ".join('"' + l + '"' for l in labels)
        fm_lines.append(f"labels: [{labels_yaml}]")
    if components:
        components_yaml = ", ".join('"' + c + '"' for c in components)
        fm_lines.append(f"components: [{components_yaml}]")
    if fix_versions:
        fix_versions_yaml = ", ".join('"' + v + '"' for v in fix_versions)
        fm_lines.append(f"fix_versions: [{fix_versions_yaml}]")
    if original_estimate:
        fm_lines.append(f"original_estimate: \"{original_estimate}\"")
    if time_spent:
        fm_lines.append(f"time_spent: \"{time_spent}\"")
    if remaining:
        fm_lines.append(f"remaining_estimate: \"{remaining}\"")
    fm_lines.append(f"jira_url: {jira_url}")
    tags_yaml = ", ".join('"' + t + '"' for t in tags)
    fm_lines.append(f"tags: [{tags_yaml}]")
    fm_lines.append("---")

    parts = ["\n".join(fm_lines), ""]

    # ── Title ──
    parts.append(f"# {key}: {summary}")
    parts.append("")
    parts.append(f"> **Status:** {status}  ·  **Priority:** {priority}  ·  **Assignee:** {assignee}")
    parts.append(f"> [Open in Jira]({jira_url})")
    parts.append("")

    # ── Parent / Epic link ──
    parent = fields.get("parent")
    if parent:
        parent_key = parent["key"]
        parent_summary = parent.get("fields", {}).get("summary", "")
        parts.append(f"**Parent:** {issue_wikilink(parent_key, parent_summary)}")
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
    subtasks = fields.get("subtasks") or []
    if subtasks:
        parts.append("## Subtasks")
        parts.append("")
        for st in subtasks:
            st_key = st["key"]
            st_summary = st.get("fields", {}).get("summary", st_key)
            st_status = st.get("fields", {}).get("status", {}).get("name", "")
            done = "x" if st_status.lower() in ("done", "closed", "resolved") else " "
            parts.append(f"- [{done}] {issue_wikilink(st_key, st_summary)}  `{st_status}`")
        parts.append("")

    # ── Linked Issues ──
    links = fields.get("issuelinks") or []
    if links:
        parts.append("## Linked Issues")
        parts.append("")
        for link in links:
            link_type = link.get("type", {}).get("outward", "relates to")
            if "outwardIssue" in link:
                linked = link["outwardIssue"]
                direction = link.get("type", {}).get("outward", "relates to")
            elif "inwardIssue" in link:
                linked = link["inwardIssue"]
                direction = link.get("type", {}).get("inward", "relates to")
            else:
                continue
            linked_key = linked["key"]
            linked_summary = linked.get("fields", {}).get("summary", "")
            parts.append(f"- **{direction}** {issue_wikilink(linked_key, linked_summary)}")
        parts.append("")

    # ── Attachments ──
    attachments = fields.get("attachment") or []
    if attachments:
        parts.append("## Attachments")
        parts.append("")
        for att in attachments:
            name = att.get("filename", "file")
            size_kb = round(att.get("size", 0) / 1024, 1)
            author = person_name(att.get("author"))
            created_at = format_date(att.get("created"))
            url = att.get("content", "")
            ext = Path(name).suffix.lower()

            local_name = downloaded_attachments.get(name)
            if local_name:
                if ext in IMAGE_EXTENSIONS:
                    # Embed image inline — renders in Obsidian reading view
                    parts.append(f"![[{ATTACHMENTS_FOLDER}/{local_name}]]")
                    parts.append(f"*{name} — {size_kb} KB, uploaded by {author} on {created_at}*")
                else:
                    # Link non-image files
                    parts.append(
                        f"- [[{ATTACHMENTS_FOLDER}/{local_name}|{name}]]  ({size_kb} KB, by {author} on {created_at})")
            else:
                # Fallback to Jira URL if download failed
                parts.append(f"- [{name}]({url})  ({size_kb} KB, by {author} on {created_at}) ⚠ *not downloaded*")
            parts.append("")
        parts.append("")

    # ── Time Tracking ──
    if original_estimate or time_spent:
        parts.append("## Time Tracking")
        parts.append("")
        if original_estimate:
            parts.append(f"- **Original estimate:** {original_estimate}")
        if time_spent:
            parts.append(f"- **Time spent:** {time_spent}")
        if remaining:
            parts.append(f"- **Remaining:** {remaining}")
        parts.append("")

    # ── Comments ──
    comments = fields.get("comment", {}).get("comments", [])
    if comments:
        parts.append("## Comments")
        parts.append("")
        for c in comments:
            author = person_name(c.get("author"))
            dt = format_datetime(c.get("created"))
            body = jira_markup_to_md(c.get("body", ""), issue_key=key)
            parts.append(f"### {author} — {dt}")
            parts.append("")
            parts.append(body)
            parts.append("")

    # ── Metadata footer ──
    parts.append("---")
    parts.append(f"*Created: {created} · Updated: {updated} · Reporter: {reporter}*")

    return "\n".join(parts)


def build_moc(issues_by_type, project_key):
    """Build the Map of Content (project index) file."""
    total = sum(len(v) for v in issues_by_type.values())
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    lines = [
        "---",
        f"title: \"{project_key} — Project Map of Content\"",
        f"generated: {now}",
        f"total_issues: {total}",
        "tags: [\"MOC\", \"jira\"]",
        "---",
        "",
        f"# 🗺️ {project_key} — Project Map of Content",
        "",
        f"*Auto-generated from Jira on {now}. {total} issues total.*",
        "",
    ]

    # Summary stats
    lines.append("## Overview")
    lines.append("")
    lines.append("| Type | Count |")
    lines.append("|------|-------|")
    for issue_type in sorted(issues_by_type.keys()):
        count = len(issues_by_type[issue_type])
        lines.append(f"| {issue_type} | {count} |")
    lines.append("")

    # Per-type listing
    for issue_type in sorted(issues_by_type.keys()):
        issues = issues_by_type[issue_type]
        lines.append(f"## {issue_type}s")
        lines.append("")
        for issue in sorted(issues, key=lambda i: i["key"]):
            key = issue["key"]
            summary = issue["fields"].get("summary", "Untitled")
            status = issue["fields"].get("status", {}).get("name", "")
            assignee = person_name(issue["fields"].get("assignee"))
            link = issue_wikilink(key, summary)
            lines.append(f"- {link}  `{status}`  → {assignee}")
        lines.append("")

    return "\n".join(lines)


def build_dashboard(issues, project_key):
    """Build a Dataview-friendly dashboard note."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "---",
        f"title: \"{project_key} Dashboard\"",
        f"generated: {now}",
        "tags: [\"dashboard\", \"jira\"]",
        "---",
        "",
        f"# 📊 {project_key} Dashboard",
        "",
        "Use this with the **Dataview** plugin for dynamic queries.",
        "",
        "## Open Issues by Priority",
        "```dataview",
        "TABLE status, assignee, priority, due",
        f"FROM \"#{project_key}\"",
        "WHERE !contains(status, \"Done\") AND !contains(status, \"Closed\")",
        "SORT priority ASC",
        "```",
        "",
        "## My Assigned Issues",
        "```dataview",
        "TABLE status, priority, due, story_points",
        f"FROM \"#{project_key}\"",
        "WHERE contains(assignee, \"YOUR_NAME\")",
        "SORT due ASC",
        "```",
        "",
        "## Recently Updated",
        "```dataview",
        "TABLE status, assignee, updated",
        f"FROM \"#{project_key}\"",
        "SORT updated DESC",
        "LIMIT 20",
        "```",
        "",
        "## Overdue Issues",
        "```dataview",
        "TABLE status, assignee, due",
        f"FROM \"#{project_key}\"",
        "WHERE due < date(today) AND !contains(status, \"Done\")",
        "SORT due ASC",
        "```",
        "",
        "## Story Points by Sprint",
        "```dataview",
        "TABLE sprints, story_points, status",
        f"FROM \"#{project_key}\"",
        "WHERE story_points",
        "SORT sprints ASC",
        "```",
    ]
    return "\n".join(lines)


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

def load_sync_state(output):
    """Load the last sync timestamp from the state file."""
    state_path = output / SYNC_STATE_FILE
    if state_path.exists():
        try:
            data = json.loads(state_path.read_text())
            return data.get("last_sync")
        except Exception:
            return None
    return None


def save_sync_state(output, project_key):
    """Save the current timestamp as the last sync point."""
    state_path = output / SYNC_STATE_FILE
    state = {
        "last_sync": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "project": project_key,
        "base_url": JIRA_BASE_URL,
    }
    state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def collect_existing_issues(output, project_key=None):
    """Scan the vault folder and return all existing issue keys → file paths.

    If ``project_key`` is given, only files whose name starts with that key
    are returned. If ``None``, any Jira-style key (``ABC-123``) is matched —
    used for JQL feeds whose output folder can span many projects (e.g. WPM).
    """
    existing = {}
    pattern = re.compile(
        rf"({re.escape(project_key)}-\d+)" if project_key
        else r"([A-Z][A-Z0-9_]+-\d+)"
    )
    for md_file in output.rglob("*.md"):
        # Files are named like "WPM-123 - Some summary.md"
        match = pattern.match(md_file.name)
        if match:
            existing[match.group(1)] = md_file
    return existing


def sync_project(session, project_key, force_full=False):
    """Sync a single Jira project into its own subfolder under VAULT_ROOT."""
    output = Path(VAULT_ROOT) / project_key
    output.mkdir(parents=True, exist_ok=True)

    print(f"{'=' * 60}")
    print(f"  Project: {project_key}")
    print(f"  Output:  {output.resolve()}")
    print(f"{'=' * 60}")

    # ── Decide: full vs incremental sync ──
    last_sync = None if force_full else load_sync_state(output)

    if last_sync:
        print(f"🔄 Incremental sync — fetching issues updated since {last_sync}...")
        print(f"   (use --full to force a complete refresh)\n")
        issues, names_map = fetch_all_issues(session, project_key, since=last_sync)

        if not issues:
            save_sync_state(output, project_key)
            print("✅ No issues changed since last sync. Everything is up to date.\n")
            return
        print(f"   {len(issues)} issue(s) changed — updating those files...\n")
    else:
        print(f"📥 Full export — fetching all issues in project {project_key}...")
        issues, names_map = fetch_all_issues(session, project_key)

        if not issues:
            print(f"⚠ No issues found for {project_key}. Check the project key.\n")
            return

    # Build lookup for wikilinks
    issue_lookup = {i["key"]: i for i in issues}

    # If incremental, handle the case where an issue's type
    # changed and it should move folders. Remove old file if it exists.
    if last_sync:
        existing = collect_existing_issues(output, project_key)
        for key in issue_lookup:
            if key in existing:
                old_path = existing[key]
                old_path.unlink(missing_ok=True)

    # Group by issue type
    issues_by_type = {}
    for issue in issues:
        itype = issue["fields"].get("issuetype", {}).get("name", "Other")
        issues_by_type.setdefault(itype, []).append(issue)

    print(f"📝 Writing to: {output.resolve()}\n")

    # Create type-based folders and write issue files
    count = 0
    att_count = 0
    for issue_type, type_issues in issues_by_type.items():
        folder_name = sanitize_filename(issue_type)
        type_dir = output / folder_name
        type_dir.mkdir(exist_ok=True)

        for issue in type_issues:
            key = issue["key"]
            summary = issue["fields"].get("summary", "Untitled")
            filename = f"{key} - {sanitize_filename(summary)}.md"
            if len(filename) > 200:
                filename = filename[:196] + ".md"

            # Download attachments first
            attachments = issue["fields"].get("attachment") or []
            downloaded = {}
            if attachments:
                print(f"   📎 {key}: downloading {len(attachments)} attachment(s)...")
                downloaded = download_attachments(session, key, attachments, output)
                att_count += len(downloaded)

            md = build_issue_markdown(issue, issue_lookup, downloaded)
            (type_dir / filename).write_text(md, encoding="utf-8")
            count += 1

    # Rebuild MOC from all vault files (full or incremental)
    if not last_sync:
        all_issues_for_moc = issues
    else:
        print("   Rebuilding MOC from all vault files...")
        all_issues_for_moc = list(issues)
        existing_after = collect_existing_issues(output, project_key)
        seen_keys = set(issue_lookup.keys())
        for key, path in existing_after.items():
            if key not in seen_keys:
                try:
                    content = path.read_text(encoding="utf-8")
                    fm = {}
                    if content.startswith("---"):
                        end = content.index("---", 3)
                        for line in content[3:end].strip().split("\n"):
                            if ": " in line:
                                k, v = line.split(": ", 1)
                                fm[k.strip()] = v.strip().strip('"')
                    stub = {
                        "key": key,
                        "fields": {
                            "summary": fm.get("summary", ""),
                            "issuetype": {"name": fm.get("type", "Other")},
                            "status": {"name": fm.get("status", "")},
                            "assignee": {"displayName": fm.get("assignee", "Unassigned")},
                        }
                    }
                    all_issues_for_moc.append(stub)
                except Exception:
                    pass

    all_by_type = {}
    for issue in all_issues_for_moc:
        itype = issue["fields"].get("issuetype", {}).get("name", "Other")
        all_by_type.setdefault(itype, {})[issue["key"]] = issue
    all_by_type_list = {k: list(v.values()) for k, v in all_by_type.items()}

    moc_md = build_moc(all_by_type_list, project_key)
    (output / f"{project_key} - Map of Content.md").write_text(moc_md, encoding="utf-8")

    dash_md = build_dashboard(all_issues_for_moc, project_key)
    (output / f"{project_key} - Dashboard.md").write_text(dash_md, encoding="utf-8")

    # Write graph config only on first run (don't overwrite user customizations)
    obsidian_dir = output / ".obsidian"
    graph_path = obsidian_dir / "graph.json"
    if not graph_path.exists():
        obsidian_dir.mkdir(exist_ok=True)
        graph_json = {
            "colorGroups": [
                {"query": "tag:#jira/epic", "color": {"a": 1, "rgb": 6697881}},
                {"query": "tag:#jira/story", "color": {"a": 1, "rgb": 3447003}},
                {"query": "tag:#jira/task", "color": {"a": 1, "rgb": 2067276}},
                {"query": "tag:#jira/bug", "color": {"a": 1, "rgb": 15158332}},
                {"query": "tag:#jira/sub-task", "color": {"a": 1, "rgb": 9807270}},
            ]
        }
        graph_path.write_text(json.dumps(graph_json, indent=2), encoding="utf-8")

    # Save sync state
    save_sync_state(output, project_key)

    mode = "updated" if last_sync else "generated"
    att_msg = f", {att_count} attachments downloaded" if att_count else ""
    print(f"\n✅ {project_key}: {mode.capitalize()} {count} issue files + MOC + Dashboard{att_msg}.")
    print(f"   📂 {output.resolve()}")
    for issue_type in sorted(issues_by_type.keys()):
        n = len(issues_by_type[issue_type])
        print(f"      {sanitize_filename(issue_type)}/  ({n} files {mode})")
    if att_count:
        print(f"      {ATTACHMENTS_FOLDER}/  ({att_count} files)")
    print(f"      {project_key} - Map of Content.md")
    print(f"      {project_key} - Dashboard.md")
    print()


def _apply_incremental_filter(jql: str, since: str) -> str:
    """Add ``AND updated >= "<since>"`` to a user-supplied JQL.

    Wraps the user's clause in parentheses so any top-level ``OR`` is
    preserved, and re-positions the filter before a trailing ``ORDER BY``
    if one is present. ``since`` is a ``YYYY-MM-DD HH:MM`` UTC string
    matching Jira's JQL datetime format."""
    stripped = jql.strip()
    # Split off ORDER BY (case-insensitive) so the AND lands in the WHERE.
    match = re.search(r"\s+ORDER\s+BY\s+", stripped, flags=re.IGNORECASE)
    if match:
        where = stripped[: match.start()].rstrip()
        order = stripped[match.start():].lstrip()
        return f'({where}) AND updated >= "{since}" {order}'
    return f'({stripped}) AND updated >= "{since}"'


def sync_jql(session, jql, output_name, force_full=False):
    """Sync issues from a custom JQL query into a single output folder.

    Issues from different projects all land in the same folder, organized
    by issue type.  A MOC and Dashboard are generated using the output_name
    as the "project key".

    Supports incremental syncs: the first run is a full export (no state
    file). On subsequent runs the state file's timestamp is AND-ed into
    the user's JQL so only changed issues are fetched. Pass
    ``force_full=True`` to ignore the state file.
    """
    output = Path(VAULT_ROOT) / output_name
    output.mkdir(parents=True, exist_ok=True)

    print(f"{'=' * 60}")
    print(f"  Custom JQL sync → {output_name}/")
    print(f"  Output:  {output.resolve()}")
    print(f"  JQL:     {jql[:120]}{'...' if len(jql) > 120 else ''}")
    print(f"{'=' * 60}")

    # ── Decide: full vs incremental sync ──
    last_sync = None if force_full else load_sync_state(output)

    if last_sync:
        effective_jql = _apply_incremental_filter(jql, last_sync)
        print(f"🔄 Incremental sync — fetching issues updated since {last_sync}...")
        print(f"   (pass fullRefresh=true to force a complete refresh)\n")
        issues, names_map = fetch_all_issues_jql(session, effective_jql)

        if not issues:
            save_sync_state(output, output_name)
            print("✅ No issues changed since last sync. Everything is up to date.\n")
            return
        print(f"   {len(issues)} issue(s) changed — updating those files...\n")
    else:
        print(f"\n📥 Full export — fetching all issues matching JQL...")
        issues, names_map = fetch_all_issues_jql(session, jql)

        if not issues:
            print(f"⚠ No issues found for the JQL query.\n")
            return

    # Build lookup for wikilinks
    issue_lookup = {i["key"]: i for i in issues}

    # On incremental runs, remove old files for changed issues so an issue
    # whose type changed (e.g. Story → Task) ends up in the correct folder
    # instead of existing in both.
    if last_sync:
        existing = collect_existing_issues(output)
        for key in issue_lookup:
            if key in existing:
                existing[key].unlink(missing_ok=True)

    # Group by issue type
    issues_by_type = {}
    for issue in issues:
        itype = issue["fields"].get("issuetype", {}).get("name", "Other")
        issues_by_type.setdefault(itype, []).append(issue)

    # Track which Jira projects are represented (in this delta, not the
    # whole vault — accurate for the message printed below).
    projects_seen = {}
    for issue in issues:
        proj = issue["key"].rsplit("-", 1)[0]
        projects_seen[proj] = projects_seen.get(proj, 0) + 1

    print(f"\n📝 Writing {len(issues)} issues to: {output.resolve()}")
    print(f"   Projects found: {', '.join(f'{k} ({v})' for k, v in sorted(projects_seen.items()))}\n")

    # Create type-based folders and write issue files
    count = 0
    att_count = 0
    for issue_type, type_issues in issues_by_type.items():
        folder_name = sanitize_filename(issue_type)
        type_dir = output / folder_name
        type_dir.mkdir(exist_ok=True)

        for issue in type_issues:
            key = issue["key"]
            summary = issue["fields"].get("summary", "Untitled")
            filename = f"{key} - {sanitize_filename(summary)}.md"
            if len(filename) > 200:
                filename = filename[:196] + ".md"

            # Download attachments
            attachments = issue["fields"].get("attachment") or []
            downloaded = {}
            if attachments:
                print(f"   📎 {key}: downloading {len(attachments)} attachment(s)...")
                downloaded = download_attachments(session, key, attachments, output)
                att_count += len(downloaded)

            md = build_issue_markdown(issue, issue_lookup, downloaded)
            (type_dir / filename).write_text(md, encoding="utf-8")
            count += 1

    # Rebuild MOC/Dashboard from the delta + stubs of untouched existing
    # files, so the index reflects the whole vault — same approach as
    # sync_project.
    if not last_sync:
        all_issues_for_moc = issues
    else:
        print("   Rebuilding MOC from all vault files...")
        all_issues_for_moc = list(issues)
        existing_after = collect_existing_issues(output)
        seen_keys = set(issue_lookup.keys())
        for key, path in existing_after.items():
            if key in seen_keys:
                continue
            try:
                content = path.read_text(encoding="utf-8")
                fm = {}
                if content.startswith("---"):
                    end = content.index("---", 3)
                    for line in content[3:end].strip().split("\n"):
                        if ": " in line:
                            k, v = line.split(": ", 1)
                            fm[k.strip()] = v.strip().strip('"')
                stub = {
                    "key": key,
                    "fields": {
                        "summary": fm.get("summary", ""),
                        "issuetype": {"name": fm.get("type", "Other")},
                        "status": {"name": fm.get("status", "")},
                        "assignee": {"displayName": fm.get("assignee", "Unassigned")},
                    },
                }
                all_issues_for_moc.append(stub)
            except Exception:
                pass

    all_by_type = {}
    for issue in all_issues_for_moc:
        itype = issue["fields"].get("issuetype", {}).get("name", "Other")
        all_by_type.setdefault(itype, {})[issue["key"]] = issue
    all_by_type_list = {k: list(v.values()) for k, v in all_by_type.items()}

    moc_md = build_moc(all_by_type_list, output_name)
    (output / f"{output_name} - Map of Content.md").write_text(moc_md, encoding="utf-8")

    dash_md = build_dashboard(all_issues_for_moc, output_name)
    (output / f"{output_name} - Dashboard.md").write_text(dash_md, encoding="utf-8")

    # Save sync state
    save_sync_state(output, output_name)

    mode = "Updated" if last_sync else "Generated"
    att_msg = f", {att_count} attachments downloaded" if att_count else ""
    print(f"\n✅ {output_name}: {mode} {count} issue files + MOC + Dashboard{att_msg}.")
    print(f"   📂 {output.resolve()}")
    for issue_type in sorted(issues_by_type.keys()):
        n = len(issues_by_type[issue_type])
        print(f"      {sanitize_filename(issue_type)}/  ({n} files {mode.lower()})")
    if att_count:
        print(f"      {ATTACHMENTS_FOLDER}/  ({att_count} files)")
    print(f"      {output_name} - Map of Content.md")
    print(f"      {output_name} - Dashboard.md")
    print(f"\n   Projects represented: {', '.join(f'{k} ({v})' for k, v in sorted(projects_seen.items()))}")
    print()


def main():
    # Parse arguments: project keys + flags
    force_full = "--full" in sys.argv
    args = sys.argv[1:]

    # Extract --jql "...", --jql-file path, and --output NAME
    custom_jql = None
    output_name = None
    filtered_args = []
    i = 0
    while i < len(args):
        if args[i] == "--jql" and i + 1 < len(args):
            custom_jql = args[i + 1]
            i += 2
        elif args[i] == "--jql-file" and i + 1 < len(args):
            jql_path = Path(args[i + 1])
            if not jql_path.exists():
                print(f"❌ JQL file not found: {jql_path}")
                sys.exit(1)
            custom_jql = jql_path.read_text(encoding="utf-8").strip()
            print(f"   Loaded JQL from: {jql_path}")
            i += 2
        elif args[i] == "--output" and i + 1 < len(args):
            output_name = args[i + 1]
            i += 2
        elif args[i].startswith("--"):
            i += 1  # skip flags like --full
        else:
            filtered_args.append(args[i])
            i += 1

    project_keys = filtered_args

    if JIRA_PAT == "YOUR_PAT_HERE":
        print("⚠️  Please set your PAT!")
        print("   Either edit JIRA_PAT in the script, or run:")
        print(f'   JIRA_PAT="your-token" python {sys.argv[0]} ACE2E ACEDS')
        sys.exit(1)

    print(f"🔌 Connecting to {JIRA_BASE_URL}...")
    session = jira_session()

    # Quick auth check
    try:
        me = session.get(f"{JIRA_BASE_URL}/rest/api/2/myself")
        me.raise_for_status()
        user = me.json()
        print(f"   Authenticated as: {user.get('displayName', user.get('name', '?'))}")
    except Exception as e:
        print(f"❌ Authentication failed: {e}")
        print("   Check your PAT and base URL.")
        sys.exit(1)

    print(f"   Vault root: {VAULT_ROOT}")

    # Custom JQL mode
    if custom_jql:
        if not output_name:
            output_name = "CUSTOM"
        print(f"   Mode:       Custom JQL → {output_name}/")
        print()
        sync_jql(session, custom_jql, output_name)
        print("🏁 JQL sync complete!")
        return

    # Standard per-project mode
    if not project_keys:
        project_keys = DEFAULT_PROJECTS

    print(f"   Projects:   {', '.join(project_keys)}")
    if force_full:
        print(f"   Mode:       --full (forced complete refresh)")
    print()

    for project_key in project_keys:
        sync_project(session, project_key, force_full=force_full)

    print("🏁 All projects synced!")


if __name__ == "__main__":
    main()