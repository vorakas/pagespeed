---
type: workstream
status: in-progress
task_count: 128
blocked_count: 0
---

# Workstream: Tealium Tag Verification & EventStream

> Jira Project: **TEAL** (128 issues)
> Source: [[source-jira-wpm]]

## Overview

The TEAL project tracks **Tealium tag verification** on the Adobe Commerce site and **EventStream connector** implementation. This is the tag management side — verifying that every pixel/tag from the legacy LP site works correctly on Adobe Commerce.

### Scope

- **Tag verification** — Verify each 3rd-party tag fires correctly on Adobe Commerce (Facebook, Pinterest, GA4, Bluecore, Criteo, Bing, etc.)
- **EventStream connectors** — Server-side event forwarding via Tealium EventStream (Facebook, Pinterest, Google Ads)
- **Profile management** — "main" and "adobecommerce" Tealium profiles, platform identifier ("ecp") mappings
- **Pixel removal** — Remove deprecated pixels (SMS Attentive)
- **First-party domain** — Update Collect tag endpoint to first-party domain

## Progress

- Closed: ~55
- Active: 63 (mostly Open tag verification tasks)
- Failed QA: 2 (SundaySky, Pixlee Events)
- In pipeline: 11 (Stakeholder Test + QA on PPE)

## Active Work

**63 active issues** — the largest active backlog of any workstream. Dominated by two task groups:

1. **"Verify the tag on Adobe site"** (~30 tasks, mostly Open) — Each task verifies a specific tag/pixel:
   Facebook, Pinterest, GA4, Bluecore, Criteo, Bing Ads, Merkle, SundaySky, Pixlee, LIVERAMP 360, Connexity, PepperJam, Quantum Metric, Genesys Chat, Wunderkind, BloomReach, PebblePost

2. **EventStream connectors** (~15 tasks, all Open) — Server-side implementations:
   Facebook (PageView, AddToWishlist, AddToCart, Purchase, InitiateCheckout), Pinterest (PageVisit, AddToCart, Purchase), Google Ads (Purchase)

3. **Platform identifier** (~12 tasks, Evaluated/Open) — Adding "ecp" (ecommerce platform) identifier to Bluecore, DY, GA4, Quantum Metric mappings across both Tealium profiles

## Cross-References

| Area | Related Workstream |
|------|--------------------|
| EDS-side Tealium implementation | [[comp-eds-tealium-analytics]] |
| ACE2E pixel workstream | [[ws-pixels-analytics]] |
| First-party domain | [[comp-eds-tealium-analytics]] ([[ACEDS-535 - First-Party Domain - Update Universal Tag loading script\|ACEDS-535]]) |

## Recent Activity

| Task | Description | Status | Updated |
|------|-------------|--------|---------|
| [[ACEDS-597 - Update the utag data page type for Category Landing Pages\|ACEDS-597]] | Fix `utag_data.page_type` for Category Landing Pages (CLPs): "all" → "landing". New task 2026-04-13. Has QA subtask ACEDS-598. Linked to TEAL-2987 (SundaySky verification — discovered while testing). Companion to ACEDS-588. | Evaluated, Unassigned | 2026-04-13 |
| [[ACEDS-588 - Update the utag data page type for search results pages\|ACEDS-588]] | Fix `utag_data.page_type` for search results: "search-results" → "searchresults" (required by Criteo OneTag — surfaced during TEAL-2983/TEAL-3017 verification) | Approved Code Review (Calvin Liu) | 2026-04-13 |
| [[TEAL-3098 - -adobecommerce- profile - Remove -SMS Attentive tag- pixel\|TEAL-3098]] | Remove deprecated SMS Attentive pixel from adobecommerce profile | In Progress | 2026-04-13 |

## Notes

- This workstream represents a **significant go-live blocker** — all tags must be verified before launch
- Konstantin Minevich is the primary assignee for tag verification
- The "adobecommerce" profile is the new AC-specific Tealium profile; "main" is the legacy shared profile
