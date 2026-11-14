# Coastline Device: production readiness audit

Audit date: 12 November 2026. Recommendation: **do not deploy the store for customer orders yet**.

This is an inspection report, not an approval to implement recommendations. No application fixes, hosted database changes, payment activations, deployments, DNS changes or authentication-setting changes were made. Local build output and audit evidence were generated. One guest cart test line was added and removed; existing cart lines were preserved. No order, payment, refund, review or inventory record was created or changed.

Evidence is a point-in-time snapshot, not a penetration-test certification. READY below applies only to the specific check described. Previous successful authentication tests are historical evidence, not fresh production callback tests.

## 1. Frontend readiness — NEEDS FIX

### Completed checks

- Production build succeeds. The fresh automated suite passed **57/57**, with no failed or skipped tests. Edge Function source checks pass; this is parsing validation, not a deployed Deno integration test.
- Live public catalogue returns **13 products / 72 visible variants**; hosted metadata reports 67 active variants. These counts describe different projections and must not be treated as 72 purchasable variants.
- All 13 product detail pages were visited. Each rendered a product image, specifications and customer reviews. Two initially stale browser snapshots were rechecked in separate settled tabs; they are not routing defects.
- All **90 unique image paths** referenced by the public variant/gallery projection exist in the production build. This verifies path availability, not the identity or visual quality of every alternate image.
- iPhone 16 Pink / 256GB selected a corresponding image and variant, and appeared as Pink / 256GB in the guest cart. The test line was removed afterward.
- Guest checkout redirected to the sign-in/account page. Existing unavailable cart items correctly blocked checkout instead of silently disappearing.
- Searching for AirPods returned the three AirPods products. A sort selection was exercised, but its final ordering was not independently verified. Category/filter logic was inspected, not exhaustively browser-tested.
- The inspected product pages showed reviews, fractional ratings, review totals and an Add a Review button. No reviews or likes were submitted during this audit.
- Header/footer use Coastline Device branding; favicon declarations and local assets are present. The iPhone Air narrow-layout screenshot shows the logo and contained product image without clipping.
- No error-level console entries were returned for the inspected shop tab. This is not proof that every route is error-free.

### Confirmed product blockers — High

Public catalogue and settled product pages show:

- **AirPods 5:** no selling price; inactive configuration, charging-case/SKU still pending. Page displays In Stock while purchase is disabled with configuration-awaiting-confirmation text.
- **AirPods Max 2:** selling prices exist, but stock is null in the public response for all four colours. Page says Stock not confirmed; purchase is disabled.
- **PS5 Pro 2TB:** no selling price and no confirmed public stock. Purchase is disabled. Specifications also contain desktop-oriented fields such as mouse, keyboard, motherboard and monitor with “not provided/not applicable” values.

Locations: `js/product-options.js::purchaseLimit`, `js/app.js` product/card rendering, `public.storefront_catalogue`, `products`, `product_variants`, `inventory`. The purchase guard is correctly refusing incomplete data. Do not bypass it or replace unknown stock with invented quantities. Investigate the underlying records and projection conditions; retain the owner's confirmed quantities. Supply only genuinely missing product/configuration/price information, or explicitly unpublish incomplete products after approval.

Test after correction: compare every affected variant against the approved source and underlying inventory; confirm identical price/availability on card, detail, cart and server order snapshot. Test positive, zero and null inventory separately.

### Remaining frontend checks

- **NOT VERIFIED:** every colour/storage permutation, every gallery angle, wishlist (no implemented wishlist workflow found), all links/forms, fresh review submission/moderation, customer history and real admin actions.
- Responsive CSS and reduced-motion/focus handling exist. A narrow iPhone Air view was inspected at an observed 487 CSS-pixel width without document overflow. Requested viewport overrides did not reliably produce exact 390/768 widths, so exact phone/tablet breakpoint acceptance remains **NOT VERIFIED**. Do not treat the saved tablet screenshot as proof of a 768px viewport.
- Empty controller/CPU category navigation remains visible although the current inventory has no products in those categories. Low-priority content/navigation recommendation, not authorization to redesign.

## 2. Backend readiness — NEEDS FIX

Architecture is HTML/CSS/Vanilla JavaScript, bundled by Node/esbuild at build time, with PostgreSQL/Supabase Auth/Storage and Deno Edge Functions. No PHP, always-running Node server or additional custom backend is required in production.

Inspected order logic calculates totals on the server, uses integer cents, snapshots line details, validates identifiers/quantities and locks inventory rows. Order request idempotency and payment reference uniqueness are implemented. Local isolated-database tests exercise these protections; hosted concurrent orders were not created.

