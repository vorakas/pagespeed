---
type: component
workstream: "[[ws-eds]]"
---

# Component: EDS Accessibility (AQA)

> Part of [[ws-eds]] | ACE2E counterpart: [[ws-privacy-compliance]] | See also: [[source-jira-acaqa]] (ACAQA project — original AQA audit, issues migrated here)

## Scope

Automated Quality Assurance (AQA) accessibility issues identified across EDS pages. Includes UsableNet script integration.

### Infrastructure
- **UsableNet Script** ([[ACEDS-328 - Add the UsableNet Script (Accessibility Status) to EDS Pages|ACEDS-328]]) — Konstantin Minevich, Closed — adds accessibility status monitoring to EDS pages

### Closed AQA Fixes
- [[ACEDS-316 - AQA Issue - The form control does not have an accessible name due to a hidden -label- element|ACEDS-316]] — Form control without accessible name (hidden label)
- [[ACEDS-318 - AQA Issue - The accessible name of the link with an image cannot be programmatically determined|ACEDS-318]] — Link with image, accessible name not determinable
- [[ACEDS-377 - AQA Issue - Elements without a background specified  (PLP Category )|ACEDS-377]] — Elements without background specified (PLP Category)
- [[ACEDS-392 - AQA Issue - The -svg- element does not have alternative text (PLP (Search and Autocomplete))|ACEDS-392]], 407, 409, 425, 471, 484, 486, 509, 517, 519, 524 — SVG alt text issues (various pages)

### ESI (Edge Side Include) AQA Fixes in Pipeline
- [[ACEDS-511 - AQA Issue - ESI - The -svg- element does not have alternative text (PLP (Search and Autocomplete))|ACEDS-511]] — SVG alt text (PLP Search/Autocomplete) — `Deployment - PPE`
- [[ACEDS-515 - AQA Issue - ESI - The -svg- element does not have alternative text (PLP Category )|ACEDS-515]] — SVG alt text (PLP Category) — `Deployment - PPE`

## Active / Groomed AQA Items

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACEDS-511 - AQA Issue - ESI - The -svg- element does not have alternative text (PLP (Search and Autocomplete))\|ACEDS-511]] | ESI - SVG alt text (PLP Search/Autocomplete) | Deployment - PPE | Calvin Liu |
| [[ACEDS-515 - AQA Issue - ESI - The -svg- element does not have alternative text (PLP Category )\|ACEDS-515]] | ESI - SVG alt text (PLP Category) | Deployment - PPE | Calvin Liu |
| [[ACEDS-565 - AQA Issue - Certain Footer Drawers Not Operable via Keyboard (Homepage - Mobile)\|ACEDS-565]] | Footer drawers not operable via keyboard (Mobile) | Evaluated | Unassigned |
| [[ACEDS-568 - AQA Issue - Label Arrow Elements Properly (Homepage - Mobile)\|ACEDS-568]] | Label arrow elements properly (Homepage Mobile) | Evaluated | George Djaniants |
| [[ACEDS-488 - AQA Issue - The -svg- element does not have alternative text (PLP (Search and Autocomplete))\|ACEDS-488]] | SVG alt text (PLP Search/Autocomplete) | Groomed | Unassigned |
| [[ACEDS-490 - AQA Issue - The order of headings is not correct (PLP (Search and Autocomplete))\|ACEDS-490]] | Heading order incorrect (PLP Search/Autocomplete) | Groomed | Unassigned |
| [[ACEDS-492 - AQA Issue - The accessible name of the link cannot be programmatically determined\|ACEDS-492]] | Link accessible name not determinable | Groomed | Unassigned |
| [[ACEDS-494 - AQA Issue - The accessible name of the link with an image cannot be programmatically determined\|ACEDS-494]] | Link with image accessible name not determinable | Groomed | Unassigned |
| [[ACEDS-496 - AQA Issue - An empty link with an image is without a text alternative (PLP (Search and Autocomplete) - Mobile)\|ACEDS-496]] | Empty link with image, no text alternative (Mobile) | Groomed | Unassigned |
| [[ACEDS-498 - AQA Issue - Empty link (PLP (Search and Autocomplete) - Mobile)\|ACEDS-498]] | Empty link (PLP Search/Autocomplete Mobile) | Groomed | Unassigned |
| [[ACEDS-500 - AQA Issue - The accessible name of the link cannot be programmatically determined (PLP (Search and Autocomplete) - Mobile)\|ACEDS-500]] | Link accessible name not determinable (Mobile) | Groomed | Unassigned |
| [[ACEDS-564 - AQA Issue - An empty link with an image is without a text alternative\|ACEDS-564]] | Empty link with image, no text alternative | Groomed | Unassigned |
| [[ACEDS-567 - AQA Issue - Read More Button On Homepage No Background Color Specified\|ACEDS-567]] | Read More button no background color (Homepage Mobile) | Groomed | Unassigned |
| [[ACEDS-569 - AQA Issue - The PLP Product image is missing the alt attribute\|ACEDS-569]] | PLP product image missing alt attribute | Groomed | Unassigned |

## Notes
- 14 AQA items are groomed but unassigned — significant backlog
- Most AQA issues are on PLP Search/Autocomplete pages, particularly SVG elements and link accessibility
- Mobile-specific issues ([[ACEDS-496 - AQA Issue - An empty link with an image is without a text alternative (PLP (Search and Autocomplete) - Mobile)|ACEDS-496]]–500, 565, 567, 568) are a distinct cluster
