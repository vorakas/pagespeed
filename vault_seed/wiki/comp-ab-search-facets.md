---
type: component
workstream: "[[ws-app-builder]]"
---

# Component: App Builder Search, Facets & Pricing

> Part of [[ws-app-builder]] | Consumed by [[comp-eds-plp-search]]

## Scope

Core search and product listing API — transforms Bloomreach responses into the format EDS expects for PLP rendering.

### Features Implemented

- **Facet representation** ([[ACAB-7 - Incorrect Facets Representation on the PLPs|ACAB-7]]) — correct facet display on PLPs
- **Sort by options** ([[ACAB-2 - Search Results Page Displays Sort By Options|ACAB-2]], [[ACAB-6 - Sort By Section is Visible on Search Page|ACAB-6]]) — sort results display, sort by section handling
- **Filter deselection** ([[ACAB-3 - Unable To Deselect Applied Filter From Left Navigation|ACAB-3]]) — deselect applied filters from left nav
- **Filter dynamic updates** ([[ACAB-25 - Sort Results are Not Dynamically Updated upon Filter Selection|ACAB-25]]) — sort results update dynamically on filter selection
- **Sale/Clearance/Open Box sort pages** ([[ACAB-11 - No Results are Displayed on Sale-Clearance and Open Box Sort Pages|ACAB-11]], [[ACAB-49 - No Results are Displayed on Sale-Clearance and Open Box Sort Pages (Part 2)|ACAB-49]]) — results display for special sort pages
- **Sort by price** ([[ACAB-8 - Multiple Sort Pages Redirect To Undefined Page When Applying Sort By- Price Low|ACAB-8]]) — price low sort redirect fix
- **Drawer/dropdown sort** ([[ACAB-24 - Drawer-Dropdown is Missing when User Click on Sort By Option|ACAB-24]]) — sort by dropdown display
- **Pros Specials facet** ([[ACAB-37 - Pros Special Filter is Displayed for Non Professional User|ACAB-37]], [[ACAB-77 - Pros Specials Facet is Present on the Open Box And Sale Sort Page|ACAB-77]]) — pro-only filter visibility logic
- **Price filter** ([[ACAB-155 - Attribute Value Count Missing in Price Filter|ACAB-155]]) — attribute value counts in price filter
- **Custom price range** ([[ACAB-164 - Incorrect Results are Displayed Upon Applying Custom Price Range Facet|ACAB-164]], [[ACAB-183 - Single-Variant Grouped SKUs Shows Incorrect Products When Setting Custom Price Filters|ACAB-183]]) — custom price range facet results, grouped SKUs
- **Price sort for specials** ([[ACAB-224 - “Sort by- Low” Filter does not Display Special Category Products in Correct Ascending Price Order.|ACAB-224]]) — ascending price order for special category products
- **H1 tag updates** ([[ACAB-236 - H1 Tag Does Not Update After Applying Filters on Search Page|ACAB-236]], [[ACAB-250 - H1 Tag Not Updated with Custom Price Range Filter on PLP|ACAB-250]], [[ACAB-252 - H1 Tag Order Does Not Match Production on PLP|ACAB-252]]) — H1 updates on filter application, custom price range, canonical order
- **Coupon-eligible results** ([[ACAB-199 - Incorrect Results Displayed on Coupon-Eligible Page|ACAB-199]]) — correct coupon page results
- **Customer rating sort** ([[ACAB-67 - Results are not Sorted Correctly when Filtered by Customer Rating|ACAB-67]], [[ACAB-78 - Mismatch In Order of Attribute Values In Customer Ratings Attribute Group on Sort and Search Page|ACAB-78]]) — rating filter order and sort correctness
- **Not Foo search page** ([[ACAB-60 - Search Term -Not Foo- Missing from Breadcrumb Causing Inconsistency|ACAB-60]], [[ACAB-179 - (No Code Change)Filters Showing on the Not Foo Page Are Not Matching with the Response|ACAB-179]]) — breadcrumb and filter display for "not foo" searches
- **Invalid PLP URLs** ([[ACAB-142 - Return Empty Result For Invalid PLP URL|ACAB-142]]) — return empty result for invalid URLs
- **Duplicate URL segments** ([[ACAB-201 - URL Containing Duplicate URL Segments Behaves Incorrectly|ACAB-201]]) — handle URLs with duplicate segments
- **Voltage filter** ([[ACAB-202 - Selecting Any Option From Voltage Filter 404 Error|ACAB-202]]) — fix 404 error on voltage filter selection
- **Breadcrumb/filter canonical order** ([[ACAB-308 - PLP Breadcrumbs and Active Filters Not Following Canonical Order|ACAB-308]]) — breadcrumbs and active filters follow canonical order
- **Invalid segment handling** ([[ACAB-309 - URLs Containing Invalid -s- Segment Do Not Return Zero Results|ACAB-309]]) — URLs with invalid "s" segment return zero results
- **Employee login PLP fix** ([[ACAB-310 - PLP Pages Redirecting to 404 Page When Logged In As Employee|ACAB-310]]) — PLPs loading when logged in as employee
- **Pro Specials / Open Box filter** ([[ACAB-312 - -Open Box- Option Incorrectly Displayed Under Sales Filter on Pro Specials PLP and Returns Error on Click|ACAB-312]]) — Open Box option under Sales filter on Pro Specials PLP
- **Open Box callout** ([[ACAB-335 - Open Box Callout Not Displayed on Sort Page After Applying Open Box Filter|ACAB-335]]) — callout display after applying Open Box filter
- **Bloomreach field list update** ([[ACAB-233 - Update Bloomreach Field List and Response|ACAB-233]]) — update field list and response format
- **PDP URL, image, price range fields** ([[ACAB-243 - Update PDP URL, Product Image URL, Price Range, and Price fields|ACAB-243]]) — update product data fields
- **Promotion discount flag** ([[ACAB-229 - PLP - Promotion Discount Flag|ACAB-229]]) — PLP promotion flags
- **Refactor attribute metadata** ([[ACAB-279 - Refactor getAttributeMetaData and fetchAttributeMetaData|ACAB-279]]) — `getAttributeMetaData` and `fetchAttributeMetaData` refactor
- **Save callout** ([[ACAB-241 - Save Callout and Saving Amount Missing for Some Special Price Products on PLP|ACAB-241]]) — save callout and saving amount for special price products
- **Search URI fixes** ([[ACAB-43 - SearchURI Request ID Contains Unexpected br_ Prefix on Adobe Commerce Sort Page|ACAB-43]], [[ACAB-45 - URL Parameter-Refer URL-User Agent Are Incorrect in API Request To Bloomreach|ACAB-45]], [[ACAB-90 - Unable to Fetch Search Uri for Adobe Commerce Site|ACAB-90]]) — request ID prefix, URL parameters, refer URL