**High: order/shipping email is not installed on the hosted project.** Hosted metadata reports no `order_email_outbox`; an unauthenticated request to the `order-email` endpoint returns 404. Local `supabase/migrations/018_order_email_outbox.sql` and `supabase/functions/order-email/index.ts` exist, but their presence does not mean deployment occurred. Required paid/shipped email delivery therefore cannot currently be considered working.

Recommendation: after approval, compare the hosted schema with migration 018, install only missing compatible objects, configure the email provider/verified sender and authenticated worker, deploy the worker and arrange its schedule. Do not rerun the full installer. Test paid and shipped events, retries, duplicate processing, provider errors, and tracking/carrier content before enabling customer checkout.

## 3. Supabase readiness — CONFIGURATION REQUIRED

### Verified read-only hosted observations

- **28 application tables, all with RLS enabled; 37 policies; 29 foreign-key definitions; 36 reported functions.** Full metadata snapshot is retained privately.
- Tables: `products`, `product_variants`, `categories`, `inventory`, `product_costs`, `inventory_adjustments`, `catalogue_imports`, `profiles`, `customer_addresses`, `carts`, `orders`, `order_items`, `payments`, `order_status_history`, `refunds`, `payment_operations`, `webhook_events`, `request_limits`, `admin_members`, `admin_audit_logs`, `reviews`, `review_likes`, `review_reports`, `contact_messages`, `promotions`, `promotion_products`, `shipping_rules`, `store_settings`.
- Ownership chains: profiles/addresses/carts/orders reference authenticated users; items/payments/history/refunds belong to orders; inventory belongs to variants; variants belong to products/categories. Constraints exist; full recovery and all deletion semantics were not exercised.
- Own-record policies protect profiles, addresses, carts and orders. Order item/payment/history/refund reads join to an owned order or require the MFA-protected admin predicate.
- Sensitive catalogue/cost/inventory/admin operations use admin policies. Public catalogue access uses a projected RPC rather than opening raw inventory/cost tables.
- Anonymous SELECT requests to profiles, addresses, orders, items, payments, supplier costs and admin membership returned **401**, without customer rows.
- `is_admin()` checks membership and JWT `aal2`. Authenticated access to administrative RPCs is not by itself authority; the function-level MFA check is essential.
- Privileged service payment functions are not executable by anon/authenticated roles. SECURITY DEFINER functions inspected have fixed search paths; API roles cannot CREATE in public. This reduces search-path substitution risk. No reason was found to revoke standard Storage grants blindly or alter internal Storage tables.
- `zelle-evidence` bucket is private, limited to 2 MiB and JPEG/PNG/WebP. No client Storage policies are present: the current design uses authenticated, authorized Edge Function mediation. Admin evidence URLs expire after 60 seconds.
- `checkout_enabled`, `policies_approved`, `zelle_enabled` are true; PayPal is false. The audit did not toggle them.
- Hosted orders count was zero at inspection time.

### Configuration gaps

1. **Production origin — High, confirmed.** `supabase/functions/_shared/server.ts::cors` uses one `SITE_ORIGIN`. Live requests with Origin `https://coastlinedevice.com` receive 403, with the allow-origin header still pointing to localhost:4173. Localhost receives the expected 401 when unauthenticated. Configure the canonical production origin after approval and retest OPTIONS, authenticated actions and denied foreign origins. CORS is not authentication; keep `identity()` and RLS intact.
2. **Auth Site URL — High launch blocker.** Hosted Site URL is `http://localhost:4173/`; redirects allow localhost and `https://coastlinedevice.com/**`. Production email/reset defaults can therefore point at localhost. Set the canonical production Site URL and review exact callback paths after approval; retain only deliberately supported development redirects.
3. **Custom SMTP is off — High.** Hosted email confirmation is required, Email and Google providers are enabled, but the SMTP UI switch is off. Configure a verified production mail sender and test delivery. Supabase's default SMTP is restricted and not an appropriate production mail delivery assumption. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)
4. **Migration baseline missing — Medium.** No Supabase CLI migration-history relation was reported. This can happen with dashboard-applied SQL; it does not mean the database is empty. Local migration 018 is demonstrably absent while later features exist. Establish a schema baseline and explicit applied-object manifest before any migration push. Never rerun `install-store.sql` against this populated project just to manufacture history.
5. **NOT VERIFIED:** fresh Google/email callbacks, email confirmation/reset, MFA recovery, two authenticated customers accessing each other's records, complete hosted grants/DDL drift equivalence, scheduling of maintenance jobs, quotas, region and backup restore.

