# Calculator KB Seed: Minimum Pricing Flow

## Source Comparison

Sources reviewed:

- `C:\Users\AdamB\Downloads\AC Minimum Pricing Logic v3.json`
- `C:\Users\AdamB\Downloads\AC Minimum Pricing Logic v3.vsdx`

Best source for text and graph extraction: Lucid JSON.

- JSON parsed successfully.
- JSON contains 40 shapes and 44 connector lines.
- JSON yielded 39 text-bearing shape nodes and 42 connector edges.
- JSON includes readable decision labels, outcome labels, and connector labels.

Best source for visual/layout validation: VSDX.

- VSDX parsed as a valid zip package.
- VSDX contains 1 page, 120 shapes, and 77 shapes with text.
- VSDX did not expose connector relationships in the same simple way as the JSON export.

Recommendation:

- Use JSON as the primary machine-readable diagram source.
- Use VSDX and PDF/SVG visual exports as fallback validation sources.

## Domain

This flow defines how Adobe Commerce should classify cart line discount behavior when minimum pricing, vendor restrictions, UMRP, manual employee discounting, professional cart discounting, and promo-code discounting interact.

The diagram separates logic into:

- Discount Rules for Consumer Carts.
- Discount Rules for Professional Carts.
- Cart-level discounting.
- Line-level discounting.

## Important Input Fields

Product data:

- UMRP value.

Vendor data:

- `DiscountRequirement`
- `OnlineDiscountRequirement`
- `QuantityRestriction`
- `OnlineQuantityRestriction`
- `InternetDiscounting`
- `StoreDiscount`
- `OnlineCoupon`

Runtime/cart context:

- Cart type: consumer or professional.
- Channel: online or kiosk/store.
- Whether cart-level system is enabled.
- Whether employee manual discount was entered.
- Whether employee performs vendor approval.
- Whether qualified promo code was entered.
- Whether promo code bypasses minimum pricing restrictions.
- Whether cart quantity meets vendor quantity restriction.

## High-Level Rules

If a SKU does not have a UMRP value in Product Data, the line is not minimum-price restricted and remains discountable.

If a SKU has a UMRP value, the flow evaluates vendor restriction fields before deciding whether employee discount, promo discount, pro discount, or no discount can apply.

Vendor approval can move a line from restricted behavior into quantity-restriction evaluation, but only when the employee performs vendor approval.

Quantity restrictions can make otherwise restricted products discountable when the cart contains at least the required quantity from the line-item vendor.

A qualified promo code can bypass minimum pricing restrictions in some paths.

Employee manual discounts may be allowed, restricted to UMRP, or blocked depending on cart type, channel, and vendor fields.

## Professional Cart Flow

Professional cart line-level discounting starts by checking whether the SKU has a UMRP value.

If no UMRP exists:

- Outcome: Not Minimum Price Restricted / Discountable.
- Discount precedence includes employee manual discount, qualified promo discount, and pro discount.

If UMRP exists:

- Check `DiscountRequirement`.

`DiscountRequirement = 0 (No Discounting)`:

- Continue to qualified promo code bypass check.

`DiscountRequirement = 1 (Discounting)`:

- Continue to `QuantityRestriction`.

`DiscountRequirement = 2 (Vendor Approval Required)`:

- Check whether employee performs vendor approval.
- If yes, continue to `QuantityRestriction`.
- If no, continue to qualified promo code bypass check.

Quantity restriction handling:

- `QuantityRestriction = 1 (No Minimum Quantity)` continues through line-level discount evaluation.
- `QuantityRestriction > 1` requires checking whether the cart has at least that quantity of products from the line-item vendor.
- If quantity requirement is met, the line may become not minimum-price restricted / discountable.
- If quantity requirement is not met, continue to promo-code evaluation.

Professional restricted outcome:

- Minimum Price Restricted / Discountable.
- Employee manual discount may apply no further than UMRP.
- Promo discount and pro discount may apply down to UMRP.

