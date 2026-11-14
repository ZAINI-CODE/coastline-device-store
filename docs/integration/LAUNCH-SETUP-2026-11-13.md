# Launch setup — 13 November 2026

## Latest live email tests — secrets configured

This section supersedes the missing-secret blockers recorded below.

- Both EMAIL_WORKER_SECRET and RESEND_API_KEY are now detected by the deployed worker. Live correct-secret health returned HTTP 200; missing and wrong secrets returned HTTP 401. Vault-based health also returned authenticated=true and resend_key_configured=true. No secret values were displayed.
- Resend accepted two actual synthetic payment-confirmation emails (admin and customer templates) to the configured test inbox fa-23-bscs-530@lgu.edu.pk, using Coastline Device Test <onboarding@resend.dev>. These represent no real order or payment.
- Each test was retried with the same idempotency key. Both retries returned the original provider message ID, preventing duplicate messages. Nonsecret IDs are retained in .private/email-worker/delivery-tests.json.
- Provider delivery-status lookup returned HTTP 401 (worker HTTP 502). Acceptance is verified; inbox delivery is NOT verified. Confirm receipt in the test inbox or inspect Resend delivery logs. Do not infer the cause of the provider authorization failure.
- The coastline-order-email cron job is configured once per minute but PAUSED. It resolves the worker credential from Vault at runtime and uses synchronous extensions.http with bounded timeouts. A live health request through this transport returned HTTP 200. The existing reservation-expiry cron remains active and unchanged.
- pg_net was initially installed/tested, but its Supabase-managed shared queue permissions could not be restricted by the postgres role. The scheduler was switched away from pg_net; no queued HTTP requests remain. The extension remains installed but unused by this scheduler. No credential values occur in saved cron commands or SQL files.
- EMAIL_MODE remains test. Real customer order queues are not drained; live queue delivery/recovery and sender-domain verification remain pending. The store domain is not yet owned. No products, prices, inventory, reviews or orders were changed by these tests.
- Credential-safe screenshot: .private/launch-setup-2026-11-13/email-worker-final-verification.png. Local credential-helper syntax check passed; earlier focused retry/lease/template tests remain local mocked/isolated evidence, not live queue certification.


## Latest payment and email verification follow-up

This section supersedes earlier Sandbox activation plans below.

- Payment state: Zelle remains active with its existing recipient/instruction/reference/MFA bank-verification logic unchanged. PayPal is always visible as “Temporarily Unavailable” and disabled in checkout. The deployed API rejects PayPal placement, creation, capture and reconciliation with HTTP 409 regardless of Sandbox configuration. Safepay is not integrated or displayed. No payment settings, product data, prices, inventory, orders or schema were changed in this follow-up.
- Rebuilt the connected local storefront (13 product pages). Browser inspection of the actual deployed payment-method response through checkout confirmed Zelle selectable, PayPal/cards disabled, and no Safepay. No new order, payment, cart item or bank-receipt verification was performed.
- Deployed and verified persisted source for order-email and store-api. The existing function-level authorization settings remain unchanged. Saved their previous deployed sources privately before replacing them.
- Fixed secret naming: EMAIL_WORKER_SECRET is now preferred; ORDER_EMAIL_WORKER_SECRET remains a fallback. When both are present, only the preferred value authenticates.
- Added private authenticated health and provider delivery-status checks. Provider failures return only their HTTP status, not provider response bodies, credentials or customer content. Delivery lookup returns only message ID and an allowlisted last-event status. All require the worker secret.
- Fresh live worker checks: GET 405; POST without worker authorization 401; POST with deliberately incorrect authorization 401. Correct-secret authentication is NOT tested live.
- A fresh Supabase Secrets page reload showed no RESEND_API_KEY, EMAIL_WORKER_SECRET or ORDER_EMAIL_WORKER_SECRET. There is a separately named “Coastline Device Co.” custom secret; its value was neither inspected nor changed. The owner was asked to save the required credentials as two separately named entries, privately.
- BLOCKED: real Resend send, admin-inbox acceptance/delivery, customer-template real delivery, provider delivery lookup and hosted queue delivery. No actual email was sent. EMAIL_MODE remains test, so real order queues are not drained.
- Local validation: 16 focused tests passed, including 20 customer/admin synthetic template combinations, preferred/legacy worker authentication, private status responses, retry idempotency after HTTP failure or acknowledgement failure, independent admin/customer leases, isolated PostgreSQL outbox/status transitions, Zelle safeguards and disabled PayPal actions. These are local mocked/isolated tests, not live provider proof. Edge parsing/bundling and storefront build passed.
- Private evidence: email-secret-names-check.png, email-worker-current-settings.png, email-worker-secret-fix.png, payment-methods-current.png under .private/launch-setup-2026-11-13/. No public frontend deployment was made.


