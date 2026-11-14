# Final database migration safety review

Reviewed 6 November 2026 (Asia/Karachi).

**Recommendation: conditional approval for a guarded first installation with checkout disabled, after a verified backup and fresh schema-drift check. This is not an approval to launch transactions. Do not treat this installer as a no-op rerunnable migration.**

No SQL was executed during this review, including locally. No hosted project connection, configuration change, database write or deployment was performed. The review used source inspection, exact hash/source comparisons, the existing hash-matched local PostgreSQL catalogue and earlier test evidence. The current hosted database may have changed since the owner's prior audits; that state was not re-audited this turn.

## Exact reviewed artifact and complete inventory

Installer: `supabase/setup/install-store.sql`.

SHA-256: `7750584909226e1e0497ab925614f5b976a86a1b4473cf38ef4c3dbba3325cc1`.

All eleven embedded source migrations match the current source files byte-for-byte. The existing final-state catalogue identifies the same hash. The installer, its manifest and all source SQL remain unchanged.

[COMPLETE-INVENTORY.md](COMPLETE-INVENTORY.md) lists every table and column, all 196 catalogued constraints (including NOT NULL), all 24 foreign keys, all 39 index definitions, all 17 explicit row-trigger definitions, all 31 named RLS policies with predicates, all 17 final function definitions and EXECUTE permissions, two identity sequences, all 48 explicit GRANT/REVOKE statements and all 30 explicit ALTER statements in execution order. [static-evidence.json](static-evidence.json) records the filesystem-only checks. This is the exhaustive object/permission appendix, not a selected summary.

### All 23 application tables

- Customer identity and preferences: `profiles`, `customer_addresses`, `carts`.
- Catalogue and stock: `categories`, `products`, `product_variants`, `inventory`.
- Checkout and offers: `shipping_rules`, `promotions`, `promotion_products`, `store_settings`.
- Orders and money: `orders`, `order_items`, `payments`, `order_status_history`, `refunds`.
- Community and support: `reviews`, `review_reports`, `contact_messages`.
- Trusted operations: `admin_members`, `admin_audit_logs`, `webhook_events`, `request_limits`.

### Immediate effects

The transaction creates application objects and their grants, then seeds five category names and one disabled settings row. The category INSERT triggers also create five audit rows. It does not seed products, prices, stock, customers, admin membership, orders or payments.

The category seeds are the older `Smartphones`, `Audio & Accessories`, `Gaming`, `Computers` and `Computer Components` names. They do not match the six approved frontend category names; reconcile category records before importing/publishing the real catalogue. Checkout starts with `checkout_enabled=false`, `policies_approved=false`, `max_open_reservations=5`.

The installer sets a transaction-local search path, acquires an installation advisory lock, checks collisions/security prerequisites, requests a PostgREST schema-cache refresh and commits. It installs no extensions, cron jobs, buckets, secrets, OAuth providers, Edge Functions or CLI migration-history records.

## Preservation of the existing project

There is no top-level DROP, TRUNCATE, DELETE, UPDATE, RLS disable, role alteration or global default-privilege reset. Data-updating SQL inside stored function definitions does not run merely because the functions are created. Application-only ALTER statements and CREATE OR REPLACE FUNCTION statements target objects created earlier in the same transaction, after the collision guard has excluded existing application objects/functions.

The guard refuses any existing application table/view/materialized view/foreign table or matching application function name. Unanticipated index/type/sequence collisions can still cause an error later, but the transaction should abort rather than overwrite those objects. No blanket IF NOT EXISTS hides a partial or incompatible schema.

No existing Auth user, identity, password, session, provider setting, Google client secret, redirect URL, email setting, Storage row/grant/policy, or unrelated function is explicitly replaced or removed. The audited `rls_auto_enable` function and `ensure_rls` event binding are not edited. The existing event trigger can run on newly created application tables; explicit RLS statements/postconditions provide independent protection.

