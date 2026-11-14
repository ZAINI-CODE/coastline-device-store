# Final installer review for approval — 2026-11-03

**Prepared locally; awaiting owner approval. No installer or correction was executed on Supabase. Checkout remains disabled. This is not a production-readiness claim.**

## Complete SQL and version

Review the whole file: [install-store.sql](../../../supabase/setup/install-store.sql). It incorporates all eleven source migrations, including `011_application_privileges.sql`; there is no separate patch to run.

SHA-256:

`7750584909226e1e0497ab925614f5b976a86a1b4473cf38ef4c3dbba3325cc1`

The original ten-migration installer remains archived as `original-installer.sql` beside this document, with historical hash `35ebde2611c10fea2f34bbb5b2f1d19c5db0acd5b8c6d9959a1e8cbf93acc3ff`. Do not run that archive or `review-hardening-proposal.sql`. Both are superseded by the consolidated installer.

The complete current schema, exact constraints/FKs, policy predicates, final function bodies, triggers and indexes are in [final/SCHEMA-AND-POLICIES.md](final/SCHEMA-AND-POLICIES.md); [final/catalogue.json](final/catalogue.json) includes effective table grants from the local broad-default simulation. These artifacts match the new installer hash.

## Hosted follow-up assessment

Evidence is the owner's SQL Editor result, received 2026-11-03, recorded in `storage-followup-2026-11-03.json`. The agent did not execute the hosted audit. The supplied complete function body is transcribed in `tests/fixtures/audited-auto-rls.sql` for local compatibility testing.

- **Normal defaults:** anon/authenticated have no superuser, role-creation, database-creation or RLS-bypass powers. service_role has RLS bypass, as intended for trusted server operations. Never expose its key in the frontend.
- **Positive prerequisite:** anon, authenticated and PUBLIC cannot CREATE in the public schema. The API roles therefore cannot inject objects there through the audited schema privilege.
- **Storage:** buckets is empty; there are no uploaded-bucket access rules to repair. The earlier Storage RLS/grants remain untouched. This frontend uses static product-image files and transaction-reference text, so it requires no Storage bucket or upload policy now.
- **Custom schema inventory:** no relations appear in the follow-up's other-user-schema scope. Together with the earlier public-schema inventory, no conflicting store schema is evidenced. This is a scoped inventory, not a claim that managed Auth/Storage schemas or the whole database are empty. The installer rechecks name collisions at execution time.
- **Existing auto-RLS function:** postgres-owned, RETURNS event_trigger, SECURITY DEFINER with search_path=pg_catalog. It examines database-reported DDL objects, restricts work to public tables and quotes schema/table identifiers with `%I`. It contains no user-supplied SQL concatenation or network action.
- **Event binding:** enabled `ensure_rls` runs at ddl_command_end for CREATE TABLE, CREATE TABLE AS and SELECT INTO. The observed function and binding are consistent with its protective purpose.
- **Important recommendation:** its inner EXCEPTION WHEN OTHERS logs an RLS-enable failure but does not rethrow. A future unrelated CREATE TABLE could therefore succeed without the intended protection if ALTER TABLE fails. It should not be the sole security control. Our installer explicitly enables all 23 table RLS flags, then checks them before commit; a failed explicit ALTER aborts the transaction. No change to the existing trigger is necessary for this installation.
- **Function ACL:** null ACL means default privileges; the report explicitly confirms anon/authenticated EXECUTE. This is not a callable general SQL runner. PostgreSQL restricts event-trigger functions to event-trigger invocation; the local test confirms direct anon invocation is rejected. Removing that grant is optional hardening for a separately reviewed platform-function change, not a required blind revoke. We preserve the existing definition and ACL.

The follow-up no longer blocks preparation of the installer. It does not validate application policies that have not been installed, nor rule out later database changes, unusual role memberships or other event triggers outside this audit's filter.