Status: **NOT READY FOR PUBLIC CUSTOMER ORDERS**. Local/mock testing is not provider certification. Domain ownership, provider credentials, real inbox delivery and hosted payment tests remain required.

## Confirmed owner configuration

- Admin notification destination: `fa-23-bscs-530@lgu.edu.pk`, temporary until the owner supplies a business inbox. This is a notification destination, not an automatic grant of Supabase/store administrator privileges.
- PayPal account email: `gonzalo.bustos.b@hotmail.com`. An email address is not a PayPal REST client ID, secret, merchant ID or webhook ID.
- The owner does **not** yet own `coastlinedevice.com`. Do not configure or claim a verified sender, mailbox, HTTPS deployment or DNS ownership for that domain.
- Existing Zelle recipient and verification workflow remain unchanged. No bank transfer was initiated or marked received during these tests.
- Do not modify existing product prices/stock or enable Sandbox against real store inventory.

## Implemented and locally verified

1. Migration 026 extends the existing private email outbox with independent admin delivery attempts, leases, provider message IDs and acknowledgement/error fields. There is no new parallel order/product system and no historical-message backfill.
2. New order, submitted Zelle reference, failed payment, confirmed payment, preparation, dispatch, delivery, cancellation and refund-status notifications have customer/admin templates. A submitted reference explicitly remains pending bank verification. Dispatch requires carrier/tracking in the email template.
3. Customer/admin retries have different provider idempotency keys and independent acknowledgements. Retry boundaries remain eight attempts / 23 hours; exhausted/uncertain deliveries require provider reconciliation.
4. `order-email` defaults closed for queue delivery. Until `EMAIL_MODE=live`, it will not drain real customer/admin notifications. The private `self_test` action uses `onboarding@resend.dev`, only the configured test inbox, synthetic content and clearly marked test subjects. It never queries orders or creates a transaction. Provider acceptance explicitly does not claim inbox delivery.
5. PayPal Sandbox selection, creation, capture and reconciliation are gated by complete server-side Sandbox configuration and a separate Supabase test project. The known production project is expressly excluded. Live PayPal and cards remain disabled. The frontend displays a clear Sandbox notice only when that server gate succeeds and uses the server's matching public client ID.
6. Fresh full local suite: **70 passed, zero failed/skipped**. Includes real isolated PostgreSQL order/RLS/MFA/stock/status-history/email tests; provider HTTP calls are mocked. New targeted tests cover 20 customer/admin template self-tests, independent deliveries, production-project exclusion, capture success, retry/recovery and capture failure without falsely paid orders.
7. Frontend build succeeds with 13 published product pages. No theme/CSS/product/review changes were made.

## Hosted work completed in this step

- Applied only additive migrations **024, 025 and 026** in a single guarded transaction. The fresh installer was not run. A read-only preflight found no conflicting email/guard functions and zero orders.
- Verified the outbox and admin claim function exist, customer outbox SELECT is denied, and no email rows or orders were created by rollout.
- Pre/post fingerprints of all products, variants and inventory match exactly. Existing checkout settings remain `zelle_enabled=true`, `paypal_enabled=false`, `checkout_enabled=true`, `policies_approved=true`; these were not changed.
- Deployed new `order-email`; after explicit owner approval, disabled its legacy gateway JWT check in favour of its required private worker bearer secret. Verified real HTTP GET rejects with 405; missing/wrong worker authorization rejects with 401.
- Backed up the actual deployed store-api source privately, compared/replaced its editor contents with the tested bundle, and deployed the update. Existing function-level customer authentication and admin MFA checks remain; its legacy gateway flag remains off as previously approved.
- Saved non-secret runtime settings `EMAIL_MODE=test`, `EMAIL_TEST_RECIPIENT=fa-23-bscs-530@lgu.edu.pk`, `PAYPAL_ENV=sandbox`. Did not invent/set API credentials. The actual Supabase secrets list has no Resend API key, worker secret, PayPal client ID/secret, merchant ID or webhook ID.
- Rebuilt and ran the connected frontend. Verified all 13 public catalogue products render, an existing signed-in session can add AirPods 5 / White / USB-C at $129 and reach the real shipping form through the deployed API; 50 shipping destinations load. Empty submission leaves eight required controls invalid and creates no order. A 390px viewport shows no horizontal overflow. Zelle remains selectable; PayPal/cards remain disabled until provider/test-project configuration is complete. Removed the test item and verified the initially empty cart is empty again.
- No fresh login, actual bank payment, provider capture/webhook, owner-inbox delivery, live customer fulfilment or public-host deployment was performed. These remain acceptance blockers, not passed tests.
- Private evidence: `.private/launch-setup-2026-11-13/` (baseline/preservation results, migration result, worker/API settings screenshots, deployed API backup, live-worker rejection results, desktop/mobile checkout images). Evidence is excluded from the public build.

