---
type: component
workstream: "[[ws-eds]]"
---

# Component: EDS PLP & Search

> Part of [[ws-eds]] | ACE2E counterpart: [[ws-plp]]

## Scope

The PLP (Product Listing Page) is the most task-heavy area of ACEDS. Covers search results pages, sort/category pages, and all their interactive elements.

### Features Implemented
- **Page title & breadcrumbs** ([[ACEDS-2 - PLP Page Title & Breadcrumb|ACEDS-2]]) — title, breadcrumb trail, "+Show More" links
- **Pagination & result count** ([[ACEDS-6 - PLP Pagination and Result Number Display|ACEDS-6]]) — page numbering, result display
- **Facets & filters** ([[ACEDS-13 - PLP Updated Facet Display &  Logic|ACEDS-13]], [[ACEDS-32 - PLP Updated Facet Display & URL|ACEDS-32]]) — facet display, URL-based filtering, multi-select, price range masking ([[ACEDS-330 - Support Input Masking For Custom Price Range Filter|ACEDS-330]])
- **Search bar & autocomplete** ([[ACEDS-61 - Style Search Bar & Auto Complete - Issue 1|ACEDS-61]]–66) — styling, max results config, 5 issues addressed
- **Search suggestions box** ([[ACEDS-292 - Implement Recent Searched Terms In Search Box (Part 1)|ACEDS-292]]–296, [[ACEDS-320 - Implement Recent Searched Terms In Search Box (Part 2)|ACEDS-320]]) — recently searched terms, category-specific popular terms, recently viewed products
- **Product cards** ([[ACEDS-293 - Product Card Improvements|ACEDS-293]]) — card improvements, image sizing ([[ACEDS-280 - Product Images Appear Smaller on Adobe Commerce PLP Compared to Legacy LP Site|ACEDS-280]]), review ratings ([[ACEDS-27 - Add Review Ratings to PLP Product Results|ACEDS-27]])
- **Product badges** ([[ACEDS-143 - Show `X Left` or `Sold Out` product card badge on PLP for Open Box-Clearance|ACEDS-143]]) — "X Left" / "Sold Out" for Open Box/Clearance
- **PLP schema updates** ([[ACEDS-8 - PLP Schema Updates|ACEDS-8]]) — structured data for search engines
- **PLP perceived page load** ([[ACEDS-203 - PLP Perceived Page Load|ACEDS-203]]) — performance optimization
- **"Looking for Something Specific"** ([[ACEDS-28 - -Looking for something specific- on a Multi-Select Category PLP|ACEDS-28]]) — multi-select category PLP section
- **Style search results page** ([[ACEDS-60 - Style Search Results Page|ACEDS-60]]) — full styling of results layout
- **Sticky search bar** ([[ACEDS-313 - Sticky Search Bar Discrepancy between LP Site and Adobe Commerce Site|ACEDS-313]]) — parity with legacy LP site
- **Store/kiosk location filter** ([[ACEDS-11 - PLP -Available at this Location- Filter for Stores-Kiosks|ACEDS-11]]) — "Available at this Location" filter
- **App Builder integration** ([[ACEDS-303 - Integrate EDS With App Builder Suggest API End Point|ACEDS-303]], [[ACEDS-355 - Update EDS To Support New Search Response Object From App Builder|ACEDS-355]]) — suggest API, new search response object
- **ID-based URLs** ([[ACEDS-276 - ID Based URLs Not Loading with 4 Plus Selections|ACEDS-276]]) — support for 4+ filter selections
- **No search results page** ([[ACEDS-527 - Update the No Search Results page to have a smaller font size|ACEDS-527]]) — smaller font size update
- **Filter/Sort button style** ([[ACEDS-554 - Update Filter and Sort By Button Style|ACEDS-554]]) — `Approved Code Review`

