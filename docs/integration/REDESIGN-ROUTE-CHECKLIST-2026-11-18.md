# Complete experience redesign — route checklist

## Inspection before implementation

Inspected the route dispatcher and event wiring in `js/app.js`, shared shell in `index.html`, customer account/recovery/profile modules, checkout address/phone/Zelle components, product options/gallery/specifications/reviews/promotions, content renderer, bundles, admin navigation/editor/imports, theme initialization, motion and build/SEO generators.

The application is a hash router. Order details, saved addresses, security and profile editing are sections of `/account`, not separate routes. Owner tools are query-selected tabs in `/admin`. Authentication recovery uses the account route. There is no existing wishlist, separate customer analytics page, or customer return self-service backend. These have not been invented.

## Existing route families and their visual treatment

- [x] `/`: cinematic product hero, category tiles, product collections, showcase, editorial/audio panels, gaming presentation, offer panel, service strip.
- [x] `/shop`: collection heading, filter disclosure, product grid and result count.
- [x] `/shop?category=…`: all four published categories use the collection design.
- [x] `/shop?q=…`, sorting/filter combinations: shared collection and no-results treatment; filters stay closed until requested.
- [x] `/product/:id`: gallery-led overview, selected configuration, price and stock, product-section navigation, full-width grouped specifications, two-column reviews, related grid.
- [x] `/cart`: image summaries, quantity/removal controls, sticky estimate and empty state.
- [x] Header bag drawer: read-only selection preview with links to edit the full bag or continue checkout.
- [x] `/checkout`: progress, grouped delivery fields, saved-address selector, existing payment selector and assurance/summary panel.
- [x] `/checkout?order=…`: order/payment panel, existing payment instructions, reference form and truthful pending-verification confirmation.
- [x] `/account` signed out: separate sign-in and registration panels, provider buttons and recovery dialog.
- [x] Recovery callback: account security editor opens for password recovery; ordinary visits keep editors closed.
- [x] `/account` signed in: overview, section navigation, profile/picture editor, account security, orders/tracking/history, saved-address cards/form and own reviews.
- [x] `/admin`: separate owner heading, operational metrics, workspace navigation and contextual tab introduction.
- [x] Admin tabs: overview, orders, catalogue, promotions, shipping, reviews, messages, inventory-history, audit, settings.
- [x] Admin resources: products, product_variants, inventory, product_costs, categories, promotions, promotion_products, shipping_rules, store_settings; record rail, editors, import disclosures, pagination and export remain intact.
- [x] `/deals`: distinct offer heading, configuration panels, bundle summaries and empty state.
- [x] `/about`: cinematic story heading, approved product imagery, editorial information panels.
- [x] `/contact`: support details and private-message form/sign-in state.
- [x] `/faq`: accordion help centre.
- [x] `/shipping`, `/returns`, `/warranty`, `/payment`, `/privacy`, `/terms`: readable policy layout, section contents navigation and support links.
- [x] `/credits`: document-style acknowledgements.
- [x] Local-only `/connection`, `/catalogue-review`, `/iphone-prices`: preserve tools; page headings, forms and record surfaces use the presentation system.
- [x] Unmatched routes, unavailable products, failed requests, loading, empty states, toast messages and native form-validation states.
- [x] Shared sticky header, category menu, mobile navigation, modal search, footer and Light/Dark/System appearance.

## Business boundaries

- No database migrations, inventory adjustments, price updates, review modifications, payment processing changes or access-policy changes are required for this redesign.
- Zelle reference submission remains pending until actual bank receipt is verified. PayPal/cards remain disabled according to existing configuration.
- Apple sign-in remains unavailable until provider configuration is supplied.
- Returns copy now states a 15-day request period for defective, damaged or incorrect products, with inspection/authorization and exchange subject to replacement availability. Change-of-mind returns have not been added.

## Verification record

Implementation checkboxes above indicate presentation coverage, not successful live authentication, financial transactions or deployment. Running-browser results and remaining limitations are recorded separately after verification. Local QA uses disposable fixtures and never represents a real order or payment.

### Completed verification

- Production build generated the existing 13 published products and their crawlable pages.
- 37 frontend regression tests passed, including explicit System appearance. Three additional action-colour/profile-security tests passed.
- 78 browser acceptance checks passed against the local build. The same suite subsequently passed against the published public storefront; its authenticated admin/payment cases deliberately remained on isolated localhost fixtures.
- 53 additional responsive/state checks passed: all 13 products on mobile, remaining public routes, local preview tools, every mobile admin tab/editor, disposable order details/reference confirmation, registration validation, password-recovery presentation and network-error retry.
- All 36 generated direct product, category and information URLs passed live checks for their routed page, redesign stylesheet and first product image where present. Shared/direct links therefore received verification in addition to hash navigation.
- Automated browser suites reported no uncaught application errors. These checks cover Chromium desktop and a 393 × 852 responsive viewport; they do not certify Safari, Firefox or physical-device performance.
- A fresh live Google sign-out/sign-in returned the approved testing account to the account overview. The existing private profile picture loaded and the Edit Profile control opened its separate editor. No profile values were saved or pictures changed during this release.
- Signed-in live checkout displayed the authenticated email/name, required contact/address fields, all 50 U.S. states, free standard shipping and $25 fast delivery. Alaska plus fast delivery selected a valid rule. Zelle was selectable; PayPal and cards remained disabled. The 393-pixel live checkout had no horizontal overflow. No order was submitted.
- A before/after public-catalogue fingerprint covering product identities, variant records (including prices, stock and images), review totals and ratings was identical. The store still publishes 13 products. No migration, Edge Function deployment, price/stock/review write or permission change was performed.

### Published release

Netlify production deploy: `6afd52d42c30100eacaa9014` at https://coastline-device.netlify.app/.

Published application revision: `cb63233`. JavaScript, theme initialization, redesign CSS and policy JSON matched the tested package byte for byte. Netlify post-processes the HTML by adding a hosting comment and rewriting some links, so raw HTML hashes differ. The existing CSP, `DENY` framing header and `nosniff` header remained present. No security protection was relaxed.

Scoped commits pushed to the existing GitHub repository:

- `08a3f94` — website-wide visual system and responsive components.
- `9df45a6` — recovery dialog and password-reset editor presentation.
- `ad5da20` — approved 15-day defective return/exchange copy.
- `cb63233` — route checklist and isolated browser verification tooling.

Private screenshots, JSON test results, catalogue snapshots, release hashes and deployment ZIP are under `.private/redesign/`, excluded from Git. Public deployment packaging contains only built storefront files and the existing security headers.

### Verification limits

- New live email registration, email delivery and an actual password-reset link were not exercised. Form handling and recovery/reset presentation passed isolated tests; fresh live Google callback passed.
- Apple OAuth remains blocked by its existing unconfigured provider, as previously confirmed by the owner.
- Real admin mutations were not performed. Every admin screen/editor was tested using isolated fixtures; existing hosted MFA/RLS were not changed or bypassed.
- No real Zelle transfer, bank verification, order fulfilment, refund, shipment or delivery notification was generated. Disposable UI fixtures are not evidence of a real payment.
- PayPal and card payment submissions remain unavailable by the approved configuration. This redesign does not certify end-to-end payment or email launch readiness.

### Rollback

Republish the prior Netlify deployment `6afc8ca97af803dafb9676ed` if a visual regression requires rollback. This release has no database migration or data rollback step. Retain all customer accounts, orders, reviews, prices and inventory.