## Consumer Cart Flow

Consumer cart line-level discounting starts by checking whether the SKU has a UMRP value.

If no UMRP exists:

- Outcome: Not Minimum Price Restricted / Discountable.
- Discount precedence includes employee manual discount and qualified promo discount.

If UMRP exists:

- Check `OnlineDiscountRequirement`.

`OnlineDiscountRequirement = 0 (No Discounting)`:

- Continue to qualified promo code bypass check.

`OnlineDiscountRequirement = 1 (Discounting)`:

- Continue to `OnlineQuantityRestriction`.

`OnlineDiscountRequirement = 2 (Vendor Approval Required)`:

- Check whether employee performs vendor approval.
- If yes, continue to quantity restriction evaluation.
- If no, continue to qualified promo code bypass check.

Consumer quantity restriction handling:

- `OnlineQuantityRestriction = 1 (No Minimum Quantity)` continues to channel-specific manual discount evaluation.
- `OnlineQuantityRestriction > 1` requires checking whether the cart has at least that quantity of products from the line-item vendor.
- If quantity requirement is met, the line may become not minimum-price restricted / discountable.
- If quantity requirement is not met, continue to promo-code evaluation.

Channel-specific manual discount checks:

- Online path checks employee manual discount plus vendor `InternetDiscounting`.
- Store/kiosk path checks employee manual discount plus vendor `StoreDiscount`.
- If the employee manual discount condition passes, outcome is Manual Discountable by employee manual discount.
- If it does not pass, continue to promo-code evaluation.

Promo-code check:

- Check whether promo code was entered and the vendor `OnlineCoupon` value permits it.
- If yes, outcome can be Partially Price Restricted / Discountable.
- If no, continue to qualified promo-code bypass evaluation.

## Outcome Labels

Not Minimum Price Restricted / Discountable:

- Line-level discountable.
- Discount precedence may include employee manual discount, qualified promo code discount, and professional discount depending on cart type.

Minimum Price Restricted / Discountable:

- Discounting can apply only down to UMRP.
- Employee manual discount cannot go below UMRP.
- Promo/pro discount paths can be capped at UMRP.

Partially Price Restricted / Discountable:

- Discounting allowed, but minimum pricing rules still constrain part of the path.
- Diagram ties this to promo-code paths.

Manual Discount Price Restricted:

- Employee manual discount may apply, but no further than UMRP.

Manual Discountable:

- Employee manual discount can apply line-level.

Promo Code Discountable:

- Promo code discount can apply line-level.

## Diagram Changes Noted

The diagram includes a note that highlighted items indicate differences from the previous version.

It also notes removal of logic specific to the Member Special Price SKU.

## Source Tasks To Link In Calculator KB

Use this flow with these previously identified requirement sources:

- Asana `LAMPSPLUS-445` Minimum Price Validation Support.
- Jira `ACE2E-221` ROUND1: Minimum Price Validation Support.
- Jira `DBADMIN-6393` Update the AC Product Pricing Table - Part 6 (Special Flag).
- Jira `DBADMIN-6395` Update the AC Product Pricing Table - Part 5b (Minimum Price Issues and Vendor Restrictions).
- Jira `DBADMIN-6389` Update the AC Product Pricing Table - Part 5a (Minimum Price Issues and Vendor Restrictions).
- Jira `DBADMIN-6662` Update the logic for populating the minimum price.
- Asana `LAMPSPLUS-492` Vendor Data Integration and Turning off MPR.
- Asana `LAMPSPLUS-458` Employee Max Discount Approval Enhancement.
- Asana `LAMPSPLUS-238` Promotions T&C Customization.

## KB Caveats

This file is a seed knowledge artifact, not the final application index.

The Lucid JSON exposes connector direction and labels, but this document still summarizes the flow into readable rules. During Pharos ingestion, preserve exact source chunks and connector edges separately so answers can cite the source path and source node.