### Key Bug Fixes (Closed)
- [[ACEDS-111 - Search Term Does Not Persists in The Search Bar|ACEDS-111]] — Search term not persisting in search bar
- [[ACEDS-263 - Search Term Is Removed From the Search Bar After an Apostrophe Character|ACEDS-263]] — Search term removed after apostrophe
- [[ACEDS-276 - ID Based URLs Not Loading with 4 Plus Selections|ACEDS-276]] — ID-based URLs not loading with 4+ selections
- [[ACEDS-278 - Sale Callout is Not Displayed on Pricing Block of Sale Grouping SKUs|ACEDS-278]] — Sale callout missing on pricing block
- [[ACEDS-280 - Product Images Appear Smaller on Adobe Commerce PLP Compared to Legacy LP Site|ACEDS-280]] — Product images smaller than legacy site
- [[ACEDS-369 - Filter Doesn't Apply When Min and Max Values Are Identical|ACEDS-369]] — Filter not applying when min/max identical
- [[ACEDS-402 - Your Recent Searches Not Showing on Search Page|ACEDS-402]] — Recent searches not showing
- [[ACEDS-404 - Category Filter Displays -Missing meta for option- and Shows Red Error Border|ACEDS-404]] — "Missing meta for option" error in category filter
- [[ACEDS-405 - Searching for the Same Term Twice Returns Error|ACEDS-405]] — Searching same term twice returns error
- [[ACEDS-429 - -+Show More - -Show Less- Link Incorrectly Displayed in Breadcrumb Filter Section on PLP for Small Viewport|ACEDS-429]] — Show More/Less link display issue on small viewport
- [[ACEDS-463 - Category PLPs - Multiple UIA calls are firing|ACEDS-463]] — Multiple UIA calls firing on category PLPs

## Active Items

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACEDS-572 - Research Root Cause Of Issue Where First Load Of PLP intermittently Does Not Load\|ACEDS-572]] | Root cause: first load of PLP intermittently fails | In Progress | Alex Tadevosyan |
| [[ACEDS-554 - Update Filter and Sort By Button Style\|ACEDS-554]] | Update Filter and Sort By Button Style | Approved Code Review | Akim Malkov |
| [[ACEDS-552 - Update Stars On PLP (Product Tile and Customer Rating Filter) To Gold Stars\|ACEDS-552]] | Update PLP stars to gold | Deployment - PPE | Akim Malkov |
| [[ACEDS-395 - Set up meta data for the PLP\|ACEDS-395]] | Set up meta data for the PLP | QA on PPE | Alex Tadevosyan |
| [[ACEDS-522 - Extra Spaces are Not Stripped  to Single Space on the Search Box\|ACEDS-522]] | Extra spaces not stripped in search box | Stakeholder Test | Alex Tadevosyan |
| [[ACEDS-570 - Count of Products Not Displaying Next to Filter Options Under -Specials- Filter Menu\|ACEDS-570]] | Product count not displaying next to Specials filter | Open | Unassigned |
| [[ACEDS-582 - Searching For A Term From Recently Searched Drop Down  Containing Quotes (-) Strips Off In Characters\|ACEDS-582]] | Recently searched term with quotes strips characters | Groomed | Naga Ambarish Chigurala |
| [[ACEDS-553 - Update the star colors on the -more-like-this- page\|ACEDS-553]] | Update star colors on more-like-this page | Groomed | George Djaniants |

## Notable Cancelled Bugs

61 bugs were cancelled — most from early EDS development when the PLP was unstable. Key patterns:
- Sort page issues ([[ACEDS-156 - Sort Button is NOT Displaying on The Search Sort Page|ACEDS-156]], 157, 184, 189, 257) — resolved by architecture changes
- Breadcrumb/PDP issues ([[ACEDS-160 - Breadcrumbs Not Displaying Properly on PDP Page|ACEDS-160]], 162, 173) — moved to commerce-side handling
- Price/sale filter display ([[ACEDS-180 - Price Filter Appears Twice on Search and Sort Pages|ACEDS-180]], 202, 208, 225, 226) — resolved upstream
