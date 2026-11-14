# Backend implementation and installation handoff

Updated 6 November 2026, Asia/Karachi. Local implementation only; no remote writes or deployment performed.

## Changes completed

- All three Edge endpoints now bound actual streamed JSON request bytes, including requests without or with misleading Content-Length. Store/refund requests are limited to 25 KB; PayPal webhooks to 100 KB. Invalid media types, JSON roots, UUIDs, actions and quantities are rejected before privileged queries.
- Webhooks require event identity and all five PayPal signature headers before provider verification. A failed provider signature cannot reach database operations.
- PayPal configuration requires an explicit sandbox/live environment, client ID, server-only secret and merchant ID. A PayPal reservation cannot be created through store-api while this configuration is missing.
- Provider HTTP requests have timeouts and retain stable request IDs on retries. Capture verification now also rejects missing/blank capture IDs, malformed responses and invalid local totals, alongside merchant/order/amount/currency/status checks.
- Added npm run test:backend, which does not rebuild or rewrite the frozen installer. Seven backend tests pass, including the PostgreSQL application schema/order/inventory/RLS test and isolated handler/Auth/provider tests. All five Edge source files parse. These are not live provider or hosted RLS acceptance tests.

## Hosted read-only result

`npm run doctor` on 6 November returned schema-cache missing-table errors for public.categories and public.store_settings. No rows were changed. A missing API resource is not by itself proof of physical table absence; the prior SQL Editor audits are the stronger schema inventory evidence. A fresh read-only audit is required before installation if the owner has changed the database since that audit.

The existing Google callback/new-user/session-persistence results are user-confirmed historical evidence. Email/password recovery, delivered mail, admin MFA and live payment flows remain unverified.

## Exact next installation decision

Review the full `supabase/setup/install-store.sql` and `docs/security/installer-review/FINAL-REVIEW.md`. The installer remains unchanged:

SHA-256: 7750584909226e1e0497ab925614f5b976a86a1b4473cf38ef4c3dbba3325cc1

It creates the 23 application tables, their foreign keys, functions, indexes, triggers and RLS/grants in one guarded transaction. It aborts on application-object name collisions; it preserves Auth/Storage and the existing auto-RLS function. Checkout remains disabled. Do not run the archived installer or hardening proposal, and do not use db push as a shortcut around the explicit approval/preflight process. An existing CLI migration-history table was not evidenced by the audits; applying this SQL in the Editor does not automatically create Supabase CLI migration tracking.

No additional SQL migration was added by this implementation pass. The schema supports local image_path/gallery_paths per variant and arbitrary category rows. Its initial five category seeds are historical names, not the final six frontend category names; reconcile approved category records by name/ID during the later catalogue import. Do not create duplicate product/category rows or copy frontend string IDs into UUID columns. Unconfirmed prices, inventory and image rights must not become active catalogue rows. Do not import owner_assets/raw research metadata as table columns.

## After explicit installer approval

1. Take an appropriate backup and verify the current schema inventory. Apply the reviewed installer once using an authorized trusted connection. Re-run the schema/RLS audit; verify 23 application tables, checkout disabled and no unintended Storage/function changes.
2. Verify the real owner Auth identity, provision its UUID as an admin through a trusted operation, and enrol MFA. Customer-editable user metadata must never determine admin rights.
3. Deploy store-api, paypal-webhook and refund-order only after schema installation. Their verify_jwt=false setting requires their explicit Auth getUser checks; PayPal webhooks instead require provider signature verification. A publishable API key is not a signed-in user session.
4. Configure server secrets privately in Supabase: SITE_ORIGIN, PAYPAL_ENV=sandbox, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MERCHANT_ID, PAYPAL_WEBHOOK_ID and approved ZELLE_RECIPIENT_EMAIL. Verify platform-provided SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY. Do not send any private secret into chat or compile it into frontend configuration.
5. Register the correct sandbox webhook URL, then test signed delivery, capture, retries, cancellation, reconciliation and full refunds. Zelle requires actual bank receipt/refund verification; customer text is not payment proof. Choose and test late-payment/reservation procedures before enabling Zelle.
6. Run hosted tests with two separate customer accounts plus the MFA owner: profile/address/cart isolation, orders/items/payments/history isolation, forbidden price/stock/payment/role writes, last-unit inventory races, expiry/capture/cancel races, replay protection and sign-out/recovery. A second account and owner-controlled interactive sign-in may be required; never request passwords or tokens in chat.
7. Import only approved exact products/variants, image rights, prices and stock. Approve shipping/tax/policies and scheduler/backup procedures. Use a separate backend test configuration; preserve the current frontend-only preview until acceptance. Keep checkout disabled until the hosted tests pass.

## Current limits

No remote SQL, admin provisioning, secret configuration, function deployment, email delivery or payment transaction was performed. No live bank/provider result is claimed. No production readiness is claimed.

References: https://supabase.com/docs/guides/functions/auth ; https://supabase.com/docs/guides/getting-started/api-keys ; https://developer.paypal.com/api/rest/webhooks/ ; https://developer.paypal.com/api/rest/requests/
