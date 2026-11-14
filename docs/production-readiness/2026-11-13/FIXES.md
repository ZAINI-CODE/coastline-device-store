# Coastline Device implementation results

**Latest launch rollout:** migrations 024–026 and the updated store-api/order-email functions are now installed/deployed. Test mode is configured, but actual provider credentials and inbox/payment testing remain blocked. The owner clarified that the custom domain is not purchased. See [current launch setup](../../integration/LAUNCH-SETUP-2026-11-13.md) before following the historical findings below.

**Later update:** The owner subsequently confirmed the remaining product details and changed Max 2 stock to five per colour. Those three product-readiness blockers are resolved; see [PRODUCT-COMPLETION.md](PRODUCT-COMPLETION.md). The findings below retain the earlier point-in-time results. Other launch blockers remain open.

13 November 2026. **Not ready to accept real customer orders.** Safe local changes are implemented; hosted email/security migrations and function deployment remain pending approval and configuration. The only hosted data change was the owner's separately confirmed correction to two inventory rows, described below. No products/reviews/customers were added or removed; no prices, other inventory, policies, authentication, DNS, hosting or payment settings were changed. No payment, refund or hosted order was created.

## 1. Email functionality — FIXED AND VERIFIED locally; NOT VERIFIED for real delivery

`supabase/functions/_shared/order-email.ts` provides branded HTML/plain-text order receipt, paid confirmation, preparation, dispatch, delivered, cancellation and refund-status templates. Emails contain the order UUID, product names/configurations/quantities, line prices/savings, order total, address and carrier/tracking where relevant. Pending receipt never claims payment arrived. Shipping/preparation/delivered queue events require paid status.

`024_order_email_delivery.sql` creates/extends the private outbox, event trigger and service-only claim function. Queue insertion is transactional with order changes; payload freezes after the order transaction commits. Unique event keys, database row locks, ten-minute leases and stable provider idempotency keys protect retries. Eight attempts / 23 hours is the automatic retry boundary; exhausted/uncertain jobs require provider reconciliation, not blind resend. Existing customer/order data is not backfilled.

Tests verified escaping, shipping content requirements, provider failure then retry, acknowledgement failure after provider acceptance, stable body/key, safe error logging, private worker authorization and no order mutation by delivery code. Provider calls were mocked; no real email was sent. This is not an inbox-deliverability or deployed-runtime certification.

## 2. Email credentials and external setup — CONFIGURATION REQUIRED

Provider: Resend. Required: verified `coastlinedevice.com` sending domain, private API key, private worker secret and trusted scheduler. Supabase Auth custom SMTP was observed disabled. Existing email registration/reset handlers already call Supabase Auth with local return routes; branded confirmation/reset templates are prepared locally. SMTP, hosted Auth templates, temporary-host Site URL/allowlist and production API origin still need configuration and fresh live callback/delivery tests.

See `docs/integration/EMAIL-AND-SEO-SETUP.md` for exact settings, deployment sequence, monitoring and rollback. Do not put credentials in the frontend or send them in chat.

## 3. Exact product information — USER INFORMATION REQUIRED

Fresh read-only SQL inspected the underlying product, variant and inventory records, rather than interpreting masked public fields as missing database prices. All three products have descriptions and approved, verified local image assignments. Existing internal STORE SKUs are present; this is not verification of manufacturer part numbers.

- **Apple AirPods 5** (`26408392-8c5e-8406-8878-419fa9f8d361`): stored price $129 and White finish. Actual variant configuration is `Charging case option pending`; product specifications also say charging case/exact SKU pending. Owner confirmed $129 and five available units during this task. Five units are now recorded, nonprovisional. The public projection still hides price/configuration because the variant is inactive/demo. Need the actual case configuration and any manufacturer identity correction. Do not treat the pending text as an actual case type.
- **Apple AirPods Max 2** (`32a6c65f-f173-4157-b2c2-231078c057d9`): Blue, Midnight, Purple, Starlight; USB-C; $519.75 on each existing variant, preserved. **No inventory row exists for any of the four variants.** Owner confirmed five units TOTAL, not per colour. Need four actual colour quantities summing to five. There is no previous allocation to reuse; none was invented. Existing inactive/demo flags remain. Existing sparse technical fields (H2, ANC/Transparency, USB-C) were preserved; complete hardware/model specifications and manufacturer part numbers have not been independently verified in this task.
- **Sony PlayStation 5 Pro Console — 2TB** (`997fac76-b60c-82e7-84a1-00cd7164cff2`): stored $899, internal SKU, description identifies all-digital/2TB. Variant colour is literally `Colour to confirm`, configuration `Standard configuration`. Owner confirmed $899 and five available units; five units are now recorded, nonprovisional. Need exact colour/configuration confirmation before activation. Detailed CPU, memory, cooling and PSU values are absent/marked not provided; desktop-oriented mouse/keyboard/monitor/motherboard fields remain in the existing source. They were not replaced with invented specifications.

