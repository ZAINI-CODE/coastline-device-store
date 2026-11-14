# Proposed deployment and rollback checklist

12 November 2026. **Preparation only. No deployment, DNS, secret, SQL or configuration change is approved by this document.** Read REPORT.md first.

## Configuration inventory

- **Frontend host:** not selected/provisioned by this audit. Recommend Netlify because `netlify.toml` already specifies the static build and security headers. Publish `dist` only. Build command `npm ci && npm run build`.
- **Public Supabase project URL/key:** already configured locally; use the same existing project and its publishable/public key in the host's build environment. Never copy service-role credentials into frontend environment variables.
- **Frontend variable names:** `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_FRONTEND_REVIEW=false` for the approved production release. Do not set `PUBLIC_PAYPAL_CLIENT_ID` until the future PayPal integration is explicitly approved. Public keys are not secrets; key naming alone does not make a service-role key safe.
- **Domain:** intended canonical `https://coastlinedevice.com`; actual DNS/HTTPS not working from the audited resolver. Use only the host-generated DNS values after domain binding. Redirect www to apex; preserve mail DNS records.
- **Edge server origin:** `SITE_ORIGIN` currently behaves as localhost:4173; proposed production value is the exact canonical origin without trailing slash. Validate it on every relevant deployed handler. Do not broaden to wildcard as a workaround.
- **Supabase built-in server settings:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` remain server-side. Do not print, paste into the frontend or commit private keys.
- **Zelle recipient:** existing server `ZELLE_RECIPIENT_NAME` and `ZELLE_RECIPIENT_EMAIL` configuration must be retained and verified via the authenticated customer flow; check exact names in `_shared/zelle.ts` before changing secrets. Recipient details are intentionally shown to customers; bank login credentials never are.
- **Launch flags:** hosted checkout/policies/Zelle currently true; PayPal false. Do not infer that flags alone mean readiness. Propose a separately approved maintenance hold during remediation if required; no flag is changed by this audit.
- **Auth:** Email and Google enabled. Current Site URL localhost:4173; proposed production Site URL canonical HTTPS root. Existing redirects include localhost and apex wildcard. Review exact routes used by PKCE, confirmation and reset before narrowing. Google client secret stays private; do not request it in chat.
- **Authentication email:** custom SMTP currently OFF. Configure SMTP host/port/user/password and verified sender privately in Supabase, including domain authentication. Verify signup, confirmation and reset to a real external customer mailbox.
- **Order/shipping email:** local worker exists, hosted outbox/endpoint absent. Required server secrets are `RESEND_API_KEY` and `ORDER_EMAIL_WORKER_SECRET`. The source sender is `Coastline Device Co. <support@coastlinedevice.com>`; it is not a configurable sender environment variable. Verify that sender/domain in Resend, configure a private authenticated POST schedule and test delivery/retries. No secret value is supplied by this document.
- **Storage:** retain private `zelle-evidence`, 2 MiB JPEG/PNG/WebP restrictions and mediated short-lived admin URLs. No blanket default Storage privilege revocation.
- **Monitoring:** no production incident/alert workflow verified. Select redacted frontend/Edge error monitoring and alert recipients; do not inject analytics without approval.
- **Runtime:** pin the build Node version to the version validated in clean CI. Browser runtime is static JavaScript; no PHP/Node service deployment required.

## Gate 1 — backup and recoverability

1. Record current schema, constraints, functions, triggers, RLS, grants, launch settings and deployed Edge Function versions. Save a migration/object manifest; hosted CLI migration history is absent.
2. Export data with an authorized owner tool into encrypted access-controlled storage. Protect private customer/cost data. Do not include secrets in a public repository.
3. Back up Storage files independently of PostgreSQL. Supabase database backups do not contain the actual Storage object contents. Free Tier users should arrange their own regular exports and recovery process. [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups)
4. Verify an export can be restored in an isolated project/environment; compare table counts, sample relationships, inventory totals and media checksums. An untested export is not a proven rollback plan.
5. Do not run the full fresh installer or reset/destroy the existing project. Review each proposed migration against the hosted baseline and rehearse it separately.

## Gate 2 — approved remediation

1. Resolve the three incomplete published products without guessing or redistributing confirmed stock.
2. Review/install only missing compatible email-outbox objects, configure the worker/provider and deploy only with explicit approval.
3. Configure canonical origin, Auth settings, SMTP, domain and hosting only after approval. Keep staging unindexed and checkout isolated from public traffic until acceptance.
4. Add safe screenshot retry cleanup and an operational plan for unresolved Zelle holds. Do not release stock while money could still arrive.
5. Refresh deployment documentation and record the immutable build hash manifest. Keep PayPal/cards disabled.

## Gate 3 — required acceptance tests

Run these in an isolated environment where possible. For a production bank transfer, the owner must perform and verify the transaction; do not invent a paid test.

1. **Clean build:** locked install, 57 existing tests plus new fixes' tests, build, Edge runtime validation. Inspect the exact publish directory for secrets, review tools and unintended files.
2. **Authentication:** fresh Google login from the target origin; verify callback identity and reload persistence. Email signup/confirmation, login/logout, expired/reused links and password reset. Confirm emails never redirect to localhost in production. Owner enters passwords/OTP/MFA privately.
3. **Two-user privacy:** customer A cannot read/write B's profile/address/cart/order/items/payment/evidence/refund history using direct API/RPC paths. Anonymous requests fail. Admin AAL1 must fail; designated admin AAL2 succeeds.
4. **Products:** all 13 current models, all offered colour/storage variants, all gallery images, prices/discounts/availability and zero-stock boundaries. Confirm no supplier costs are public. Resolve any product authenticity/specification doubts from primary sources before making factual claims.
5. **Cart:** guest and signed-in cart, reload, quantity minimum/maximum, removed/inactive old variant, multiple-tab changes, repeated Add, server-stock changes and campaign expiry. Never silently charge a stale total.
6. **Zelle reservation:** signed-in customer submits valid shipping/all 50 states, sees exact server total/order reference/recipient, order remains pending, stock reserved once. Refresh/retry/double click must not create duplicates.
7. **Zelle submission:** valid reference with/without image; reject wrong type, oversize file, foreign order and duplicate reused reference. Concurrent identical requests should retain one payment submission and no orphan files.
8. **Bank verification:** owner checks actual receipt, exact amount, payer/reference; admin MFA confirms once. Screenshot alone must not mark paid. Repeat confirmation, mismatched amount, simultaneous cancel/confirm and late transfer must fail safely or reconcile explicitly.
9. **Fulfillment:** admin status transition, tracking and carrier; customer history sees appropriate state. Payment-confirmation email follows actual paid status; shipping email includes tracking/carrier after dispatch. Check retries, duplicate workers and delivery errors.
10. **Recovery:** expired pending holds, unresolved processing holds, provider outage, customer retry, manual cancellation only after bank/customer reconciliation, refund bookkeeping after an owner-performed real refund where applicable. Do not create synthetic bank transactions.
11. **Reviews/admin:** signed-in review submission, moderation visibility, safe rendered text, fractional average/count, guest likes, admin stock/order permissions. Do not alter existing customer reviews for testing.
12. **UI:** desktop, real 768px tablet and 390px phone; keyboard/touch, 200% zoom, reduced motion, light/dark modes, gallery/carousel/navigation/footer, all policy/contact pages and empty states. Check console/network errors per route.
13. **Public hosting:** root/hash routes, direct policy/product paths, logo/favicons/images, canonical redirects, SSL chain, security headers/CSP and denied foreign Origin. Confirm order-email worker is not callable without its authorized credential.
14. **SEO/performance:** approved removal of production noindex/robots blocks; accurate sitemap/canonical/structured price/stock; Lighthouse and real network throttling. Keep staging unindexed. Record actual results rather than assuming a score.

## Gate 4 — deployment procedure after separate approval

1. Choose one frontend host, connect the intended source/release and configure public build variables privately. Do not upload the entire workspace.
2. Deploy a private/restricted preview with customer checkout access controlled; this document does not authorize making that preview public.
3. Verify the same release artifact, source revision and build manifest; perform the acceptance tests above.
4. Add the custom domain and host-provided DNS records, preserving mail records. Wait for resolver convergence and managed TLS. Verify canonical redirects.
5. Apply the specifically approved production Auth/origin/email settings and confirm callbacks on HTTPS. Never copy localhost credentials into the browser bundle.
6. Publish only the approved frontend artifact. Keep PayPal/cards disabled, and enable public ordering only after all mandatory Zelle/email/security gates pass.
7. Monitor failed authentication, API errors, aged payment holds, stock changes, payment reconciliation and email queue/provider outcomes. Assign a named operational owner and escalation process.

## Rollback

- **Frontend defect:** restore the previous immutable host deployment and verify assets/callback routes. Retain a manifest/release identifier. Do not roll the database back automatically with the frontend.
- **Checkout/payment incident:** with approved incident authority, stop new order creation while preserving existing orders, payment records, pending transfers and evidence. Do not delete orders or blindly replenish stock; reconcile outstanding bank payments first.
- **Edge Function defect:** restore the previously recorded compatible function version/configuration. Keep RLS, owner checks and MFA enforced. Use backward-compatible schema changes during rollout.
- **Database defect:** prefer an approved forward correction. Rehearse rollback SQL before deployment; destructive down-migrations can discard new orders. Snapshot current data before recovery. Restore backup into an isolated project first, compare and deliberately reconcile transactions received since the backup.
- **DNS defect:** restore the recorded previous DNS values only if that restores the intended service; preserve mail records. DNS changes have propagation delays and are not instant rollback.
- **Email incident:** pause/retry the worker with its persisted queue after correcting the issue; preserve idempotency keys and audit evidence to avoid duplicate customer messages.

## Approval still required

Approval to implement a scoped remediation, deploy functions/migrations, configure hosting/Auth/DNS/mail and publish/open orders must be separate from this audit. No such change was performed here.
