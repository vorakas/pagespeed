---
type: workstream
status: in-progress
task_count: 87
blocked_count: 1
---

# Workstream: Infrastructure & CI/CD

> Jira Projects: **CI** (87 issues), **WPM** (infrastructure epics)
> Source: [[source-jira-wpm]]

## Overview

Infrastructure, CI/CD pipelines, environment setup, and research tasks for the Adobe Commerce platform.

### Key Epics (7)

- [[WPM-4743 - AC Implementation - Search Provider RFP 2024|WPM-4743]] — Search Provider RFP 2024
- [[WPM-4751 - AC Implementation - Supporting Environment Setup|WPM-4751]] — Supporting Environment Setup
- [[WPM-4762 - AC Implementation - Misc|WPM-4762]] — AC Implementation Misc
- [[WPM-4776 - AC Implementation - Search Provider A-B Test Effort Research|WPM-4776]] — Search Provider AB Test Research
- [[WPM-4780 - WUP - LP Search Provider - Research|WPM-4780]] — LP Search Provider Research
- [[WPM-4804 - AC Implementation - Magento2 Research|WPM-4804]] — Magento2 Research
- [[WPM-4856 - AC Implementation - Search Provider A-B Test Improvements|WPM-4856]] — Search Provider AB Test Improvements
- [[WPM-5182 - AC Implementation - Tealium Integration|WPM-5182]] — Tealium Integration

### CI Project Scope

- Magento 2 ramp-up and PHP environment
- WUP Dashboard — monitoring, authentication, data source links
- Microservice breakout (Profile)
- AB testing infrastructure

## Active Items (CI)

- [[CI-4426 - Set up domain name for WUP Dashboard|CI-4426]] — Set up domain name for WUP Dashboard (Blocked)
- [[CI-4415 - Display recent entries on home page|CI-4415]] — Display recent entries on home page (Code Review)
- [[CI-4420 - Add response time to Microservice summary page|CI-4420]] — Add response time to Microservice summary page (Code Review)
- [[CI-4423 - Add data source links|CI-4423]] — Add data source links (Code Review)
- [[CI-4425 - Add additional Private link information to the UI|CI-4425]] — Add Private Link info to UI (Code Review)
- [[CI-4441 - Fix private link query to include jobs in progress|CI-4441]] — Fix private link query (Approved Code Review)
- [[CI-4328 - Breakout Single Profile into a Microservice|CI-4328]]/4331/4362 — Profile microservice breakout and auth backend (Deployment)

## Cross-References

| Area | Related Workstream |
|------|--------------------|
| Search provider feeds App Builder | [[ws-app-builder]] |
| Environment setup for AC | [[ws-eds]], [[ws-commerce-implementation]] |
| Tealium integration | [[ws-tealium-tags]], [[comp-eds-tealium-analytics]] |
| WUP Dashboard monitors data platform | [[ws-data-platform]] |

## Notes

- **WUP Dashboard domain setup is blocked** ([[CI-4426 - Set up domain name for WUP Dashboard|CI-4426]]) — potential infrastructure issue
- Search provider RFP concluded with Bloomreach selection — research epics are closed
- This workstream fills the **infrastructure coverage gap** identified in the wiki lint

## Asana Coverage (LAMPSPLUS)
**LAMPSPLUS Implementation:** ~29 tasks (Hosting, CI/CD, environments, security, admin config)
- Key: Hosting setup foundational, environment config

**LAMPSPLUS Pre-Launch:** 9 open infrastructure tasks
- Setup New Relic Alerts (due 2026-07-28), Setup Notification & Health Checks, Configure Error Handling
- Install Intrusion Monitoring Module, Install/Verify SSL Certificate, Install Vulnerability Scan Module
- Run Page Speed Test & Updates, Static Code Scan (due 2026-07-14), Preload Library Assets

**LAMPSPLUS Launch:** 9 open critical-path tasks (ALL open — none completed)
- Code Freeze, Data Synchronization Customization Support
- Launch Planning and Soft Launch Support, Development Launch Prep
- SEO Launch Prep, Analytics Launch Prep
- Day Before Launch Support (due 2026-03-31), Day Of Launch Support (due 2026-03-31)
- Post Launch Bug Fixes

### Key Tasks

**Pre-Launch:**
- [[LAMPSPLUS-379 - Setup New Relic Alerts​|Setup New Relic Alerts]]
- [[LAMPSPLUS-381 - Setup Notification & Health Checks​|Setup Notification & Health Checks]]
- [[LAMPSPLUS-382 - Configure Error Handling​|Configure Error Handling]]
- [[LAMPSPLUS-376 - Install Intrusion Monitoring Module|Install Intrusion Monitoring Module]]
- [[LAMPSPLUS-375 - Install-Verify SSL Certificate-s (support)|Install/Verify SSL Certificate]]
- [[LAMPSPLUS-377 - Install Vulnerability Scan Module|Install Vulnerability Scan Module]]
- [[LAMPSPLUS-374 - Run Page Speed Test & Updates|Run Page Speed Test & Updates]]
- [[LAMPSPLUS-373 - Static Code Scan|Static Code Scan]]
- [[LAMPSPLUS-372 - Preload Library Assets|Preload Library Assets]]

**Launch:**
- [[LAMPSPLUS-483 - Code Freeze|Code Freeze]]
- [[LAMPSPLUS-500 - Data Synchronization Customization Support|Data Synchronization Customization Support]]
- [[LAMPSPLUS-499 - Launch Planning and Soft Launch Support|Launch Planning and Soft Launch Support]]
- [[LAMPSPLUS-393 - Development Launch Prep|Development Launch Prep]]
- [[LAMPSPLUS-396 - Day Before Launch Support|Day Before Launch Support]]
- [[LAMPSPLUS-397 - Day Of Launch Support|Day Of Launch Support]]
- [[LAMPSPLUS-104 - Post Launch Bug Fixes|Post Launch Bug Fixes]]

**LPWE (Post-Launch):** 2 tasks
- Completed: Update Website Architecture, EDS GraphQL for URL Mapping
