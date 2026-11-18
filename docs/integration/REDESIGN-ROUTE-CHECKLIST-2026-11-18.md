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
