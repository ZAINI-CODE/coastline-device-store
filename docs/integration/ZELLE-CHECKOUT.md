# Zelle checkout — November 12, 2026

## Implemented and applied

The existing hosted store-api function now supports Zelle instructions, customer reference submission, an optional private screenshot and MFA-authorized evidence retrieval. Migration 023 was applied; the existing installer includes it for fresh installations. Do not rerun the complete installer on the existing project.

The existing hosted recipient secrets were checked against the owner's supplied values: Gonzalo bustos, gonzalo.bustos.b@hotmail.com. They match. No bank login, password or private banking key is used. Recipient information is returned by the authenticated server endpoint for the customer's order, rather than bundled as payment configuration in frontend code.

Checkout is enabled for Zelle only. PayPal and cards are disabled in the checkout and server request path. Previously approved free US shipping is enabled for all 50 states, including Alaska and Hawaii; the existing rules have zero separate checkout tax. Product prices, reviews and catalogue inventory quantities were not edited.

## Customer and administrator workflow

1. Customer signs in, selects items and shipping, accepts policies and reserves the order. Existing server-side pricing, stock validation and request UUID prevent duplicate order creation on retries.
2. The order page displays the authoritative USD total, unique order UUID, recipient name/email and instructions. The order remains Payment Pending.
3. Issuing payment instructions locks the order and changes its internal payment state to processing. This means an unpaid bank-reconciliation hold, not a successful payment or permission to ship. Automatic expiry cannot release that inventory while a transfer might be outstanding.
4. Customer submits the Zelle transaction reference, optionally with a JPEG/PNG/WebP screenshot up to 2 MB. Submission does not mark an order paid. Identical reference retries are idempotent; a submitted reference cannot be silently replaced. A normalized unique reference key prevents reuse on another order.
5. A provisioned administrator verifies authenticator MFA, opens Order management and reviews the reference and optional screenshot. Evidence links expire after 60 seconds. The zelle-evidence bucket is private with no client Storage policies; only the authorized Edge Function accesses it.
6. The administrator must check actual receipt in the business bank account, exact amount, recipient and transaction identity before choosing Verify actual Zelle receipt. Enter the bank transaction reference and acknowledge the bank check. A screenshot alone is insufficient. Existing database authorization, payment uniqueness, order locking and audit/history apply.
7. Processing/dispatch is allowed only after payment is paid. An unpaid Zelle hold can be cancelled through the dedicated reconciliation action after checking with both bank and customer that no transfer remains outstanding. Cancellation restores reserved inventory once. Do not cancel an uncertain transfer merely because it is old.

## Verification results and limits

- Full automated suite: 57 passed, 0 failed. Includes isolated PostgreSQL-compatible tests of ownership, service-only submission, MFA authorization, reference retry handling, paid confirmation idempotency, expiry protection and screenshot validation. These fixtures were not inserted into the hosted business database.
- Build and Edge bundle checks passed.
- Live store-api rejected unauthenticated requests with 401 and an unapproved origin with 403.
- Connected desktop and 390-pixel mobile checkout displayed Zelle as the available method; PayPal/cards were disabled. Empty-cart reservation was disabled. The live administrator screen required authenticator MFA.
- Hosted postflight confirmed checkout_enabled, policies_approved and zelle_enabled true; paypal_enabled false; 50 approved free shipping states; private 2 MB evidence bucket; customer-sensitive table RLS enabled; authenticated cannot execute begin_zelle_payment directly.
- Hashes of existing admin_order, place_order, release_order and confirm_payment definitions matched the preflight. Existing policies were not replaced.
- Hosted order count remained zero. No real bank transfer, fabricated payment reference, customer screenshot or paid confirmation was submitted to the hosted project.

Actual customer-to-bank-to-admin acceptance remains pending a legitimate order and owner verification of its bank receipt. Do not describe the entire live payment workflow as passed until that occurs. Order/shipping email delivery also remains pending the existing sender/provider configuration and a delivery test. The outbox alone does not prove email delivery.

## Owner acceptance test

Use a legitimate order with a real address and items intended for purchase. Confirm total and recipient before transferring funds. Submit the real bank reference and an optional redacted screenshot. Check that the customer sees Payment Pending and cannot mark it paid. Sign in as the administrator with MFA; independently inspect the bank receipt, then verify that exact order. Confirm one paid transition, one audit entry and no second stock deduction when refreshing. Dispatch only after funds are confirmed. Test shipping/tracking separately with the real fulfillment details. Do not create a duplicate transfer to test retry handling.

## Pause and recovery

If checkout must be stopped, use supabase/setup/pause-zelle-checkout.sql. It disables new checkout/payment availability without deleting orders, evidence, audit history or reservations. Reconcile outstanding bank transfers before releasing any holds. The prior deployed store-api source is saved privately in .private/zelle/store-api-before.ts; restoring it alone does not undo the database migration or settle pending orders. Migration 023 is additive and should normally remain installed. Do not drop its fields/index/functions while orders or evidence depend on them. Back up the database and private evidence separately before any future structural rollback.

Public frontend hosting/DNS deployment remains on hold. Updated frontend files are built locally; the hosted Edge Function and database changes above have been applied.

Private verification artifacts: .private/zelle/preflight.txt, postflight.txt, admin-access.txt, checkout-desktop.jpg, checkout-payment-methods.jpg and checkout-mobile.jpg. Do not publish the .private directory.