Owner was asked for these exact unresolved values. Do not mark the products complete until the details, activation and purchasing tests succeed.

## 4. Purchasing readiness — FIXED AND VERIFIED purchase blocks; USER INFORMATION REQUIRED activation

The guarded operation `supabase/operations/20261113_confirmed_stock.sql` was tested in isolated PostgreSQL, then executed against the hosted project under the owner's explicit five-unit instruction. It locks the two target inventory rows, checks exact product/variant IDs and existing prices, rejects changed quantities or reserving orders, records the existing inventory audit reason, and changes only those quantities/provisional flags. Confirmed output: AirPods 5 = 5 / $129; PS5 Pro = 5 / $899. Both remain inactive/demo pending missing details. Max 2 was untouched because its colour allocation is missing. Operation replay was tested; a conflicting quantity was rejected. Do not automatically restore the superseded 15-unit values.

`purchaseLimit()` continues to reject inactive/demo/provisional/missing-price/unknown-stock configurations. Browser checks confirmed Add to cart and Buy Now disabled for each of the three incomplete products. Available iPhone 16 showed both buttons and In Stock. Stock labels show no numerical stock quantity. Hosted order creation after product activation remains NOT VERIFIED.

`025_purchase_validation.sql` adds an order-item guard against pending/unknown configuration or colour, missing verified price/source/SKU, inactive/demo/provisional records and mismatched line base prices. It preserves existing order/inventory locking and checkout pricing; no alternative product system was introduced. The guard is locally tested but not yet installed on hosted Supabase.

## 5. Security fixes — FIXED AND VERIFIED locally; hosted rollout pending

- **Medium, confirmed validation gap:** existing shipping SQL length comparisons could accept missing/null required text. New `guard_order_address()` requires typed nonempty name/street/city/state/ZIP/country, bounds key fields, validates all 50 state codes and ZIP format. It does not claim to establish a deliverable address.
- **Medium, confirmed data-readiness gap:** an otherwise active row could retain pending configuration without the new order-item guard. New `guard_order_item_readiness()` rejects it server-side even if browser validation is bypassed. Current affected products were already blocked by inactive/demo flags; no hosted exploit was attempted.
- **Medium, confirmed Zelle screenshot race:** duplicate same-reference uploads could leave a losing object unreferenced; earlier unconditional error cleanup could also remove a committed object after a lost response. `cleanupUnreferencedEvidence()` now rereads the persisted reference and removes only a proven unused upload, retaining uncertain outcomes. Updated store-api has not been deployed.
- Worker is POST-only, private-secret protected, uses server-side secrets, returns no customer data and logs only generic failure codes. New outbox denies client access; security-definer trigger functions have fixed `pg_catalog` search paths and no API execute privilege. No RLS was disabled; no internal Storage grants/tables were changed.

No Critical issue was demonstrated by the bounded checks. This does not establish absence of vulnerabilities. Existing unpaid Zelle instructions can hold inventory until bank reconciliation: define an SLA, aged-hold monitoring and abuse controls. Do not release unresolved transfers automatically merely to free stock. Screenshot header validation is not a full image sanitization service. Visitor likes remain susceptible to identity-reset abuse. These operational/potential risks remain open.

## 6. Security verification — FIXED AND VERIFIED in isolated tests; NOT VERIFIED end to end hosted

The complete local suite passed **66/66**, zero failed/skipped. It includes:

- Latest schema with 018 absent (matching the hosted gap), then 024/025 application and repeat execution; fresh full installer tests also pass separately.
- Two-customer profile/address/cart/order/item/payment/history read isolation; forged cross-customer cart writes rejected; customer inventory writes/admin self-enrolment rejected.
- Customer payment-status writes denied; non-admin and admin without `aal2` rejected; MFA admin bank-verification transition and replay exercised.
- Authoritative prices/totals, quantity/stock enforcement, duplicate order request handling and single stock decrement.
- Null/malformed US address, provisional inventory and pending product-configuration rejection.
- Durable order receipt/payment/preparation/shipping queue, nonoverlapping claims, frozen retry payloads, bounded retry expiry and denied customer outbox/claim access.
- Zelle reference idempotency/holds, screenshot type/size validation, evidence cleanup and backend request validation; existing payment/refund tests remain passing.

These tests use isolated PGlite PostgreSQL and mock APIs. They did not create hosted customers, orders, bank transfers or reviews. Fresh hosted two-user/Storage/admin/order-email workflow, real bank receipt verification, actual SMTP delivery, backup restore and production HTTPS/security headers remain NOT VERIFIED.

## 7. SEO pages and metadata — FIXED AND VERIFIED locally

