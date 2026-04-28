---
type: workstream
status: in-progress
task_count: 123
blocked_count: 0
---

# Workstream: Bloomreach Feed & Utilities

> Jira Projects: **UTI** (123 issues), **WPM** (Bloomreach epics)
> Source: [[source-jira-wpm]]

## Overview

The UTI project and WPM Bloomreach epics cover the **backend feed generation and API utilities** that power the Bloomreach search engine. This is the data pipeline side — getting product data into Bloomreach and building the utility APIs that App Builder and EDS consume.

### Scope

- **Feed generation** ([[WPM-5002 - LP Implementation - Bloomreach - Feed Generation|WPM-5002]]) — Product data feeds from WUP to Bloomreach
- **Request-Response APIs** ([[WPM-5003 - LP Implementation - Bloomreach - Request-Response APIs|WPM-5003]]) — Search and suggest API implementations
- **Display support** ([[WPM-5083 - LP Implementation - Bloomreach - Display Support|WPM-5083]]) — Facet display, pricing, product card data
- **Pixel implementation** ([[WPM-5109 - LP Implementation - Bloomreach - Pixel Implementation & Logic|WPM-5109]]) — Bloomreach pixel and tracking logic
- **Post-MVP misc** ([[WPM-5150 - LP Implementation - Bloomreach - Post MVP - Misc|WPM-5150]]) — Follow-on improvements

### Key Epics (6 Bloomreach epics)

- [[WPM-4910 - LP Implementation - Bloomreach - Misc|WPM-4910]] — Bloomreach Misc
- [[WPM-5002 - LP Implementation - Bloomreach - Feed Generation|WPM-5002]] — Feed Generation
- [[WPM-5003 - LP Implementation - Bloomreach - Request-Response APIs|WPM-5003]] — Request-Response APIs
- [[WPM-5083 - LP Implementation - Bloomreach - Display Support|WPM-5083]] — Display Support
- [[WPM-5109 - LP Implementation - Bloomreach - Pixel Implementation & Logic|WPM-5109]] — Pixel Implementation & Logic
- [[WPM-5150 - LP Implementation - Bloomreach - Post MVP - Misc|WPM-5150]] — Post MVP Misc

## Progress

UTI: ~100 closed, ~14 in pipeline (Stakeholder Test / Deployment - PPE), ~9 other active

## Key Active Items (as of 2026-04-13)

| Key | Summary | Status | Priority | Assignee |
|-----|---------|--------|----------|----------|
| [[UTI-8531 - Usages Moved to Type are Still Showing Under Usage in DY Feed|UTI-8531]] | Usages moved to Type still appearing under Usage in DY feed (Taxonomy Batch-B) | In Progress | High | Rupali Deshmukh |
| [[UTI-8451 - [Private Link] Pull AC data from AdobeCartHeaderData  -- Legacy Data Push\|UTI-8451]] | Pull AC data from AdobeCartHeaderData — Legacy Data Push | Evaluated (NeedsGrooming) | High | Unassigned |
| [[UTI-8452 - [Private Link] Pull AC data from AdobeCartHoldReasonData  -- Legacy Data Push\|UTI-8452]] | Pull AC data from AdobeCartHoldReasonData — Legacy Data Push | Evaluated (NeedsGrooming) | High | Unassigned |

**UTI-8531 context:** In the Taxonomy Batch-B branch, DY feed generation confirmed that Usage values which should have been moved to the Type attribute are still appearing under Usage. Rupali Deshmukh investigating (created 2026-04-10, 5h estimate). Related to [[ws-taxonomy]].

> UTI-8451/8452 are Private Link / Legacy Data Push tasks — pulling Adobe Commerce cart data back to legacy tables. Unassigned with open QA subtasks (UTI-8475, UTI-8476). Risk: no owner, no grooming.

## Cross-References

| Area | Related Workstream |
|------|--------------------|
| App Builder consumes Bloomreach APIs | [[ws-app-builder]] |
| EDS renders Bloomreach results | [[comp-eds-plp-search]] |
| Product data feeds from WUP | [[ws-data-platform]] |
| Search provider research/RFP | [[ws-infrastructure]] |

## Team

Key assignees: Naga Ambarish Chigurala, Akim Malkov, Alex Tadevosyan, Aarthi Natarajan
