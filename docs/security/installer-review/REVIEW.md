# Supabase installer review — 2026-11-03

**Historical review, superseded by `FINAL-REVIEW.md`.** Its findings describe the original ten-migration SQL, now archived as `original-installer.sql` in this directory. `supabase/setup/install-store.sql` has since been regenerated with migration 011 and requires approval under its new hash. The follow-up audit has now been supplied by the owner. Do not use the historical SQL/proposal as deployment instructions.

Decision: **hold approval of the current installer**. No hosted database changes were made. The existing installer is preserved for review. Two locally reproduced weaknesses have a separate, unmerged SQL correction proposal.

## Evidence and limits

- Target: `roamotmagssiipntchgh.supabase.co`.
- Original installer: `supabase/setup/install-store.sql` (complete SQL, not an excerpt).
- Reviewed SHA-256: `35ebde2611c10fea2f34bbb5b2f1d19c5db0acd5b8c6d9959a1e8cbf93acc3ff`.
- Follow-up requested: `supabase/audits/storage_function_followup.sql`. It is a single read-only SELECT. **It has not been executed against the hosted project in this session.** There is no connected SQL/management tool, database connection, or Supabase CLI; the computer-use browser fails to start. A publishable key cannot execute this administrative SQL. Do not create a public SQL-execution RPC as a workaround or share private credentials in chat.
- The supplied earlier audit shows no application tables in `public`, but does not settle other custom schemas, buckets, the function body/owner, event-trigger behavior, API bypass flags or public-schema CREATE privileges. The follow-up must be run in an authorized SQL Editor and its result reviewed before installation. It returns metadata/bucket names, not customer rows or tokens.
- Local verification uses PGlite, a PostgreSQL environment with simulated Auth roles/functions. It is not Supabase Cloud, PostgREST, a live payment test or a concurrency/load test.
- Tests: 17 existing automated tests passed. A separate review simulation installed the unchanged SQL locally with broad default table/sequence grants, introspected the final schema and reproduced the permission/refund findings. The proposal then passed the local permission and NULL-refund rejection checks.
- Google callback, account creation and reload persistence were previously confirmed by the user in the hosted-project frontend. Email registration/recovery, hosted RLS, MFA administration and live/sandbox payments remain unverified.

## Security findings

### Critical conditional issue: inherited application-table privileges

The current installer grants needed privileges but does not consistently clear inherited ALL privileges on its new tables. Under broad default grants, anon/authenticated retained 42 TRUNCATE grants across 21 application tables. An authenticated TRUNCATE on an empty local `carts` table succeeded despite its ownership RLS policy. The test transaction was rolled back. This is a confirmed installer weakness under the simulated default configuration, **not evidence that hosted customer data has been exposed**. The application tables do not yet exist in the supplied hosted audit.

RLS does not cover TRUNCATE or REFERENCES. Broad privileges must be removed from the newly created application objects and then only necessary permissions restored. This correction concerns application tables only, and provides no reason to revoke Supabase's managed Storage grants. [PostgreSQL row-security boundaries](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

### Required correction: refund proof and retry identity

`finish_paypal_refund` is restricted to the trusted backend, but its comparisons against NULL amount/currency evaluate to unknown rather than rejecting the call. A local fixture accepted NULL provider ID/amount/currency and marked the refund completed. The existing Edge handler validates these fields before calling it, so this is a defense gap at the service boundary, not a customer-accessible payment bypass. The function also permits replacing a pending provider refund ID before completion. The proposal rejects missing proof, requires a PayPal order, and preserves provider identity across retries.

### Required verification and function hardening

The existing `rls_auto_enable` function is preserved. Its actual body, owner and event binding remain unknown. An event trigger can run during CREATE TABLE even when the installer never explicitly calls it; review the follow-up before allowing DDL.

The application's privileged functions currently set `search_path=public`. Their safety requires a trusted public schema; implicit temporary-schema resolution also deserves hardening. The proposal explicitly places `pg_temp` last for application functions and refuses installation when anon/authenticated can CREATE in public or bypass RLS. It does not change platform roles, schema grants, or the existing auto-RLS function. Unexpected role memberships or PUBLIC grants inherited through other custom roles require separate review. [PostgreSQL SECURITY DEFINER guidance](https://www.postgresql.org/docs/current/sql-createfunction.html).