### Key Bugs Fixed
- [[ACAB-5 - Filter Selection Displays Incorrect or Zero Product Counts For (Casing Issue)|ACAB-5]] — Filter selection showing incorrect/zero product counts (casing issue)
- [[ACAB-71 - Facet is Displayed with No Values on Sort Pages|ACAB-71]] — Facet displayed with no values on sort pages
- [[ACAB-99 - Multiple Price Range Facets Show On PLP|ACAB-99]] — Multiple price range facets showing on PLP
- [[ACAB-132 - Product Count Not Recalculating After Removing-Adding Filters in Different Groups|ACAB-132]] — Product count not recalculating after removing/adding filters
- [[ACAB-177 - “Under $25” and “$2000 and up” Display Incorrect Product Results|ACAB-177]] — "Under $25" and "$2000 and up" showing incorrect results
- [[ACAB-284 - AppBuilder Search Request Returns Invalid Facet Data|ACAB-284]] — AppBuilder search request returning invalid facet data

## Active Items

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACAB-331 - Applying All Filters under Specials Returns 404 Page\|ACAB-331]] | Applying All Filters under Specials Returns 404 | Deployment - PPE | Naga Ambarish Chigurala |
| [[ACAB-134 - Special Callouts is Not Displaying on The Sort Page\|ACAB-134]] | Special Callouts Not Displaying on Sort Page | Stakeholder Test | Naga Ambarish Chigurala |
| [[ACAB-325 - Component SKU Search Redirects to PDP Instead of Sort Page\|ACAB-325]] | Component SKU Search Redirects to PDP Instead of Sort Page | Stakeholder Test | Naga Ambarish Chigurala |
| [[ACAB-343 - Make VIP Attribute Data Available at the Product Level on PLPs\|ACAB-343]] | Make VIP Attribute Data Available at Product Level on PLPs | Open | Unassigned |
| [[ACAB-340 - AC- URLs With Multiple Categories Are Not Loading\|ACAB-340]] | URLs With Multiple Categories Are Not Loading | Groomed | Unassigned |
| [[ACAB-16 - PLP Ads (included in listing)\|ACAB-16]] | PLP Ads (included in listing) | Open | Unassigned |

## Notable Cancelled Bugs

78 bugs cancelled — early integration instability. Key patterns:
- Room scene / Shop By Room issues ([[ACAB-144 - Room Inspiration Category Links Redirect to LP Legacy Site Instead of Staying on the AC Site|ACAB-144]]–152) — dropped from scope
- Price/count mismatches ([[ACAB-70 - Number of Result Count Differs Between Adobe and LP Site|ACAB-70]], 72, 74, 76, 79) — resolved by field list updates
- URL/redirect issues ([[ACAB-42 - Parameters Missing From Search URI on Adobe Site|ACAB-42]], 44, 46, 64, 65) — resolved by canonical URL work
- Sort page display issues ([[ACAB-63 - Vertical Scrollbar is Not Working on Facet Filters on Sort Pages|ACAB-63]], 80, 83, 85, 89, 91) — resolved by EDS-side fixes