Build now reads the current public Supabase catalogue/promotions, stopping on configured-source failure instead of using legacy draft records. It creates **13 individual product documents**, four category documents and a shop document using existing components/styles. All 13 direct product URLs returned HTTP 200 and had 13 distinct titles. Product pages include descriptions, canonical/Open Graph metadata, image alt text, accurate existing specification content and JSON-LD; incomplete products omit Offers. Existing product cards now link to the individual documents and retain the variant route. No ratings/reviews were invented or modified.

Temporary Netlify/Vercel base URL and indexing are environment-controlled. Tests verified a temporary-host canonical, correct 15% pricing snapshot, no stale-domain URL, incomplete Offer omission, unpublished-product exclusion and escaped metadata/JSON. The actual temporary URL is not yet known; current local fallback canonical is `https://coastlinedevice.com`. This must be replaced with the real approved hosting URL at deployment.

All **90 unique public catalogue image paths** exist in dist. Desktop inspection at 1440px and phone inspection at 390px showed no document horizontal overflow; the iPhone 16 main image loaded correctly. Category-to-product navigation and hydration were exercised. No error-level console entries were returned for inspected pages. This is not a re-audit of every colour/image angle or every browser.

## 8. Sitemap and robots — READY generation; CONFIGURATION REQUIRED public indexing

Generated sitemap contains 28 unique URLs (root, shop, nine information pages, four categories, thirteen products). Current local build intentionally has `noindex,nofollow` and `Disallow: /`. Approved public deployment must set `PUBLIC_INDEXING_ENABLED=true` and its real `PUBLIC_SITE_URL`, then rebuild. Tests verify indexing-enabled robots/meta and temporary canonical output. Public crawling, Rich Results validation and Search Console submission have not occurred.

## 9. Build and verification — READY local artifact

- `npm test`: 66 passed, 0 failed, 0 skipped.
- `npm run build`: succeeds, 13 product pages generated.
- `npm run check:edge`: all configured Edge entry points parse. This is not a deployed Deno/network integration test.
- Targeted guarded stock operation: repeat execution and conflict rejection tested separately in isolated PostgreSQL; hosted result then inspected.
- Frontend browser: direct category/product pages, hydrated purchase controls, actual 390px / 1440px widths, image and overflow checks, console inspection. No real checkout order submitted.

Private evidence: `.private/fixes-2026-11-13/tests.txt`, `static-verification.json`, `browser-results.json`, `mobile-product.png`, `desktop-blocked-product.png`, `confirmed-stock.png`. Public build contains no `.private`, environment files, SQL or server sources. A pattern scan remains a limited check, not proof against every possible secret representation.

## 10. Remaining launch blockers

1. USER INFORMATION REQUIRED: actual pending AirPods case/configuration, Max 2 colour allocation totalling five, PS5 Pro colour/configuration; then controlled activation and live cart/order validation.
2. CONFIGURATION REQUIRED: Resend sender/key, private worker secret, SMTP/templates and scheduler.
3. CONFIGURATION REQUIRED: approval and compatibility check for targeted 024/025 and updated Edge Functions. No full installer rerun.
4. CONFIGURATION REQUIRED: real temporary-host URL, Auth callbacks/origin, indexing-enabled public build and hosting security headers. No deployment/DNS change was made.
5. NOT VERIFIED: fresh real Email/Google confirmation/recovery flows; owner-controlled inbox delivery; customer-to-admin Zelle receipt verification and shipping email; production two-user isolation and recovery/backup restore. Do not use fabricated bank confirmations to pass these checks.
6. CONFIGURATION REQUIRED: aged Zelle-hold/email-failure monitoring and reconciliation responsibility before customer launch. Existing hosted checkout flags were not toggled; their enabled state is not launch approval.
7. FUTURE ENHANCEMENT: PayPal/cards remain disabled; no gateway was activated.

## Files changed

- `.env.example`
- `js/storefront-ui.js`
- `scripts/build.mjs`, `scripts/seo.mjs`, `scripts/seo-catalogue.mjs`, `scripts/serve.mjs`
- `supabase/migrations/024_order_email_delivery.sql`, `025_purchase_validation.sql`
- `supabase/functions/_shared/order-email.ts`, `_shared/zelle.ts`, `order-email/index.ts`, `store-api/index.ts`
- `supabase/templates/confirmation.html`, `recovery.html`
- `supabase/operations/20261113_confirmed_stock.sql`
- `tests/email-security.test.mjs`, `seo-production.test.mjs`, `seo.test.mjs`, `installer.test.mjs`, `persistent-catalogue.test.mjs`
- `supabase/setup/install-store.sql`, `install-manifest.json` (locally regenerated guarded fresh-install review artifacts; not applied)
- `docs/integration/EMAIL-AND-SEO-SETUP.md` and this report
- Generated `dist` and private verification evidence.

No CSS, theme/branding assets, existing review data, category definitions, merchant recipient details or unrelated product data were changed.
