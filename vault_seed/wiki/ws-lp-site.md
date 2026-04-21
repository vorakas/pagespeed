---
type: workstream
status: in-progress
task_count: 920
blocked_count: 0
---

# Workstream: LP Site Implementation

> Jira Projects: **LP** (920 issues), **PSS** (135), **LPA** (8), **SCMS** (10)
> Source: [[source-jira-wpm]]

## Overview

The LP project is the **core LampsPlus.com legacy site** — the .NET application being migrated to Adobe Commerce. Tasks here cover features built on the legacy platform that either need to be maintained during migration or are prerequisites for the AC cutover.

### Key Epics (14 LP Implementation epics)

- [[WPM-4156 - LP Implementation - Static Left Nav|WPM-4156]] — Static Left Nav
- [[WPM-4876 - LP Implementation - Dynamic Sort (Left Nav)|WPM-4876]] — Dynamic Sort (Left Nav)
- [[WPM-4905 - LP Implementation - Update Minimum Pricing Policy|WPM-4905]] — Update Minimum Pricing Policy
- [[WPM-4921 - LP Implementation - Misc|WPM-4921]] — LP Implementation Misc
- [[WPM-4937 - LP Implementation - Available to Promise (ATP) for PDP and Cart|WPM-4937]] — Available to Promise (ATP) for PDP and Cart
- [[WPM-4989 - LP Implementation - Update URL Structure (PDP & PLP)|WPM-4989]] — Update URL Structure (PDP & PLP)
- [[WPM-5175 - LP Implementation - Opt Out Data Cleanup|WPM-5175]] — Opt Out Data Cleanup
- [[WPM-5191 - LP Implementation - Source Data Clean Up|WPM-5191]] — Source Data Clean Up
- [[WPM-5193 - LP Implementation - Handle Out of Stock Messages|WPM-5193]] — Handle Out of Stock Messages
- [[WPM-5233 - LP Implementation - Available to Promise (ATP) for PDP and Cart - Fast Follows|WPM-5233]] — ATP Fast Follows
- [[WPM-5274 - LP Implementation - Move Product Assets to Subdomain|WPM-5274]] — Move Product Assets to Subdomain
- [[WPM-5321 - LP Implementation - Attribute Data Cleanup|WPM-5321]] — Attribute Data Cleanup
- [[WPM-5385 - LP Implementation - Shop by Room Removal|WPM-5385]] — Shop by Room Removal
- [[WPM-5403 - LP Implementation - Create Account - Forgot Password WUP Support|WPM-5403]] — Create Account / Forgot Password WUP Support

### Sub-projects

- **PSS (Pro Source)** — 135 issues mirroring LP features for the pro/trade site
- **LPA (LP Accessories/Pro)** — 8 issues for pro account creation, discount tiers
- **SCMS (SuperCMS Search)** — 10 issues for search config and URL structure

## Progress

LP: ~860 closed, 11 active, ~33 in pipeline
PSS: ~116 closed, 3 active, ~16 in pipeline
LPA: 1 closed, 5 active (account creation pages — all Evaluating)

## Active Items

- [[LP-72357 - Prepare for Avalara Tax Exemption Certification Migration and Data Export|LP-72357]] — Avalara Tax Exemption Certification Migration (Evaluating)
- [[LP-71526 - Free shipping Flag is Displayed as 1 for Under $25 Attribute Value|LP-71526]] — Free Shipping Flag for Under $25 (Evaluated)
- [[LPA-587 - Updates to Admin Sign-In Page to Support Account Creation|LPA-587]]–591 — Pro account creation/forgot password pages (5 tasks, all Evaluating)
- [[PSS-1952 - Support Showing QuickShip Facet On Bloomreach-AC (Part 3)|PSS-1952]]/1953 — QuickShip facet support (Code Complete / In Progress)

## Cross-References

| Area | Related Workstream |
|------|--------------------|
| ATP logic shared with AC | [[ws-inventory-atp]] |
| URL structure affects SEO | [[ws-seo]], [[comp-eds-seo-meta]] |
| Product assets subdomain | [[ws-data-platform]] |
| Shop by Room removal | [[ws-eds]] (Room Scenes dropped from EDS scope too) |
| Account creation | [[ws-user-management]] |

## Team

Key assignees: Armen Shagmirian, Aarthi Natarajan, Naga Ambarish Chigurala, Alex Tadevosyan, Akim Malkov, Curt Mader
