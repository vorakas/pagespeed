---
type: workstream
epics: ["[[ACE2E-52 - AC E2E - Financial Calculators|ACE2E-52]]"]
status: not-started
task_count: 15
closed_count: 0
failed_qa_count: 0
groomed_count: 15
in_progress_count: 0
blocked_count: 0
---

# Workstream: Financial Calculators

## Description

This workstream covers pricing and financial calculation logic, including coupons, discounts, promotions, and tax calculations. These are core commerce functions that affect pricing display across PDP, cart, and checkout.

## Scope

- **[[ACE2E-52 - AC E2E - Financial Calculators|ACE2E-52]]: Financial Calculators** (Evaluated) — Coupon engine, discount rules, promotional pricing, tax calculation logic.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-210 - ROUND1- Ensure Tiered Coupon Module Compatibility\|ACE2E-210]] | Coupons (task 1) | Groomed | Unassigned |
| [[ACE2E-211 - ROUND1- Update to the Coupon Modal Templates\|ACE2E-211]] | Coupons (task 2) | Groomed | Unassigned |
| [[ACE2E-212 - ROUND1- Add Promotions Checkout Warning Messages\|ACE2E-212]] | Coupons (task 3) | Groomed | Unassigned |
| [[ACE2E-213 - ROUND1- Coupon logic and storefront display\|ACE2E-213]] | Discounts (task 1) | Groomed | Unassigned |
| [[ACE2E-214 - ROUND1- Discounting Rules - Cart Price Rules Validation Logic\|ACE2E-214]] | Discounts (task 2) | Groomed | Unassigned |
| [[ACE2E-215 - ROUND1- Discounting Rules - Employee Discount Logic\|ACE2E-215]] | Discounts (task 3) | Groomed | Unassigned |
| [[ACE2E-216 - ROUND1- Item Line Level Tax\|ACE2E-216]] | Promotions (task 1) | Groomed | Unassigned |
| [[ACE2E-217 - ROUND1- Update Auto-add - Manual Coupon Configurations\|ACE2E-217]] | Promotions (task 2) | Groomed | Unassigned |
| [ACE2E-218](../raw/ACE2E/Task/ACE2E-218%20-%20ROUND1-%20%5BPrivate%20Link%5D%20Vendor%20Data%20Integration%20and%20Turning%20off%20MPR.md) | Promotions (task 3) | Groomed | Unassigned |
| [[ACE2E-219 - ROUND1- Employee Max Discount Approval Enhancement\|ACE2E-219]] | Promotions (task 4) | Groomed | Unassigned |
| [ACE2E-220](../raw/ACE2E/Task/ACE2E-220%20-%20ROUND1-%20%5BPrivate%20Link%5D%20Vendor%20Catalog%20Data%20Integration.md) | Tax (task 1) | Groomed | Unassigned |
| [[ACE2E-221 - ROUND1- Minimum Price Validation Support\|ACE2E-221]] | Tax (task 2) | Groomed | Unassigned |
| [[ACE2E-222 - ROUND1- Auto-add Coupon Customization and Modal\|ACE2E-222]] | Tax (task 3) | Groomed | Unassigned |
| [[ACE2E-223 - ROUND1- Promotions T&C Customization\|ACE2E-223]] | Financial calc (task 1) | Groomed | Unassigned |
| [[ACE2E-224 - ROUND1- Tax Exempt Checkbox for Pro Sessions with a Tax Exempt Certificate\|ACE2E-224]] | Financial calc (task 2) | Groomed | Unassigned |

### Status Summary

- Groomed: 15

## Bugs

No bugs associated with this workstream.

## Dependencies

- [[ws-pdp]] — Price display and promotional pricing on PDP.
- [[ws-cart]] — Coupon application and discount display in cart.
- [[ws-checkout]] — Tax calculation during checkout; final pricing.
- [[ws-gift-card]] — Gift card balance affects order total.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~30 tasks (Discounts, coupons, promotions, tax rules)
- Key: Promotion migration, tier discounts

## Cross-References

- Tax tasks also exist under [[ws-checkout]] (shipping tax calculations [[ACE2E-232 - ROUND1- Avalara Extension Support for Resale Certs|ACE2E-232]], [ACE2E-233](../raw/ACE2E/Task/ACE2E-233%20-%20ROUND1-%20%5BParent%5D%20Custom%20Shipping%20Method%20and%20%5BPrivate%20Link%5D%20Freight%20Charges%20Integration.md)).
- QA test cycle tasks for Financial Calculators may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