References: [PostgreSQL event-trigger behavior](https://www.postgresql.org/docs/current/event-trigger-definition.html), [function and SECURITY DEFINER security](https://www.postgresql.org/docs/current/sql-createfunction.html), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## 1. Schema and table list

23 public application tables:

- Identity/customer: `admin_members`, `profiles`, `customer_addresses`, `carts`.
- Catalogue: `categories`, `products`, `product_variants`, `inventory`.
- Pricing/configuration: `shipping_rules`, `promotions`, `promotion_products`, `store_settings`.
- Orders/payments: `orders`, `order_items`, `payments`, `order_status_history`, `refunds`.
- Community/support: `reviews`, `review_reports`, `contact_messages`.
- Internal operations: `admin_audit_logs`, `webhook_events`, `request_limits`.

Seeds are only five category names and the disabled singleton store settings. There are no sample users, memberships, products, prices, stock or purchases. Existing Supabase Email/Google users are reused; passwords are not stored in application tables.

Every column's type, nullability, default, identity definition and CHECK/UNIQUE constraint is listed in the complete current appendix.

## 2. Relationships

- Auth user FKs: admin membership, profile, addresses, cart, order owner, payment verifier, review author, report author, contact author and refund requester.
- Category → products → variants → inventory.
- Promotions ↔ products through promotion_products; deleting a promotion cascades only its join rows.
- Shipping rule → orders.
- Order → items, payment, status history and refund; one payment/order and at most one full refund/order.
- Item → product and variant; review → product; report → review.

All other FKs default to NO ACTION; deleting a user/product does not erase purchase records automatically. Saved carts, address snapshots and compatibility UUID arrays do not have relational FKs. The exact full FK list is in the appendix, including nullable references. Account deletion/retention needs a separate workflow.

## 3. RLS on every application table

All 23 enable RLS, with 31 policies. None disables or forces RLS. Applicable policies combine permissively, and table/column privileges are additionally required.

- `admin_members`: no client policy/access. Trusted admin provisioning only.
- `profiles`, `customer_addresses`, `carts`: authenticated CRUD of own rows only, including ownership WITH CHECK. MFA admins do not gain blanket access to these private tables.
- `categories`: public read; MFA-admin catalogue CRUD.
- `products`: published public reads; MFA-admin catalogue CRUD.
- `product_variants`: active variants of published products public read; MFA-admin CRUD.
- `inventory`: public reads through visible active variants; MFA-admin CRUD.
- `shipping_rules`: approved public reads; MFA-admin CRUD.
- `promotions`: active/current-window public reads; MFA-admin CRUD.
- `promotion_products`: public reads through eligible parent promotion visibility; MFA-admin CRUD.
- `orders`: customer reads own; MFA admin reads all. No direct client writes.
- `order_items`, `payments`, `order_status_history`: reads through own parent order or MFA admin. No direct client writes.
- `reviews`: approved public reads; author reads own pending rows; MFA admin reads all. Verified-purchase RPC handles customer submissions. Only MFA admin can UPDATE the approval column.
- `review_reports`: customer INSERT with own identity; MFA-admin SELECT. No client update/delete.
- `admin_audit_logs`: MFA-admin SELECT; trusted append operations only.
- `webhook_events`, `request_limits`: no client policies/access; server-only operations.
- `store_settings`: public SELECT; MFA-admin UPDATE; no client insert/delete.
- `contact_messages`: customer reads own; MFA admin reads all and updates handled only. Rate-limited customer submission RPC.
- `refunds`: customer reads own order's refund; MFA admin reads all. Trusted refund functions perform writes.

No application TRUNCATE/TRIGGER/REFERENCES permission is retained by PUBLIC/anon/authenticated in the broad-default simulation. Privilege reset targets these new app objects only, not Storage, Auth, unrelated functions or global default privileges. PostgreSQL RLS does not itself protect TRUNCATE; the installer also verifies that neither API role retains that privilege before commit.

## 4. Customer versus administrator

Customers may edit their own profile/addresses/cart, read own purchases, submit verified-purchase reviews/contact requests, and use authenticated order/payment endpoints. They cannot set authoritative prices/totals, payment status, stock, role membership or audit entries.

Admin access requires both a trusted `admin_members` row and a Supabase `aal2` MFA session. Catalogue/configuration edits and order-management RPCs enforce that condition in the database. Profile metadata cannot grant administrator status. The installer does not auto-promote the first registered user; owner membership is a later separately approved trusted action.

Service-role functions bypass RLS by design and must remain server-side. Secrets belong in Supabase's server secret manager, never public env/config/build output.

## 5. Payment security

**PayPal:** verified user + own order; server-generated amount/currency/merchant; stable provider request IDs; server capture/reconciliation fetch; exact order/reference/merchant/capture/amount/currency/status matching; service-only confirmation RPC; unique capture IDs and paid/refunded replay guards. Webhooks verify PayPal signatures and fetch provider state before confirmation. Full refunds use an MFA-admin request, stable provider refund request ID, server validation and a service-only finalizer. Migration 011 rejects NULL/empty refund proof, non-PayPal order finalization and a changed provider refund ID on retries.

**Zelle:** customers submit only a reference; it cannot mark an order paid. MFA admin independently checks actual bank receipt, enters a receipt reference, and verifies through the guarded RPC. Verification actor/time and unique receipt identity are recorded. Bank refunds require actual refund-reference confirmation. No bank API or screenshot verification is claimed.

The database cannot independently prove an external bank transaction; correct Edge deployment and real bank/provider verification remain essential. Refund/reversal/denial/pending webhooks generate reconciliation alerts; complete automated disputes/partial refunds are outside this implementation. Refunds do not automatically restock goods.

Still needed: server payment secrets/configuration, PayPal sandbox tests, webhook deployment/signature/retry tests, Zelle recipient and agreed handling of 30-minute reservations/late bank receipts. Checkout stays disabled.

## 6. Inventory and order consistency

Authentication, a per-customer transaction lock, request idempotency, unique variant/quantity checks, a cap on open reservations, ordered variant/inventory locks, published/active/stock checks and authoritative server pricing guard order placement. Approved matching shipping/tax configuration is required.

Order/address/item/price/discount snapshots, stock deduction, payment row and initial history are committed together. Invalid stock or any SQL failure rolls the operation back. Expiry/cancellation restores stock once after locking/rechecking state. Processing payments are held for reconciliation so uncertainty cannot release stock automatically. Paid orders require refund/reconciliation rather than cancellation. Fulfillment transitions and shipment tracking are validated.

This is supported by sequential local PostgreSQL tests, not yet by hosted multi-connection concurrency tests. Last-unit races, capture/expiry/cancel races, promotion/configuration edits and provider timeouts remain acceptance tests.

## 7. Functions, triggers and indexes

17 functions: `is_admin`, `audit_change`, `record_order_status`, `place_order`, `release_order`, `expire_reservations`, `confirm_payment`, `submit_review`, `admin_order`, `limit_request`, `guard_product_publication`, `validate_order_insert`, `begin_capture`, `send_contact`, `request_full_refund`, `finish_paypal_refund`, `admin_store_summary`.

All app function search paths explicitly put `pg_temp` last. Customer RPC, MFA-admin RPC and service-only RPC execution grants are separated; trigger functions are not granted to API users. Publication validation is SECURITY INVOKER; the other functions are SECURITY DEFINER with authorization checks and restricted execution.

17 row triggers handle publication/checkout validation, order history and selected administrative audit events. 39 indexes include PK/UNIQUE support and seven explicit catalogue/order/review query indexes. The appendix gives every exact signature/body/trigger/index definition. Existing platform event-trigger definition, owner and ACL are preserved.

Cron is not installed; trusted expiry scheduling and stuck-payment reconciliation are later operational setup.

## 8. Conflicts, destructive SQL and compatibility

The final SQL is one transaction with a fixed local installation search path. It takes an install lock, refuses application relation/function-name collisions, checks schema/API-role security, installs the eleven migration bodies, verifies all 23 RLS flags and no client TRUNCATE access, requests a schema-cache reload, then commits.

There is no DROP, TRUNCATE, RLS disable, global privilege reset or internal Storage/Auth alteration. Later ALTER TABLE/function replacement statements act on app objects created earlier in this same transaction. The original auto-RLS trigger is exercised during CREATE TABLE but not modified. Name conflicts with other indexes/types/sequences can cause a safe transaction abort; they are not silently overwritten. A rerun intentionally refuses.

The final permissions match current frontend calls: published nested catalogue queries, own profile upsert/addresses/cart, nested order/payment/history reads, bundle estimates, guided admin catalogue edits, settings UPDATE, approval-only moderation, handled-only support actions and guarded payment/order/refund RPCs. Exact required columns/FKs exist. Browser/hosted PostgREST behavior is still untested against installed tables.

No CLI migration-history rows are invented. Choose/document a baseline workflow before future CLI deployment; do not apply both the consolidated file and individual migrations. No bucket, cron schedule, admin user, Edge Function, OAuth setting, payment secret, real catalogue data or checkout launch is provisioned by this transaction.

## 9. Rollback and remaining acceptance

Before applying: approve this exact hash, take/verify an available backup/export and restoration method, and test on a staging copy where available. Backup/PITR availability depends on the project's configured plan. Recheck drift if schema or roles changed since this audit.

During a failure: roll back the aborted transaction; do not run remaining fragments. No application objects/data from this transaction should commit. The reviewed existing event trigger has only transactional database/log effects, with no external payment/network side effects.

After commit: keep checkout disabled and verify schema, grants, policies, nested queries, two-user isolation and MFA administration. Before any business data exists, a removal would require a separately reviewed application-only reverse-dependency plan; no destructive uninstall is supplied. Once orders/payments exist, prefer forward fixes, backups and controlled checkout shutdown. A restore cannot reverse PayPal/Zelle transfers; reconcile external funds and pending events before reopening. Do not drop public/Auth/Storage schemas or use generic CASCADE rollback.

Local checks completed: all 17 automated tests pass, including the actual supplied event-trigger body/binding, preservation of Storage rows/grants and platform function definition/ACL, broad default grants, blocked client TRUNCATE/payment RPC access, function paths, missing/refund-identity proof rejection, guarded rerun/collision behavior and customer/admin order flows.

Remaining hosted acceptance: apply only after approval; audit installed grants/RLS; provision owner membership/MFA; deploy authenticated Edge Functions; test Email/Google/logout/persistence with actual users; test two-customer isolation, hostile writes and admin-only actions; test concurrent orders and payment/webhook/refund failure/retry paths; configure expiry/reconciliation; approve real catalogue/shipping/tax/policies and Zelle timing. Enable checkout only after these succeed.

**Next decision: review and approve this consolidated SQL for a one-time installation. Approval has not yet been given.**