## Private provider setup still needed

Configure credentials through trusted provider dashboards / Supabase secrets, not chat or frontend variables.

Email:

- `RESEND_API_KEY`: a real Resend sending API key.
- `EMAIL_WORKER_SECRET` (legacy `ORDER_EMAIL_WORKER_SECRET` also supported): privately generated random credential (at least 32 bytes), shared only with the trusted scheduler/test operator.
- `EMAIL_MODE=test` while the custom domain is unowned.
- `EMAIL_TEST_RECIPIENT=fa-23-bscs-530@lgu.edu.pk` **only if this is the email associated with the owner's Resend account**. The Resend test domain restricts recipients to that account's email.
- Run self-tests for each event/audience using POST JSON `{ "action": "self_test", "request_id": "<fresh UUID>", "kind": "shipped", "audience": "customer" }` and private worker bearer authorization. Never expose worker authorization in browser code or public cron URLs.
- Confirm actual received messages and provider delivery/bounce state. A 200/accepted response alone is insufficient.
- After domain purchase: verify DNS sender domain, create the support mailbox, configure Auth SMTP/templates and set `EMAIL_MODE=live` only after approved delivery tests. Configure a private scheduler POSTing `{}` every minute, then monitor both customer/admin queue ages/errors.

PayPal Sandbox:

- Create/use a separate Supabase test project with synthetic test inventory/users. Configure its public URL/key in a private local test preview, not the public store.
- Private secrets: `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_SANDBOX_ENABLED=true`, `PAYPAL_SANDBOX_PROJECT_REF=<test project ref>`, and the exact test frontend `SITE_ORIGIN`.
- Enable `paypal_enabled` and approved checkout only in that isolated test project. Deploy the existing reviewed functions there and register the test project's webhook endpoint in the same Sandbox app.
- Use a Sandbox buyer distinct from the Sandbox merchant. Verify successful capture, cancellation, declined funding, concurrent retries, webhook signature/replay, amount/currency/merchant mismatch, ambiguous provider failures and reconciliation. Check provider transaction IDs against test database rows.
- Live payment readiness requires separate live credentials and explicit activation/testing. No live gateway was enabled by this work.

## Required hosted end-to-end acceptance

Execute in order, recording evidence separately from local unit tests:

1. Fresh Google and email confirmation/recovery callbacks; expired/reused links, return routing, logout and reload persistence. The user completes credentials/MFA personally.
2. Guest product selection, correct variant/price and inventory limits; required login at checkout.
3. Valid shipping address and server-authoritative final total. Retry the same order request and verify one order / one inventory decrement.
4. Sandbox payment success/failure/cancel/retry and signed webhook delivery. Unpaid/ambiguous states must never become paid based solely on a browser callback.
5. Customer-only order history and MFA-admin review; prevent a second customer reading private order/payment/address records.
6. Customer/admin receipt, submitted-payment and paid confirmation emails; verify actual inboxes.
7. Admin processing → shipped with carrier/tracking → delivered; customer history/tracking and all corresponding emails. Delivery is an admin-recorded status, not an automatic carrier delivery integration.
8. Provider/email outage/retry recovery, cancellation/refund reconciliation and audit logs. Zelle uses actual bank verification and has no simulated-payment switch.
9. Approved temporary public host, HTTPS/headers/origin/callbacks/robots/canonical URLs; then repeat the journey there. No public deployment is asserted by a local build.

## Recovery

Pause scheduling and queue delivery first if delivery behaves unexpectedly. Retain queued jobs, provider IDs and attempts for reconciliation; do not blindly resend beyond the idempotency window. Restore a previously captured Edge Function source version only after checking schema compatibility. These additive migrations do not delete existing rows or alter Auth/Storage policies. Before launch, obtain an encrypted database/Storage backup and prove restoration in a separate environment. Do not treat code/migration files as a complete customer-data backup.

## Official provider constraints

- [Resend testing-domain restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- [Resend SMTP prerequisites and settings](https://resend.com/docs/send-with-supabase-smtp)
- [PayPal Sandbox guide](https://developer.paypal.com/sandbox-testing/overview)

## Files changed for this step

- `supabase/migrations/026_order_notifications.sql`
- `supabase/functions/_shared/order-email.ts`, `_shared/server.ts`, `order-email/index.ts`, `store-api/index.ts`
- `js/app.js` (conditional Sandbox option/SDK gate only)
- `.env.example`
- `tests/launch-integrations.test.mjs`, `email-security.test.mjs`, `backend-endpoints.test.mjs`, `installer.test.mjs`
- This document; generated build/dashboard bundles and private migration evidence.
- Installer review artifacts are regenerated by the existing installer test; the full installer was **not** executed on the existing hosted project.