## 4. Checkout readiness — NOT VERIFIED end to end

### Zelle

Existing configured recipient details are retained; they were not replaced. Source `zelleConfiguration()` reads server environment settings, and the checkout requests recipient details, exact server total/currency and order ID from the authenticated API. This is manual bank reconciliation, not a bank-connected automatic confirmation API.

- `store-api::place_order` allows Zelle and rejects other methods; login is required.
- `begin_zelle_payment` locks the owned order and records instructions. Customer-visible status remains payment pending; internal processing does **not** mean paid.
- `submit_zelle_payment` locks order/payment, validates reference/path and records pending evidence. The unique normalized reference index prevents reuse; same-reference replay is idempotent.
- Optional screenshots have size/type/magic checks and private storage. A screenshot is not payment proof.
- Admin confirmation requires `is_admin()`/MFA and server-side confirmation; payment total/currency and unique receipt identifiers are checked. A staff member must actually check the business bank account before confirmation.
- Bank-checked cancellation uses `cancel_unreceived_zelle`, a reconciliation note and protected stock release.
- PayPal/card customer paths remain disabled. Their future live verification is **FUTURE ENHANCEMENT**, not a reason to postpone a safely tested Zelle-only launch.

No hosted order was created and no money was sent. Consequently, actual recipient response for a new live order, customer reference upload, admin bank verification, status/history, stock effects, email dispatch and recovery remain **NOT VERIFIED**. The private recipient environment values were not dumped into this report; historical deployment notes alone are not an end-to-end test.

### Inventory-hold risk — High potential abuse, not a demonstrated hosted exploit

`023_zelle_checkout.sql::begin_zelle_payment` changes pending to processing immediately when directions are issued. Automatic expiry deliberately does not release processing stock while payment could arrive. This prevents a payment/stock race, but allows unpaid directions to hold stock indefinitely. `max_open_reservations=5` limits order count per account, not total reserved units or multiple accounts.

Recommendation: define a bank/customer reconciliation SLA, monitor aged holds, impose appropriate account/unit/abuse limits, and provide staff follow-up. Do not simply auto-release an unresolved transfer on a timer. Test abandoned directions, late bank payment, cancellation/confirmation races and repeated accounts before opening checkout.

### Concurrent screenshot retry — Medium, confirmed code-level issue

`supabase/functions/store-api/index.ts::zelle_reference` uploads a random new object before calling `submit_zelle_payment`. Two simultaneous identical references can each upload; the second SQL call returns idempotent success without using its new path. Cleanup runs only for errors, so the extra object can remain orphaned. This is a storage/retention issue, not proof of double payment. Recommend returning the persisted evidence path and removing only the losing upload, or using a safe staged-upload protocol. Test concurrent same-reference uploads and verify exactly one referenced object remains.

## 5. Security readiness — NEEDS FIX / NOT VERIFIED

### Critical issues

No Critical vulnerability was established by the bounded checks performed. This is not a claim that the system has no Critical vulnerabilities.

### High-priority issues and risks

- Confirmed production origin rejection and localhost authentication defaults prevent a functional launch; these are configuration blockers, not proven authorization bypasses.
- Indefinite unpaid inventory holds require an operational/abuse mitigation plan as described above.
- Complete two-user isolation and MFA-protected payment/admin integration remain untested against hosted customer orders.

### Protections observed

- Build allowlist excludes `.env`, `.private`, SQL, node_modules and source maps. A targeted scan of the 309 output files found no secret-key/private-key patterns. This is a pattern scan, not a guarantee against every possible secret representation.
- Public Supabase URL/publishable key are intentionally public; service-role credentials are used server-side. `.gitignore` excludes local environment and private evidence files.
- API verifies bearer identity using Supabase `getUser`; user request limiting exists. Service-role calls are behind these checks and order-owner/admin selection.
- Request parser enforces body limits and types, UUIDs and quantity bounds; HTML user content is escaped. Card/payment secrets are not requested by the storefront.
- `netlify.toml` includes CSP, nosniff, DENY frame protection, referrer and device-permission restrictions. Public HTTPS headers have not yet been tested because the domain does not resolve here.

### Recommendations / potential risks

