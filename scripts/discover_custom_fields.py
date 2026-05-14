#!/usr/bin/env python3
"""Discover Jira custom field IDs for the fields needed by the Report tab.

Usage:
    set JIRA_PAT=your-token-here
    python scripts/discover_custom_fields.py

Fetches all field definitions from Jira, then cross-references a known
issue (WPM-5083) to confirm the field IDs return expected values.
"""

import os
import sys
import json

try:
    import requests
except ImportError:
    os.system(f"{sys.executable} -m pip install requests -q")
    import requests

JIRA_BASE_URL = os.environ.get("JIRA_BASE_URL", "https://lampstrack.lampsplus.com")
JIRA_PAT = os.environ.get("JIRA_PAT", "")

if not JIRA_PAT:
    print("ERROR: Set JIRA_PAT environment variable first.")
    print('  set JIRA_PAT=your-token-here')
    sys.exit(1)

session = requests.Session()
session.headers.update({
    "Authorization": f"Bearer {JIRA_PAT}",
    "Accept": "application/json",
})

# ── Step 1: Fetch all field definitions ──
print(f"Connecting to {JIRA_BASE_URL}...")
resp = session.get(f"{JIRA_BASE_URL}/rest/api/2/field")
resp.raise_for_status()
all_fields = resp.json()

# Search for our target fields by name
TARGET_NAMES = [
    "epic link",
    "resource group",
    "product owner",
    "resource queue",
]

print(f"\n{'='*70}")
print(f"  Found {len(all_fields)} fields total. Searching for targets...")
print(f"{'='*70}\n")

found_ids = {}
for field in all_fields:
    field_name = field.get("name", "").lower()
    field_id = field.get("id", "")
    for target in TARGET_NAMES:
        if target in field_name:
            found_ids[target] = field_id
            print(f"  MATCH: '{field['name']}' → {field_id}")
            print(f"         custom: {field.get('custom', False)}, "
                  f"schema: {field.get('schema', {}).get('type', 'n/a')}")

# ── Step 2: Verify against a known issue ──
VERIFY_KEY = "WPM-5083"
print(f"\n{'='*70}")
print(f"  Verifying against {VERIFY_KEY}...")
print(f"{'='*70}\n")

custom_field_ids = [v for v in found_ids.values() if v.startswith("customfield_")]
fields_param = ",".join(["summary", "parent"] + custom_field_ids)

resp = session.get(
    f"{JIRA_BASE_URL}/rest/api/2/issue/{VERIFY_KEY}",
    params={"fields": fields_param},
)
resp.raise_for_status()
issue = resp.json()
fields_data = issue.get("fields", {})

print(f"  Issue: {VERIFY_KEY} — {fields_data.get('summary', '?')}")
print(f"  Parent: {fields_data.get('parent', {}).get('key', 'none')}")
for target, field_id in found_ids.items():
    value = fields_data.get(field_id)
    # Custom fields often return objects with 'value' or 'name' keys
    if isinstance(value, dict):
        display = value.get("value") or value.get("name") or value.get("displayName") or str(value)
    elif isinstance(value, list):
        display = ", ".join(
            (v.get("value") or v.get("name") or str(v)) if isinstance(v, dict) else str(v)
            for v in value
        )
    else:
        display = str(value)
    print(f"  {target:20s} ({field_id}): {display}")

# ── Step 3: Output config block for jira_sync.py ──
print(f"\n{'='*70}")
print("  COPY THIS INTO jira_sync.py:")
print(f"{'='*70}\n")
for target, field_id in found_ids.items():
    var_name = target.upper().replace(" ", "_") + "_FIELD"
    print(f'{var_name} = "{field_id}"  # {target}')
