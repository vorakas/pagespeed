---
type: component
workstream: "[[ws-eds]]"
---

# Component: EDS Header & Navigation

> Part of [[ws-eds]] | ACE2E counterpart: [[ws-homepage-navigation]]

## Scope

EDS header, sticky header behavior, sign-in state, hamburger menu, top navigation, and mega menu.

### Features Implemented
- **Header issues 1–5** ([[ACEDS-72 - EDS - Header - Issue 1|ACEDS-72]]–76) — various header fixes; Issues 1, 3, 4 cancelled; Issue 2 (mobile scroll) and Issue 5 (sticky transition) closed
- **EDS Header Refresh for MVP** ([[ACEDS-434 - EDS Header Refresh for MVP|ACEDS-434]]) — Glenn Vergara
- **Update global top navigation links** ([[ACEDS-279 - Update Global Top Navigation Links to Match LP .NET Site|ACEDS-279]]) — match legacy LP site
- **Dynamic Lighting Catalog banner in top nav** ([[ACEDS-371 - Implement Functionality for Dynamic Lighting Catalog Banner in Top Navigation (EDS)|ACEDS-371]]) — Glenn Vergara
- **Hamburger menu dropdown mobile** ([[ACEDS-364 - Add Missing Elements in the Hamburger Menu Dropdown on Mobile|ACEDS-364]]) — add missing elements
- **Hide search field for smaller desktops** ([[ACEDS-431 - Hide Search Field for Smaller Desktop Screens|ACEDS-431]]) — Alex Tadevosyan
- **Guest token & customer group headers** ([[ACEDS-432 - Update EDS to use header-based guest token and customer.customer_group|ACEDS-432]]) — EDS uses header-based auth
- **Sign-in state fixes** ([[ACEDS-447 - Sign-In Functionality State Is Broken In Header|ACEDS-447]], [[ACEDS-481 - Sign-In Functionality State Is Broken In Header (Part 2)|ACEDS-481]]) — header sign-in broken, fixed in two parts
- **Sign-in options clickability** ([[ACEDS-363 - Sign In Options in the Header are Not Clickable|ACEDS-363]]) — Konstantin Minevich
- **Bucket images in top nav** ([[ACEDS-58 - Bucket Images in the Top Navigation menu are not loading properly|ACEDS-58]]) — image loading fix

### Key Bugs Fixed
- [[ACEDS-308 - Sign Options Do Not get Closed After Clicking Search Icon|ACEDS-308]] — Sign options not closing after clicking search icon
- [[ACEDS-313 - Sticky Search Bar Discrepancy between LP Site and Adobe Commerce Site|ACEDS-313]] — Sticky search bar discrepancy vs legacy site
- [[ACEDS-241 - CONTACT US Link Displayed Twice in the Header|ACEDS-241]] — "CONTACT US" link displayed twice (cancelled — resolved differently)

## Active Items

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACEDS-557 - EDS Header- Secondary Navigation Intermittently Hidden on mcstaging2\|ACEDS-557]] | EDS Header: Secondary Navigation Intermittently Hidden on mcstaging2 | Deployment - PPE | Glenn Vergara |
| [[ACEDS-573 - Update global Org schema in the header\|ACEDS-573]] | Update global Org schema in the header | Evaluated | Unassigned |