- **Medium:** visitor review-like identity is client-generated. Resetting it can create new identities; do not treat likes as authenticated votes. Add server-side abuse controls if manipulation becomes material. Existing data was not modified.
- **Medium:** screenshot validation checks headers, not complete decode/re-encode. Consider safe image decoding, metadata removal, retention policy and orphan cleanup; do not accept SVG/executable content.
- **Medium:** shipping-field validation does not establish a deliverable US address. Validate ZIP/state/city/name/address formats and test all 50 states, including Alaska/Hawaii. This is fulfillment quality, not an assertion about tax compliance.
- **Medium:** configure redacted error monitoring, failed-worker/aged-hold alerts, and a tested backup restore. Avoid logging bearer tokens, private screenshots or customer addresses unnecessarily.
- **Low:** decide HSTS after HTTPS is correctly established; review rate limits and exact CSP on the actual hosting platform. Do not weaken RLS/CSP to solve configuration mistakes.

## 6. Hosting compatibility — READY architecture; CONFIGURATION REQUIRED deployment

Recommended architecture: **Netlify static CDN frontend + the existing Supabase backend**. Existing `netlify.toml` already defines build/publish/security headers, so this requires fewer configuration translations. A paid plan is an operational/budget decision, not an asserted technical requirement for the static code. Confirm current commercial terms and usage limits before choosing a plan. [Netlify plans](https://www.netlify.com/pricing/)

- Build: `npm ci && npm run build`; publish directory: `dist`.
- Pin a supported Node version matching the validated build environment; current local Node is 24.22.1. `npm ci` itself was not rerun in this audit; a clean locked-dependency host build remains required.
- Hash routes such as `/#/product/...` use the root HTML and do not require a catch-all rewrite. Generated policy directories and `pages/products/*.html` must also resolve directly.
- Supabase separately hosts database/Auth/Storage/Edge Functions. Do not publish source/config secrets or deploy `scripts/serve.mjs` as the production backend.
- **Cloudflare Pages is compatible**, but ignores Netlify's header syntax. An equivalent `_headers` configuration and custom-domain binding would be required before choosing it. Do not add a second host or Workers runtime unnecessarily. [Cloudflare headers](https://developers.cloudflare.com/pages/configuration/headers/), [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- Existing configuration files were inspected and left unchanged. The accompanying checklist gives proposed environment/configuration changes; none are applied.

Supabase Free Tier is technically compatible with this architecture, but quotas, email limits, inactivity behaviour, backup/recovery and incident-response needs must be assessed for a commercial store. Product count alone does not establish capacity. [Supabase pricing](https://supabase.com/pricing/), [production checklist](https://supabase.com/docs/guides/security/production-checklist)

## 7. Domain and HTTPS readiness — CONFIGURATION REQUIRED

Read-only DNS lookups for `coastlinedevice.com` and `www.coastlinedevice.com` returned **ENOTFOUND** from this environment; the HTTPS request consequently could not connect. This is not proof that the domain is unregistered or that every resolver sees the same result.

After approval: confirm registrar ownership, add the domain to the selected host, use the exact DNS records supplied by that host, choose apex as canonical, redirect www, provision the certificate and verify DNS/HTTPS from independent resolvers. Do not invent destination IPs or overwrite MX/mail-verification records. [Netlify HTTPS documentation](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/)

## 8. Performance and SEO — NEEDS FIX / NOT VERIFIED

- Build contains 309 files, **14,862,988 bytes total**; no single output asset exceeds 1 MB in the recorded scan. Total build size is not first-page transfer size or a Core Web Vitals score.
- Local image variants, lazy-loading/containment and reduced-motion rules exist. Product images rendered on the inspected pages; exhaustive content matching of every gallery image was not repeated.
- **Confirmed indexing block:** `index.html` contains `noindex,nofollow`, and `robots.txt` disallows `/`. Generated pages inherit the template robots tag. Keep staging private/unindexed; remove production indexing blocks only as an approved release action.
- **Confirmed missing product SEO output:** local `data/products.json` has 53 records, zero published records and zero `database_id` values; the actual build has **zero generated product HTML pages** under `dist/pages/products`, despite 13 products being published in Supabase. `scripts/seo.mjs::buildSEO` uses that local file, not the live catalogue. Product hash pages work in JavaScript, but the intended static product SEO fallback is absent. Repair the approved build snapshot/generator before relying on product indexing; do not import the 53 old records into Supabase.
- The same generator would create structured offers from local inventory/base prices without applying live campaigns. Potential structured price/availability drift remains after enabling output. Compare and synchronize the release snapshot, or omit stale offers; do not publish misleading structured discounts.
- Titles/descriptions/canonicals/sitemap generation exist. Search indexing, social previews, no-JavaScript product fallback and every canonical link require checks on the final host.
- Keyboard, screen-reader, 200% zoom, touch, contrast and true 390/768 breakpoints remain NOT VERIFIED. The configuration select wraps its label in source; an initial automation lookup failure alone is not an accessibility defect.
- No Lighthouse/Core Web Vitals, load/stress or real-device performance measurement was completed. Do not quote a performance score.

## 9. Critical issues and launch blockers

There is no demonstrated Critical security exploit in this report. **Launch is nevertheless blocked** by:

1. Production API CORS rejects the actual domain.
2. Domain/HTTPS are unavailable from the audited resolver.
3. Auth defaults still target localhost; production SMTP and fresh callbacks are unverified.
4. Order/shipping email outbox/worker is absent from the hosted deployment.
5. AirPods 5, AirPods Max 2 and PS5 Pro have incomplete public purchase data.
6. No complete hosted customer-to-admin/bank-confirmed Zelle acceptance test or two-customer isolation test exists.
7. Backup/restore and migration baseline are unverified; deployment instructions contain stale assumptions.
8. Search indexing is blocked and structured offers can drift from live campaigns.

## 10. Recommended fixes, in order

1. Approve a precise remediation scope; export schema/data, record deployed function versions/settings and inventory totals, back up Storage objects separately, test recovery. Freeze a release snapshot.
2. Reconcile local/hosted migration state and stale `docs/DEPLOYMENT.md` / email-delivery claims. Do not change unrelated catalogue or reviews.
3. Resolve missing published-product data from authoritative records/owner input. Do not invent prices, stock, SKUs or model identities.
4. Configure domain/host preview safely; canonical origin, Auth Site URL/redirects, verified SMTP, order-email worker/provider/schedule. Public deployment still needs separate explicit approval.
5. Address screenshot retry cleanup and inventory-hold abuse/reconciliation controls; retain MFA and customer ownership checks.
6. Run isolated concurrency/security tests and owner-assisted real authentication/Zelle acceptance. Any actual bank transfer/refund must be performed by the owner; never fabricate paid status.
7. Correct production indexing/structured offers, complete responsive/accessibility/performance checks and verify all headers/assets in a clean production build.
8. After explicit launch approval, publish the immutable frontend build, verify all production flows, monitor errors/holds/email queue and maintain a rollback path. Keep PayPal/cards disabled.

## 11. Final deployment recommendation

**NEEDS FIX — not production-ready for accepting orders today.** Architecture and several protections are suitable, and automated checks pass, but configuration and live workflow gaps are material. PayPal/card support can safely wait; the enabled Zelle path and required emails must first pass acceptance testing.

Use [DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md) for the exact release gates, environment names and rollback plan. No implementation or deployment is authorized by this report.

### Evidence and inspection inventory

Private evidence: `.private/production-audit-2026-11-12/tests.txt`, `probe-results.json`, `catalogue.json`, `build-manifest.json`, `hosted-schema.json`, `hosted-schema-ax.txt`, `auth-url-configuration.txt`, `auth-smtp.txt`, `product-pages.json`, `browser-notes.json`, `mobile-product.png`, `tablet-home.png`. Do not publish this directory. `probe.mjs` documents the read-only API/DNS/build checks. Browser snapshots can contain operational metadata/customer review names; distribute only as needed.

A compact expandable overview is supplied as `readiness-overview.canvas.tsx`. Its TSX syntax was validated. This desktop session has no identifiable managed Canvas directory for this workspace, so the portable source is stored beside the report; automatic discovery/rendering beside the chat was not verified. The Markdown report/checklist are the complete authoritative deliverables.

Inspected source/configuration includes: `package.json`, `.gitignore`, `.env.example`, `netlify.toml`, `index.html`, `robots.txt`, `config/store.json`, `scripts/build.mjs`, `scripts/public-config.mjs`, `scripts/seo.mjs`, `scripts/serve.mjs`, `js/api.js`, `js/app.js`, `js/core.js`, `js/customer.js`, `js/admin.js`, `js/connection.js`, `js/review-navigation.js`, `js/product-reviews.js`, `js/product-options.js`, `css/final-polish.css`, `supabase/config.toml`, `supabase/functions/_shared/server.ts`, `_shared/http.ts`, `_shared/zelle.ts`, `store-api/index.ts`, `order-email/index.ts`, payment/refund function sources through parser checks, and applicable migrations including 001–003, 007, 010–011, 017–018, 020–023. Deployment and Zelle integration documentation was also inspected. This is not a claim that every line of every dependency was reviewed.
