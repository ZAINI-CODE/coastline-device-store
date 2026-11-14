# Storefront corrections — November 14, 2026

Public site: https://coastline-device.netlify.app/
Final Netlify deployment: 6af7d34fc4869be50057e873.

## Applied
- Google site verification meta is present in the public home page; HTML verification file also returns HTTP 200 with the correct content. Search Console verification itself has not been clicked.
- Public category navigation now has four current collections. Gaming Controllers and Processors and CPUs are omitted. Historical private catalogue drafts remain intact.
- Checkout shows Standard — Free and Fast delivery — $25.00, backed by 50 approved US state rules per method. Existing standard rules were preserved.
- Added required order contact number, required 50-state select, US country select and ZIP validation. Apartment/unit can be included in street address.
- Applied migration 027_checkout_shipping_contact.sql through Supabase SQL Editor: Success. No rows returned. Public read-only audit: 100 approved rules, 50 free standard and 50 fast at 2500 cents. No order, product, price or inventory records modified.
- Required phone enforced on new orders through existing order address trigger function. Existing orders untouched. No RLS changes.
- Checkout action is Continue to payment; removed reservation explanatory text beneath it. Safe inventory reservations remain active internally.
- Added 20x20 multicolour Google icon. Wait for SDK session restoration before account render; validated local return routes and corrected signed-in account-link navigation.
- Zelle remains enabled; PayPal and cards remain disabled.

## Tests
- 36/36 frontend regression tests passed after updating the historical test's obsolete six-category navigation expectation.
- 2/2 new isolated checkout tests passed: 50 states, correct methods/prices, safe returns, migration repeatability, required phone validation, preservation of old orders.
- Existing Zelle isolated database workflow and screenshot validation tests passed.
- Live checkout: exactly two shipping options, 50 state options, mandatory shipping/payment inputs. Alaska fast delivery selectable; correct rule ID assigned. Empty submission blocked at full name; no order created.
- Mobile 390x844: checkout remained within viewport; same state/method options. Screenshot: .private/netlify-launch-2026-11-14/checkout-mobile.png.
- Live Google authorization reached account chooser and requested owner's passkey. Fresh callback and destination restoration require owner to complete that passkey challenge; not claimed passed.
- No real payments or bank verification performed.

## Pending
- Owner completes Google passkey sign-in, then verify callback returns to checkout and session persists.
- Click Verify in Google Search Console. Indexing remains under existing noindex configuration; ownership verification does not itself enable indexing.

## Changed source files
index.html and google8e2f4d9e478d7709.html (verification prepared before resumed work); scripts/build.mjs includes verification HTML.
config/store.json; js/api.js; js/review-navigation.js; js/checkout-addresses.js; js/app.js; js/customer.js; js/storefront-ui.js; css/final-polish.css.
supabase/migrations/027_checkout_shipping_contact.sql; tests/checkout-shipping.test.mjs; tests/frontend-review.test.mjs.
Build output and private deployment package regenerated.
