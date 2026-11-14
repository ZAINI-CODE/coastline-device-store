# Architecture and requirements

The specification in the attached file is authoritative. Implementation uses HTML, CSS and modular vanilla JavaScript; Supabase JavaScript is the only browser library. esbuild bundles it locally; no framework or runtime CDN is required. Static assets are built into `dist`. Hash routes keep navigation compatible with Netlify and GitHub Pages.

## Request and authority boundaries

Public catalogue reads use the Supabase public key with RLS. Customers authenticate through Supabase email/password, Google, or Apple only. Orders require authentication. Account pages query the current user's RLS-protected records. Owner operations require an entry in `admin_members` AND JWT assurance level `aal2` in the database. A profile cannot confer an owner role.

The cart stores only variant IDs and quantities. The server-side `place_order` transaction reads current variant prices, checks published status, locks inventory rows in consistent UUID order, validates owner-approved destination/tax rules, calculates the best eligible exclusive promotion and reserves stock. The order and immutable item snapshots are created in that same transaction. Duplicate user/request IDs return the same order without deducting stock again. Browser amounts are ignored. Shipping is included in this implementation's configured tax base; approve or replace the tax model for actual jurisdictions before launch.

PayPal creation and capture use the server's recorded amount and shipping address. Capture is claimed under a row lock before contacting PayPal. Completed transactions must match provider order, local reference, merchant, exact USD amount, currency and capture state. Webhooks are verified using PayPal's verification API and their order is retrieved independently. Payment confirmation is idempotent. A late capture after stock release is rejected for manual reconciliation. Processing payments do not auto-expire: reconcile provider failures before releasing them. An MFA owner may request an idempotent full PayPal refund; completion requires matching trusted provider data. Zelle refunds record an owner-confirmed actual bank refund. Partial refunds and automatic reconciliation of refund/reversal webhook events remain incomplete.

Zelle is manual. A submitted reference never changes payment status. The owner verifies bank receipt and confirms the financial action before invoking an MFA-protected database function. Uploaded screenshots are not implemented; references are supported. No uploads are accepted, so no unvalidated file storage endpoint exists.

Pending reservations expire after 30 minutes when the documented Cron job runs. Cancellation releases stock exactly once. Paid orders cannot be cancelled through this workflow; refund and accounting reconciliation must happen first. Order status and payment status are separate, with timestamped history.

Promotions support percentage or fixed-amount discounts on owner-selected products, minimum quantity, bundle membership, start/end dates and activation. The largest eligible discount wins; stacking is intentionally unsupported. Exact discounts are allocated across eligible order snapshots. Owner-defined bundle membership must reflect verified compatibility. The bundle builder lets customers change variants, quantities and included products and shows individual prices, savings and totals as estimates; the server recalculates the final valid offer. Advanced stacking rules remain incomplete.

Reviews are written only by the verified-purchase RPC; edits reset moderation. Only approved reviews are public. Users can report a review. Review aggregates derive from actual records. No viewer counters, reviews, prices or stock have been fabricated.

## Layout

- `index.html`, `css/`: shared accessible shell and responsive styling.
- `js/core.js`: safe formatting, filtering and cart normalization.
- `js/api.js`: Supabase transport and catalogue adapter.
- `js/app.js`: storefront routes, cart and checkout.
- `js/customer.js`: accounts, MFA and owner operations.
- `config/`: centralized public business information and pending shipping template.
- `data/`: empty published catalogue/image manifest; separate source-backed research queue.
- `supabase/migrations/`: authoritative schema, RLS, transactions and guards.
- `supabase/functions/`: authenticated API and signed PayPal webhook.
- `tests/`: browser-independent cart/filter tests and actual local PostgreSQL tests.

## Development decisions

No store name was provided. The visible name `Electronics` is a generic preview descriptor, not an invented business identity. The supplied location is used verbatim. No complete address, customer contact, warranty, shipment estimate, review, discount or product image is invented. Unapproved policies are not published as promises. No newsletter form is shown without a configured destination. `OS4 PCs` is excluded pending clarification.

The owner workspace has guided forms for products, variants, categories, stock, shipping, promotions and launch settings, with paginated record pickers. A validated JSON batch importer saves complete resource records in one PostgREST transaction. Orders, payment/full-refund actions, review moderation, support messages and audit history have separate paginated sections. Overview metrics aggregate actual full-database records through an MFA-protected RPC. Partial refunds, rich image uploads and advanced accounting reports remain unfinished. Configured variant galleries are supported. Hardening and acceptance testing against a real Supabase instance are required.

Migrations 007–010 protect refunded states from capture replay, prevent uncertain processing payments or refunds from releasing stock, hold stable product/price snapshots, aggregate bundle quantities across variants, and cap simultaneous unpaid reservations. The default cap of five is an adjustable security setting, not a claimed stock level. A public-key-only diagnostic checks basic setup without sending emails, placing orders or touching payments. The build rejects service-role/secret key formats in public configuration.