**Important qualification:** ten new foreign keys reference existing `auth.users(id)`. PostgreSQL creates corresponding internal referential-integrity triggers/dependencies on child and parent tables. Thus it would be inaccurate to claim literally no new object is associated with Auth. These are engine-managed FK enforcement mechanisms, not modifications to the login/OAuth configuration or user records. They can block deletion or ID changes of users referenced by store data. The installer supplies no account deletion/anonymization workflow. New FKs can also take locks on their referenced tables during installation, so use a quiet maintenance window and a trusted SQL client with stop-on-error behavior.

The only ON DELETE CASCADE is the promotion-to-promotion_products join relationship. It applies to a future deletion of a new promotion; installation does not delete any promotion or other data. All other FKs use NO ACTION. Existing Auth deletion behavior can consequently become more restrictive once customers have store records.

This preservation assessment assumes the prior audited platform roles and event trigger remain unchanged. Arbitrary additional privileged event triggers, role memberships, custom default grants or concurrent untrusted DDL are outside that evidence. Recheck those before applying; the current preflight does not exhaustively audit all inherited custom-role powers.

## RLS and permissions

All 23 application tables explicitly enable RLS. FORCE RLS is not used; trusted owners/service-role operations can bypass it. That is an intentional server trust boundary, not proof that frontend service-role access would be safe. Supabase documents how [RLS and service keys](https://supabase.com/docs/guides/database/postgres/row-level-security) interact.

For ordinary authenticated customers:

- `profiles`: SELECT/INSERT/UPDATE/DELETE only when `id=auth.uid()`. The same ownership predicate is the WITH CHECK condition, so changing ownership to another user is denied. Deleting a profile does not delete an Auth account.
- `customer_addresses`, `carts`: own rows only, using and checking `user_id=auth.uid()`.
- `orders`: SELECT only for own `user_id`, or a verified MFA administrator. No direct client INSERT/UPDATE/DELETE privilege or policy.
- `order_items`, `payments`, `order_status_history`, `refunds`: SELECT only through an accessible parent order owned by the customer, or an MFA administrator. No direct client writes.
- `inventory`: public SELECT for active variants visible through variant/product RLS. Ordinary customer INSERT/UPDATE/DELETE is denied by the admin-only policy. Exact stock counts are intentionally publicly readable; change that design before launch if stock quantities should be confidential.
- `reviews`: approved reviews are public; authors can read their own pending review. A verified-purchase RPC writes reviews; moderation requires admin MFA and grants UPDATE only on `approved`.
- `review_reports`: INSERT with own user identity; SELECT only for admin MFA. No client UPDATE/DELETE.
- `contact_messages`: customer reads own messages; admin MFA can read all and UPDATE only `handled`. Authenticated, rate-limited RPC handles submission.
- `admin_members`, `request_limits`, `webhook_events`: no client policies/access. `admin_audit_logs`: SELECT only for admin MFA, no direct client writes.

Catalogue/configuration reads are deliberately public: categories; published products; active variants of published products; eligible inventory; approved shipping rules; current active promotions and their joins; approved reviews; singleton store settings. These tables must never contain secrets. The grant list is not customer authorization by itself: RLS further limits the authenticated role's catalogue writes to administrators.

The final explicit table grants are:

- anon/authenticated SELECT on `categories`, `products`, `product_variants`, `inventory`, `shipping_rules`, `promotions`, `promotion_products`, `reviews`, `store_settings`.
- authenticated SELECT/INSERT/UPDATE/DELETE on own `profiles`, `customer_addresses`, `carts`, enforced by RLS.
- authenticated SELECT on `orders`, `order_items`, `payments`, `order_status_history`, `admin_audit_logs`, `review_reports`, `contact_messages`, `refunds`, enforced by their policies.
- authenticated INSERT on `review_reports`; UPDATE(approved) on `reviews`; UPDATE(handled) on `contact_messages`; UPDATE on `store_settings`.
- authenticated INSERT/UPDATE/DELETE on `categories`, `products`, `product_variants`, `inventory`, `shipping_rules`, `promotions`, `promotion_products`, all subject to `is_admin()`.
- service_role ALL table privileges on all 23 application tables; USAGE/SELECT on the two identity sequences.
- PUBLIC/anon/authenticated application table privileges are reset before the narrow final grants. Their privileges on the two application sequences are removed. No Storage/Auth/global-default grants are revoked.

The installer verifies no anon/authenticated TRUNCATE access remains; the prior broad-default simulation also recorded no client TRIGGER/REFERENCES grants. RLS does not itself block TRUNCATE. Extra target role membership/default grants must still be reviewed; the earlier local simulation is not a complete current hosted ACL audit.

## Server-side administrator authorization

`is_admin()` checks a trusted `admin_members` row for the verified `auth.uid()` AND the JWT assurance level `aal2`. Customers cannot promote themselves through profiles, user metadata, a frontend flag or direct membership-table writes.

Admin catalogue/inventory/configuration policies call that function. `admin_order`, `request_full_refund` and `admin_store_summary` check it before sensitive work. `refund-order` additionally verifies the signed-in user and calls `is_admin` before requesting the refund. These checks run in PostgreSQL/Edge Functions; the browser's admin screen is not the authorization boundary.

Function EXECUTE is separated:

- anon/authenticated: `is_admin()` only; it returns the caller's authorization boolean, not membership rows.
- authenticated: `place_order`, `submit_review`, `send_contact`; and `admin_order`, `request_full_refund`, `admin_store_summary`, which separately require admin MFA.
- service_role: `confirm_payment`, `release_order`, `expire_reservations`, `limit_request`, `begin_capture`, `finish_paypal_refund`.
- Trigger functions `audit_change`, `record_order_status`, `guard_product_publication`, `validate_order_insert` have no API role EXECUTE grant. Trigger creation/runtime mechanics are distinct from public RPC calls.

Sixteen application functions are SECURITY DEFINER; publication validation is SECURITY INVOKER. All seventeen explicitly set `search_path=public, pg_temp` with pg_catalog implicitly searched first. That depends on public remaining unwritable to untrusted roles, which the installer checks. The existing protective event function retains its separate pg_catalog-only path. [PostgreSQL function security guidance](https://www.postgresql.org/docs/current/sql-createfunction.html) explains these boundaries.

## Inventory, orders, PayPal and Zelle

`place_order` authenticates ownership, serializes reservations per customer, reuses request IDs, limits open reservations, checks cart variants/quantities/stock and calculates authoritative prices/discounts/shipping/tax. Ordered variant/inventory locks and shared product locks protect the checkout snapshot. Items, inventory deductions, payment placeholder and initial status history are created atomically. Customer-supplied price values do not become the charged amount.

`release_order` locks/rechecks the order and restores stock only once for eligible unpaid states. It refuses to release processing/paid/refunded orders. `begin_capture` places an eligible PayPal order into processing; uncertain processing payments intentionally retain stock for reconciliation. Refunds do not automatically restock goods. Promotion/shipping-rule edits during checkout and true multi-connection races still require staging acceptance tests.

PayPal create/capture/reconcile is owned-order scoped in the Edge handler. The server uses database totals, fixed merchant/currency validation, stable provider request IDs, provider state fetches and a service-only confirmation RPC. Unique provider order/capture IDs and refund proof/replay checks protect against repeated state changes. Signed webhook verification precedes database processing. Webhook refund/reversal/denial/pending notifications currently create reconciliation alerts; pending refunds require follow-up reconciliation, and automated disputes/partial refunds are not implemented.

Zelle reference submission cannot mark an order paid. The MFA admin must independently check actual bank receipt and provide its reference. The confirmation RPC records actor/time and a unique capture/reference identity. A manual refund requires actual bank-refund reference confirmation; SQL cannot verify that funds moved. Decide how late transfers after the 30-minute reservation window are handled before enabling Zelle.

Direct authenticated `place_order` RPC calls are permitted by design, so Edge validation is additional protection, not the sole checkout validator. The database still enforces stock/prices/ownership/launch gates. Provider configuration checks in store-api cannot prevent a customer calling the reservation RPC directly; missing provider configuration therefore must be resolved before enabling database checkout.

## Destructive operations and safe repeatability

The complete top-level statement scan found 172 statements, including 48 explicit grant/revoke and 30 alter statements, with zero top-level DROP/TRUNCATE/DELETE/UPDATE/RLS-disable operations. CREATE OR REPLACE updates only newly installed application function versions; no preexisting names are allowed past preflight.

The file is a **guarded first-install transaction**, with safe retry behavior:

1. On a fresh compatible database, execute the complete file once after approval.
2. If any statement fails, roll back the transaction; do not execute remaining fragments or continue to COMMIT after an error. Inspect the cause, then retry the entire reviewed file.
3. After a successful commit, the same file deliberately raises `Installation stopped: existing application objects...` before making changes. No duplicate table or seed row is created.

This is safe refusal, not an idempotent no-op rerun. I recommend retaining it. Adding IF NOT EXISTS or unconditional ON CONFLICT updates would hide incompatible existing objects or overwrite settings. If successful no-op reruns are a strict requirement, hold approval until a separately reviewed migration-version ledger and schema-drift verifier are added; this review does not claim that requirement has already been implemented.

The installer does not create Supabase CLI migration history. Do not run both the consolidated SQL and the eleven individual migrations. Before future CLI pushes, baseline the actually installed migrations through a separately reviewed workflow; never fabricate applied history before confirming installation. No automatic down-migration or reset is supplied.

## Backup and rollback plan

Before installation:

1. Verify exact target project, installer hash, current application/schema inventory, public CREATE rights, API role memberships/default grants and event triggers. Freeze concurrent DDL and choose a quiet window.
2. Take an encrypted logical backup of schema, data and applicable custom roles. On Free, do not assume an automatic restore point/PITR exists. Preserve ownership/grants/policies/function definitions, the existing auto-RLS function/event binding and any migration history. Confirm export scope rather than treating an empty public-schema dump as a full-project backup.
3. Include a specifically verified Auth data export/restore path for users/identities and relevant MFA state if protecting existing accounts. An ordinary CLI schema dump excludes managed schemas and its default does not include data or custom roles. Verify the actual dump contents/tool version and follow supported managed-schema restore procedures. Do not blindly replay managed schema DDL over an existing project.
4. Record current Auth provider enablement, Site URL, redirect allowlist, SMTP/rate-limit configuration and deployed function settings. Keep private secrets in a private recovery process; never copy them into this repository, public build, chat or unencrypted reports. Database backups do not replace configuration/secret recovery.
5. Preserve Storage objects separately if any exist; database backups contain their metadata, not object bytes. Keep local product-image originals and rights records separately.
6. Test restoration into an isolated compatible project/environment and verify counts, constraints, users, RLS/grants and login. Keep the verified encrypted backup off-site with restricted access. No backup/restore was executed by this review.

Supabase recommends off-site exports for Free projects and describes backup coverage in [Database backups](https://supabase.com/docs/guides/platform/backups). See [CLI dump scope](https://supabase.com/docs/reference/cli/supabase-db-dump) and [supported restore guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Review the installed CLI's actual help/dry-run output before using any commands; credentials stay private.

If installation fails before commit: ROLLBACK, confirm no application objects committed, preserve the error, compare the original project inventory, then fix only after review. No payment/network action occurs in the SQL itself. Additional preexisting third-party event-trigger side effects would need separate review.

If installation succeeds but acceptance fails: keep checkout disabled and do not deploy/activate transaction flows. Prefer a forward-only corrective migration. An uninstall before any business data exists requires a separately reviewed reverse-dependency object list and must remove only this installation's objects/FK dependencies; never DROP public/auth/storage or use blanket CASCADE. After customer/order data exists, preserve records and use a reviewed repair or isolated restore/switchover. Restoring an old whole-project backup into the live project can lose later Auth/customer changes and is not a routine rollback.

Database rollback/restore cannot reverse PayPal/Zelle transfers. Reconcile provider/bank funds, refunds, webhook events and fulfilment before reopening; prevent duplicate shipments or charges.

## Free Tier and application compatibility

The schema uses ordinary PostgreSQL tables, JSONB, UUIDs, indexes, PL/pgSQL, RLS and standard Supabase Auth helpers. It does not require a paid database extension, Storage image transformations, branching or PITR. Email/Google and basic MFA are available on Free. Three Edge Functions are within the current Free function-count limit. This is a design compatibility assessment, not a measured capacity or deployed runtime guarantee.

As checked on 6 November, Supabase lists 500 MB database size, 50,000 monthly active users, 500,000 Edge invocations, a 5 GB egress allowance, basic MFA, and possible pausing after one inactive week. Automatic backups/PITR/branching and uptime SLA are not included. Product images remain static-host assets, so they do not consume Supabase Storage unless later uploaded. See [current pricing](https://supabase.com/pricing). Free Edge workers have 256 MB memory, a 150-second wall-clock limit and a 2-second CPU limit per request; real provider timing/bundle usage must be tested under those constraints. See [Edge limits](https://supabase.com/docs/guides/functions/limits).

Before real-money operation, plan independent backups, monitoring, storage growth/retention and unpausing/webhook recovery. Audit/history/webhook rows grow over time; small initial schema size does not establish sustainable capacity. Cron/expiry scheduling is separate, not installed here. A paused database cannot be relied on for timely reservation expiry or payment reconciliation.

Core frontend contracts match: Auth users are reused; profile upsert/address/cart tables exist; nested products/variants/inventory and orders/items/payments/history relationships exist; gallery_paths supports multiple local variant images; current admin editor fields and RPC parameter names exist; the latest Edge actions call installed function signatures. The service key remains Edge-only, while customer JWTs and database policies authorize user operations.

Remaining integration work is material:

- Reconcile the five initial database category seeds to the six current frontend categories before importing data. Assign UUID records and a stable mapping from local product string IDs; no slug column exists. The special frontend iPhone Duo media-shape check currently uses its local string ID and should be adapted to stable product metadata during that mapping.
- The owner preview's rich owner_assets/HD/angle/licence metadata is not an application-table column set. Map approved primary/gallery paths per exact real variant; do not bulk-submit raw research rows, pretend missing prices/stock exist, or infer licence approval. No iPhone pricing proposal becomes a verified active offer merely by installation.
- Local npm run dev deliberately forces frontendReview with blank service credentials. A separate approved staging build/host configuration is required for live UI integration; toggling the environment alone does not make that preview server a backend test.
- Existing Google login/session evidence does not validate newly installed RLS, Email recovery, owner MFA, PayPal or Zelle. Configure exact origins/redirects and private server payment secrets, then test two customers plus the MFA owner, concurrent orders and provider failure/retry paths.
- verify_jwt=false on the three functions intentionally relies on explicit user Auth verification for store/refund handlers and provider signatures for webhooks. Never remove those checks or interpret a publishable key as an authenticated user.

## Findings and recommendation

No critical destructive-install or cross-customer private-order disclosure defect was identified in the inspected SQL under the audited role assumptions. That is narrower than a live security sign-off.

Required before applying to the existing project: owner approval of this exact hash, a verified backup/restore route, fresh schema/role/event-trigger drift inspection and explicit acceptance of guarded one-time installation versus a strict no-op-rerun requirement. These are process gaps, not evidence that existing data should be deleted or default Storage grants revoked.

Required before launch: installed-policy/permission audit; two-user and MFA tests; real hosted PostgREST/Edge tests; PayPal sandbox/webhook/refund testing; inventory/payment race tests; actual catalogue/category/UUID/image import mapping; approved shipping/tax/policies; expiry/reconciliation scheduling; late-Zelle handling; backup/monitoring procedures. Checkout remains disabled until all pass.

Recommendations: add targeted lock/statement timeouts for the installation session if operational conditions require them; index customer_addresses(user_id), contact_messages(user_id), and expiry filters after measuring query plans; bound own cart/address payload/storage growth at the database boundary; minimize public review columns because approved reviews currently expose user_id via table SELECT; define account deletion/anonymization and audit retention. These are not reasons to blindly modify platform grants or disable RLS.

Normal defaults/intentional behavior: service_role bypasses RLS; owners retain implicit privileges; RLS is enabled but not forced; public catalogue/inventory reads coexist with admin-only writes; the existing auto-RLS function/event trigger remains intact; absent CLI history does not itself mean corruption.

**Hold execution until the owner has reviewed this report and approved the installation conditions. No SQL correction, installer rewrite, hosted execution or deployment was made by this review.**
