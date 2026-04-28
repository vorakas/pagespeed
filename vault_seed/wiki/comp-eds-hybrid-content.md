---
type: component
workstream: "[[ws-eds]]"
---

# Component: EDS Hybrid Content Migration

> Part of [[ws-eds]] | Epic: [[ACEDS-311 - AC Implementation - Hybrid Content Migration|ACEDS-311]] (Hybrid Content Migration)

## Scope

Migration of hybrid content (splash blocks on PLPs/sort pages) from the legacy `tblSearchSplashContent` database to DA.live. This involves building EDS components for each content type and then carrying over/transforming existing content.

### Content Types & Variations (from [[ACEDS-311 - AC Implementation - Hybrid Content Migration|ACEDS-311]])

1. **5 Image Buckets + Text** — Title, top right text, images with link titles
2. **Title + Text (No Images)** — Title, top right text only
3. **No Text + No Images** — Empty/minimal
4. **Banner with Buckets** — Banner with text, icons with link titles
5. **Buttons Only** — Title, pill buttons

### Build Phase (Components — All Closed)

| Component | Task | Status |
|-----------|------|--------|
| Image Bucket Columns | [[ACEDS-381 - Build Hybrid Content Component for Image Bucket Columns\|ACEDS-381]] | Closed (Glenn Vergara) |
| Pill Buttons | [[ACEDS-382 - Build Hybrid Content Component for Pill Buttons\|ACEDS-382]] | Closed (Oliver Syson) |
| Splash Banner | [[ACEDS-383 - Build Hybrid Content Component for Splash Banner\|ACEDS-383]] | Closed (George Djaniants) |
| Top Copy | [[ACEDS-384 - Build Hybrid Content Component for Top Copy\|ACEDS-384]] | Closed (Glenn Vergara) |
| Bottom Copy | [[ACEDS-453 - Build Hybrid Content Component for Bottom Copy\|ACEDS-453]] | Closed (George Djaniants) |
| Meta Title, Description, h1 | [[ACEDS-454 - Build Hybrid Content Components for Meta Title, Meta Description, and h1\|ACEDS-454]] | **Stakeholder Test** (George Djaniants) |
| LD JSON Schema | [[ACEDS-455 - Build Hybrid Content Components for LD JSON Schema\|ACEDS-455]] | **Deployment - PPE** (George Djaniants) |

### Carryover Phase (Transformation & Data Migration)

| Content Type | Task | Status |
|--------------|------|--------|
| Image Bucket Columns | [[ACEDS-456 - Transformation and Carryover for Hybrid Content Image Bucket Columns\|ACEDS-456]] | **QA on PPE In Progress** (Glenn Vergara) |
| Pill Buttons | [[ACEDS-457 - Carryover for Hybrid Content Pill Buttons\|ACEDS-457]] | Groomed (Unassigned) |
| Splash Banner | [[ACEDS-458 - Carryover for Hybrid Content Splash Banner\|ACEDS-458]] | Groomed (Unassigned) |
| Top Copy | [[ACEDS-459 - Transformation and Carryover for Hybrid Content Top Copy\|ACEDS-459]] | Groomed (Glenn Vergara) |
| Bottom Copy | [[ACEDS-460 - Transformation and Carryover for Hybrid Content Bottom Copy\|ACEDS-460]] | **On Hold** (George Djaniants) |
| Meta Title, Description, h1 | [[ACEDS-461 - Transformation and Carryover for Hybrid Content Meta Title, Description, and h1\|ACEDS-461]] | Groomed (Unassigned) |
| LD JSON Schema | [[ACEDS-462 - Transformation and Carryover for Hybrid Content LD JSON Schema\|ACEDS-462]] | Groomed (Unassigned) |

### Early Work
- **Color Plus hybrid content** ([[ACEDS-25 - Create EDS hybrid content block for Color Plus PLP|ACEDS-25]], 46, 47) — Tyler Marés, Closed — early PoC
- **Research: hybrid content blocks via aem.js** ([[ACEDS-45 - Research handling hybrid content blocks via aem.js|ACEDS-45]]) — Tyler Marés, Closed
- **Research: da.live API for splash content** ([[ACEDS-360 - Research da.live API for Splash Content Management|ACEDS-360]]) — Glenn Vergara, Closed
- **Research: da.live API for document creation & publishing** ([[ACEDS-361 - Research da.live API for Document Creation & Publishing|ACEDS-361]]) — Glenn Vergara, Closed

## Active Items

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACEDS-454 - Build Hybrid Content Components for Meta Title, Meta Description, and h1\|ACEDS-454]] | Build Hybrid Content Components for Meta Title/Desc/h1 | Stakeholder Test | George Djaniants |
| [[ACEDS-455 - Build Hybrid Content Components for LD JSON Schema\|ACEDS-455]] | Build Hybrid Content Components for LD JSON Schema | Deployment - PPE | George Djaniants |
| [[ACEDS-456 - Transformation and Carryover for Hybrid Content Image Bucket Columns\|ACEDS-456]] | Carryover for Image Bucket Columns | QA on PPE In Progress | Glenn Vergara |
| [[ACEDS-457 - Carryover for Hybrid Content Pill Buttons\|ACEDS-457]] | Carryover for Pill Buttons | Groomed | Unassigned |
| [[ACEDS-458 - Carryover for Hybrid Content Splash Banner\|ACEDS-458]] | Carryover for Splash Banner | Groomed | Unassigned |
| [[ACEDS-459 - Transformation and Carryover for Hybrid Content Top Copy\|ACEDS-459]] | Carryover for Top Copy | Groomed | Glenn Vergara |
| [[ACEDS-460 - Transformation and Carryover for Hybrid Content Bottom Copy\|ACEDS-460]] | Carryover for Bottom Copy | On Hold | George Djaniants |
| [[ACEDS-461 - Transformation and Carryover for Hybrid Content Meta Title, Description, and h1\|ACEDS-461]] | Carryover for Meta Title/Desc/h1 | Groomed | Unassigned |
| [[ACEDS-462 - Transformation and Carryover for Hybrid Content LD JSON Schema\|ACEDS-462]] | Carryover for LD JSON Schema | Groomed | Unassigned |
| [[ACEDS-446 - Sale Navigation Menu - Splash Images Linking to Old URLs Instead of New Updated URLs\|ACEDS-446]] | Sale Nav Menu splash images linking to old URLs | Stakeholder Test | Alex Tadevosyan |

## Key Decisions
- Meta title strips " | Lamps Plus" suffix — handled by Adobe Commerce and EDS (noted in [[ACEDS-311 - AC Implementation - Hybrid Content Migration|ACEDS-311]])
- Only the 5 image bucket variation is kept, but built to be flexible for 4–6 columns
- Analysis spreadsheet: Search Splash Content Analysis (SharePoint)
- DA.live sheet: `da.live/sheet#/lampsplus-ac/lp-da-eds/listing-page-blocks/product-listing-blocks`

## Risk
- **5 of 7 carryover tasks are Groomed but unassigned** — this is the main remaining work in the hybrid content migration
- Bottom Copy carryover ([[ACEDS-460 - Transformation and Carryover for Hybrid Content Bottom Copy|ACEDS-460]]) is **On Hold** — reason not stated in task
- The build phase is essentially complete; the migration/carryover phase is the bottleneck