### Recommendations and known scope limits

- Approved reviews are publicly readable as complete rows, including author UUID and moderation fields; no email is stored there. If public author UUIDs are unwanted, introduce a dedicated public read model and update the frontend. Current RLS isolates private records, not the public review identity metadata.
- The current admin UPDATE privileges on reviews/contact messages cover whole rows. The proposal narrows these to `approved`/`handled`, matching the actual buttons.
- Add a non-null review ID and abuse controls for review reports if this feature is exposed further; the current nullable review reference permits meaningless reports. Validate cart/address JSON sizes and content beyond the checkout checks as traffic grows.
- Some optional columns remain nullable; UUID arrays in `compatible_product_ids` have no foreign-key enforcement. There is no universal ledger constraint validating all order totals for a privileged direct write. Price/payment/stock integrity relies on restricted writes and the reviewed functions.
- Additional foreign-key and operational indexes should follow observed query plans. Reservation expiry and reconciliation need an operational schedule and monitoring.
- Admins are highly trusted: MFA-authorized catalogue editors may change prices, stock and shipping/tax settings. Audit logs record actions/IDs, not full before/after row values; composite-key changes can have an empty record ID. There is no tamper-proof external audit export.
- No confirmed critical Storage defect follows from the earlier broad grants. Enabled RLS with no allow policies is deny-by-default for ordinary table access. Public bucket downloads are a separate boundary; bucket visibility is still unknown. [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [bucket visibility](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## 1. Complete schema and table list

All 23 tables are in `public`. Full columns, SQL types, nullability, defaults, CHECK/UNIQUE/PK/FK definitions and exact policies are in `SCHEMA-AND-POLICIES.md`; machine-readable evidence and effective grant tuples are in `catalogue.json`.

1. `admin_members`: trusted administrator membership, keyed by Auth user ID.
2. `profiles`: customer display name, keyed by Auth user ID.
3. `customer_addresses`: customer-owned saved shipping addresses.
4. `carts`: one JSON cart per customer; checkout does not trust stored prices.
5. `categories`: unique catalogue category names.
6. `products`: brand/model, description, specifications, search terms, category, publication/source verification, product type.
7. `product_variants`: unique SKU, product, color/configuration, USD price in cents, approved image/source/date, gallery, specifications, compatibility UUIDs, active flag and verified price source/date.
8. `inventory`: nonnegative available quantity per variant.
9. `shipping_rules`: approved country/state/method, delivery description, shipping cents, optional free-shipping threshold and configured tax basis points.
10. `promotions`: active date window, quantity/bundle kind, eligibility quantity and an exclusive fixed or percentage discount.
11. `promotion_products`: promotion/product join table.
12. `orders`: customer, idempotent request key, address snapshot, selected shipping rule, payment method, immutable financial snapshots, reservation expiry, stock-release marker, fulfillment/payment state, carrier/tracking.
13. `order_items`: order/product/variant links, name/SKU/variant snapshots, quantity, unit-price cents and allocated discount cents.
14. `payments`: one row per order, unique PayPal order/capture identifiers, customer-supplied reference, verifier and verification time.
15. `order_status_history`: append-only through order trigger, status/payment-state snapshots.
16. `reviews`: unique customer/product review, rating/body/display name, moderation flag.
17. `review_reports`: review report, reporting user and reason.
18. `admin_audit_logs`: actor/action/record/time/outcome.
19. `webhook_events`: processed provider event IDs for replay handling.
20. `request_limits`: per-user request window/counter.
21. `store_settings`: singleton launch settings; checkout=false, policies=false, maximum five open reservations initially.
22. `contact_messages`: signed-in customer support messages and handled flag.
23. `refunds`: one full refund request per order, requester, amount/currency, unique provider refund ID, processing/pending/completed state, bank reference and dates.

Installation seeds only five category names and the disabled store-settings singleton. It creates no users, admin memberships, product listings, prices, stock, orders or reviews. Existing Auth users are reused; profiles are saved by the frontend, not automatically provisioned by an Auth trigger.

## 2. Relationships and foreign keys

- `auth.users.id` is referenced by admin_members.user_id, profiles.id, customer_addresses.user_id, carts.user_id, orders.user_id, payments.verified_by, reviews.user_id, review_reports.user_id, contact_messages.user_id and refunds.requested_by.
- products.category_id → categories.id.
- product_variants.product_id → products.id; inventory.variant_id → product_variants.id.
- promotion_products.promotion_id → promotions.id (**ON DELETE CASCADE**); promotion_products.product_id → products.id.
- orders.shipping_rule_id → shipping_rules.id.
- order_items.order_id → orders.id; variant_id → product_variants.id; product_id → products.id.
- payments.order_id → orders.id, also its primary key (one payment record/order).
- order_status_history.order_id → orders.id.
- reviews.product_id → products.id; review_reports.review_id → reviews.id.
- refunds.order_id → orders.id with a UNIQUE constraint (one full refund/order).

Every other foreign key has the default NO ACTION deletion/update behavior. Orders/customer records are not cascade-deleted when an Auth user is deleted; retention/anonymization needs a separately reviewed workflow. Audit actor and request-limit user IDs deliberately have no FK here. JSON cart items, shipping snapshots and compatibility arrays do not have relational FKs. Exact constraint definitions are in the appendix.

## 3. RLS for every table and effective permissions

All 23 application tables enable RLS. None disables RLS or uses FORCE. The installer creates 31 policies. Policies are permissive (applicable policies combine with OR); table/column privileges are also required. The following describes intended permissions after the proposed least-privilege correction; current inherited-privilege defects are documented above.

- `admin_members`: no client policy or client data access. Membership is provisioned through a trusted administrative SQL/server process. Users cannot promote themselves.
- `profiles`, `customer_addresses`, `carts`: authenticated SELECT/INSERT/UPDATE/DELETE only where the owner ID equals auth.uid(), with matching WITH CHECK. An administrator does not gain automatic access to other customers' profiles/addresses/carts.
- `categories`: public read; catalogue CRUD only for MFA admins.
- `products`: public reads only published rows; catalogue CRUD for MFA admins.
- `product_variants`: public reads only active variants of published products; catalogue CRUD for MFA admins.
- `inventory`: public reads only through active/published variant visibility; catalogue CRUD for MFA admins.
- `shipping_rules`: public reads only approved rows; catalogue CRUD for MFA admins.
- `promotions`: public reads only active/current date-window rows; catalogue CRUD for MFA admins.
- `promotion_products`: public reads only linked active promotions (the promotion's own visibility also applies); catalogue CRUD for MFA admins.
- `orders`: authenticated reads of own orders or MFA admin reads; no direct client writes. Creation through `place_order`, management through `admin_order`/trusted payment functions.
- `order_items`, `payments`, `order_status_history`: authenticated reads through own parent order or MFA admin; no direct client writes.
- `reviews`: approved rows public; own pending reviews visible to their author; all visible to MFA admin. Creation/editing through verified-purchase `submit_review`; moderation by MFA admin. The proposal limits direct admin UPDATE to approval only.
- `review_reports`: authenticated inserts only with own user ID; MFA admin reads only. No client UPDATE/DELETE.
- `admin_audit_logs`: MFA admin SELECT only; written by trusted functions/triggers/backend.
- `webhook_events`, `request_limits`: no client policies; trusted backend/function use only.
- `store_settings`: public SELECT; UPDATE only for MFA admin; no client INSERT/DELETE. The singleton exists from installation.
- `contact_messages`: customer reads own messages; MFA admin reads all; insertion via authenticated, rate-limited `send_contact`; admin UPDATE. The proposal restricts that UPDATE to handled only.
- `refunds`: customer reads own order's refund; MFA admin reads all; no direct client writes. Full refunds require the MFA-admin workflow and trusted PayPal confirmation.

`is_admin()` requires both an existing admin_members row and an `aal2` session claim from verified MFA. It does not use customer-editable profile metadata. Email/Google identity is handled by existing Supabase Auth, not duplicate password tables. The service role bypasses RLS and stays inside Edge Functions; its key and PayPal secret must never enter public config or browser bundles.

## 4. Payment security

### PayPal

- Browser supplies variant IDs/quantities and an order ID, never an authoritative price or paid flag.
- `store-api` verifies the user's session with Supabase, rate-limits requests and checks order ownership before payment actions.
- PayPal orders are created on the server using database totals/USD currency, expected merchant and saved shipping address. Stable provider request IDs support retries.
- Capture/reconcile fetch the provider's order. Validation requires the expected provider order ID, COMPLETED state, exactly one purchase unit/capture, matching internal order reference, expected merchant ID, completed capture, exact amount and currency.
- The database confirmation RPC is service-only, checks the stored order total/currency, unique capture ID and reservation state, and preserves paid/refunded states on replay. It does not itself call PayPal; correctness depends on the Edge verification boundary.
- Webhooks verify PayPal's signature using the configured webhook ID, then fetch and validate the provider record rather than trusting the browser/event amount. Event IDs are stored for replay handling. Refund/reversal/denial/pending events create reconciliation alerts; they do not implement complete automated dispute accounting.
- Refunds are full-only, at most one request/order. MFA admin initiates; the Edge function calls the capture refund API with a stable refund request ID, checks returned status/amount/currency and finalizes through a service-only RPC. Apply the proposed missing-proof/retry-identity correction before approval.

### Zelle

- Recipient details come from server configuration for the customer's eligible order. The browser can submit a transaction reference only; this never marks the payment paid.
- MFA admin must independently verify actual bank receipt and use `admin_order('verify_zelle', bank_reference)`. Stored order total/currency are used, verification actor/time are recorded, and the unique `zelle:` capture identifier prevents simple receipt reuse.
- There is no Zelle bank API verification or screenshot upload in this implementation. Trust rests on the administrator's actual bank check. A typed reference alone is not proof.
- Refund confirmation likewise requires a real bank refund reference entered by MFA admin; the application cannot verify the external transfer.
- The generic unpaid reservation is 30 minutes. Zelle timing, late receipts, stock holds and reconciliation need an owner-approved procedure. Expired/released orders cannot simply be marked paid; reconcile/refund/re-order without silently reselling reserved stock.

Missing hosted configuration/testing: deployed Edge Functions; SITE_ORIGIN; PayPal sandbox/live client ID, server secret, merchant ID and webhook ID; Zelle recipient; webhook endpoint setup; authenticated gateway behavior; end-to-end capture/replay/refund tests. Keep secrets in the platform's server-side secret manager, not chat or frontend files.

## 5. Inventory protection and order consistency

- Checkout is blocked by both DB checkout/policy flags until approved; the frontend also gates launch. The SQL installation does not open checkout.
- `place_order` requires authentication, serializes same-user requests with an advisory transaction lock, and reuses the unique user/request ID without deducting stock again. It caps open pending/processing reservations, validates 1–100 unique variant lines with quantities 1–99 and checks complete shipping details/configured tax.
- Products are locked for shared reading, then variant/inventory rows are locked in sorted variant order for updates. Price/stock/publication checks and authoritative best exclusive promotion calculations occur on the server.
- In one transaction it stores financial/address/item snapshots, allocates discount cents, reduces inventory, creates payment record and records initial status. Any failure rolls the transaction back; inventory has a nonnegative CHECK.
- Only approved matching country/state shipping rules with a configured tax rate are accepted. Shipping/free-shipping/tax are calculated from the current server data. This is a simple configured tax calculation, not a tax-compliance service.
- `begin_capture` locks and moves a valid PayPal order to processing before an uncertain external capture. Expiry excludes processing payments so it cannot resell stock while payment status is unresolved.
- `release_order` locks/rechecks the order and restores stock at most once; it rejects release of paid/refunded/processing payments. Expiry releases only pending expired orders. Paid orders cannot be casually cancelled; reconcile/refund first.
- Fulfillment advances payment_verified → processing → shipped → delivered, requiring verified paid state and carrier/tracking at shipment.
- Refunds do not automatically restock returned goods. Admin verifies return condition and separately changes stock.
- Still required: real PostgreSQL multi-connection race/deadlock tests, simultaneous last-unit purchases, concurrent cancellation/capture/expiry, provider timeouts and failed webhook retries. PGlite sequential tests do not establish these guarantees under hosted concurrency. Promotion/shipping edits concurrent with checkout also warrant tests.

## 6. Functions, triggers and indexes

The final catalogue contains 17 functions (earlier versions are replaced inside the installation transaction):

- Authorization: `is_admin()`.
- Trigger helpers: `audit_change()`, `record_order_status()`, `guard_product_publication()`, `validate_order_insert()`.
- Customer RPCs: `place_order(jsonb,jsonb,uuid,text,uuid)`, `submit_review(uuid,integer,text,text)`, `send_contact(text,text)`.
- MFA-admin RPCs: `admin_order(uuid,text,text,text)`, `request_full_refund(uuid,text)`, `admin_store_summary()`.
- Trusted backend RPCs: `release_order(uuid)`, `expire_reservations()`, `confirm_payment(uuid,text,integer,text,uuid)`, `limit_request(uuid)`, `begin_capture(uuid)`, `finish_paypal_refund(uuid,text,integer,text,boolean)`.

All except publication validation are SECURITY DEFINER; the generated appendix includes every final body, signature, return type, search path and effective execute grant from the simulation. Trigger helpers are not exposed as customer RPCs. The existing platform `rls_auto_enable` is not among these 17 and is never replaced.

There are 17 application triggers: order status history; audit on the seven catalogue/configuration tables, orders/payments/reviews/admin_members; product publication validation; checkout validation; contact update audit; refund insert/update audit; launch-settings update audit. There is no Auth-user trigger and no SQL-trigger network call.

There are 39 indexes including PK/UNIQUE support. Seven explicit query indexes: `orders_user(user_id, created_at DESC)`, `items_order(order_id)`, `variants_product(product_id)`, `reviews_product(product_id, approved)`, `history_order(order_id)`, published `products_category(category_id)`, and English full-text `products_search` over name/brand/model. Every index definition is listed under its table in the appendix.

No Cron job is installed. The trusted reservation-expiry function must be scheduled after approval; never expose a public expiry/SQL RPC. Stuck processing payments need reconciliation, not forced stock release.

## 7. Frontend compatibility

Source review matched these actual callers to the schema:

- `js/api.js`: published products joined with categories, variants/inventory and reviews; active flags and local approved image paths.
- `js/customer.js`: own orders with item/status/payment joins, profiles upsert, addresses insert/delete, own reviews. All referenced FKs/columns exist.
- `js/app.js` and checkout helpers: saved addresses, shipping/settings, cart sync, Edge order/payment actions. Server recalculates browser estimates.
- `js/bundles.js`: promotions and product mapping, fixed/percentage discounts and quantity/bundle eligibility.
- `js/admin.js`, `js/admin-records.js`, `js/admin-editor.js`: MFA RPC, summary, catalogue variants/stock/configuration, order workflow, review approval, support handled flag, audit log and refund action. The column-specific correction preserves these UI operations.
- `js/api.js` Supabase Auth client uses PKCE, persisted session and refresh; existing Email/Google providers are reused.

**Storage: no bucket is required by this frontend.** Images are deployed static files under `images/`; the application rejects arbitrary remote image paths. Zelle uses reference text. Future product-image uploads or private payment evidence require explicit UI/server changes, bucket limits and narrowly scoped policies. The installer intentionally creates no Storage buckets/policies and never edits internal Storage tables. [Supabase Storage schema guidance](https://supabase.com/docs/guides/storage/schema/design).

Compatibility is established by code inspection and local tests, not by hosted integration. A real post-install check must cover all nested PostgREST joins, permission errors, admin edits, two-customer isolation and authentication expiry.

## 8. Exact SQL, conflicts and changes

Review these files together:

- `supabase/setup/install-store.sql`: **complete existing installer**, unchanged, ten source migrations in one transaction. Do not apply this version yet.
- `supabase/setup/review-hardening-proposal.sql`: **complete proposed correction**, not merged and not executed remotely. Intended placement is after all ten migration bodies and before NOTIFY/COMMIT in a newly reviewed atomic installer. It has no independent BEGIN/COMMIT because it is a proposed transaction fragment, not an instruction to run a second script after an unsafe commit.
- `SCHEMA-AND-POLICIES.md`: full final installed schema/policy/function/index/trigger definitions from the original SQL. The proposal changes grants/search paths/refund function only; it adds no tables/columns/policies.
- `catalogue.json`: full structured evidence, baseline grants and local correction results.

The installer takes an installation advisory transaction lock, checks for existing public application table/view/foreign-table names and any function bearing one of its 17 application names, and aborts before replacement on a collision. It refuses a rerun. Other type/index/sequence name conflicts can also cause an ordinary SQL error; they are not overwritten and the transaction rolls back. Use a trusted SQL session with the intended public schema resolution and no concurrent schema changes.

There is no DROP, TRUNCATE, table rename, RLS disable, Storage DDL/DML, Auth schema modification, or blanket existing-function replacement. Later `ALTER TABLE` and `CREATE OR REPLACE FUNCTION` statements target objects created earlier within this transaction. There is one intentional cascade rule on future promotion-product cleanup, not deletion of existing data during setup.

The original installer includes grants/revokes scoped to application names; the proposed correction resets ALL privileges only on those 23 new application tables, their two sequences and 17 functions. It does not revoke Storage defaults, alter global default privileges, or touch existing unrelated public functions. Service-role access remains trusted and broad by design. The public-schema CREATE/bypass guard fails closed and requests investigation rather than changing platform permissions.

Installation NOTIFY requests a PostgREST schema-cache reload after commit. It does not deploy Edge Functions, provision admin membership, configure OAuth/MFA/payment credentials, seed catalogue/shipping/tax data, create buckets, schedule Cron or enable checkout.

The installer does not write `supabase_migrations.schema_migrations`. Missing CLI history is normal for a project with no CLI-managed application migrations. Dashboard SQL does not automatically establish the CLI baseline; choose and document one workflow before future migrations. Do not apply both this first-install file and the individual source migrations to the same project or fabricate history blindly. [Supabase migration tracking](https://supabase.com/docs/guides/deployment/database-migrations).

## 9. Rollback and deployment gates

Before an approved installation: obtain a supported backup/export of schema, grants, functions and data; verify how it can be restored. Confirm available backup/PITR features in the project's plan rather than assuming them. Save the audit output, source SQL, manifest and approved installer hash. Test the final corrected transaction on a staging copy with the actual role defaults/event triggers.

During installation: BEGIN/COMMIT wraps the full installer. Any failure aborts the transaction; issue ROLLBACK in that failed session. Do not continue by running later fragments. An abandoned open transaction must be rolled back. Event-trigger external side effects, if any, cannot be assumed transactional; this is another reason the existing trigger body must be reviewed first.

After successful commit, before customer use: keep checkout disabled, validate all objects/grants/policies and run hosted tests. If the installation must be removed, first prove the application tables contain no business data, identify dependencies and separately review a reverse-dependency application-only uninstall. Do not use DROP SCHEMA public/storage/auth or CASCADE as a generic rollback. No destructive rollback SQL is supplied or authorized here.

After orders/payments exist: disable checkout and pause appropriate background work through a trusted operator; preserve pending provider/webhook reconciliation. Prefer a forward corrective migration. A database restore may lose subsequent records and cannot reverse PayPal/Zelle bank movements. Reconcile external payments against restored orders before resuming, and retain audit/history/customer-data backups under the owner's retention rules. Restoring the whole Supabase project can also affect Auth and unrelated data; plan the scope explicitly.

Approval gates, in order:

1. Execute and review the hosted read-only follow-up; verify the existing auto-RLS event trigger, trusted schema privileges, API roles, bucket visibility and other custom schemas.
2. Review the complete unchanged SQL plus the proposed correction; incorporate accepted corrections into one new installer and publish its new hash for approval. This review does not authorize applying either file.
3. Test that final installer on staging with the real role/default-grant configuration and event trigger. Confirm least-privilege grants and no changes to Storage/Auth/unrelated objects.
4. After explicit approval, apply the approved transaction once and verify the schema/cache. Provision the owner's existing Auth account as an administrator through a separately reviewed trusted action; enroll and verify MFA.
5. Deploy/configure the backend and expiry/reconciliation operations; test Email/Google, session/logout, two-user record isolation, MFA-only admin actions, hostile price/payment/stock attempts, concurrency and PayPal/Zelle/refunds.
6. Approve real product data, shipping/tax/policies and Zelle hold/late-payment procedure. Enable checkout only after integration acceptance succeeds.

**Status: review package prepared; original installer unchanged; hosted follow-up audit outstanding; no Supabase installation executed; not production-ready.**
