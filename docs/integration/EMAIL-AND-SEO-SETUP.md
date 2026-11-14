# Email and temporary-host SEO setup

**Superseded status note, 13 November:** the owner does not yet own `coastlinedevice.com`. Do not assume a verified sender or support mailbox exists. Migrations 024–026 and updated email/store-api code have since been deployed with test-only email mode; provider credentials remain missing. Use [the latest launch setup](LAUNCH-SETUP-2026-11-13.md) for current status. The deployment sequence below is retained as reference, not evidence of completed provider configuration.

Prepared 13 November 2026. These instructions do not mean hosted deployment or configuration has occurred. Do not run the full installer on the existing store.

## Email provider and secrets

The existing worker has been completed for **Resend**. Order emails use its HTTPS API; Supabase Auth uses its SMTP service separately. The fixed sender is `Coastline Device Co. <support@coastlinedevice.com>`. A working support mailbox and verified sending domain are required. No provider key was available or invented, and no real message was sent during implementation.

Required from the owner:

- A Resend account, verified `coastlinedevice.com` sender domain and sending API key. Complete only the DNS records Resend supplies, after approving mail-DNS changes; preserve existing MX and hosting records. Hosting the website on a temporary URL does not verify the email domain.
- A private, independently generated `ORDER_EMAIL_WORKER_SECRET` (at least 32 random bytes), stored in Edge Function secrets and the scheduler's secret store.
- Approval for the targeted migrations, function deployment, scheduling and SMTP/Auth changes below. Never put SMTP credentials or either secret in `PUBLIC_*`, browser code, a public repository, screenshots or this document.

Official references: [Resend SMTP for Supabase](https://resend.com/docs/send-with-supabase-smtp), [Supabase production SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Approved deployment sequence, when authorized

1. Take an encrypted database backup using trusted PostgreSQL/Supabase tooling and a separate private Storage-object backup. Test restoration in an isolated project. Save current queue function/trigger definitions and deployed function source. Record the existing dashboard-applied schema baseline; CLI migration history is missing. Do not use a blind migration push or rerun `install-store.sql`.
2. Compare the hosted objects with `024_order_email_delivery.sql` and `025_purchase_validation.sql`, then apply only those compatible additive files. 024 supports the observed missing 018 queue as well as a project where 018 already exists. Both are tested for repeat execution. They contain no catalogue/customer reseed or backfill. Inspect custom drift before application. A conflicting kind constraint or incompatible queue structure will fail rather than silently repair unrelated data.
3. Set `RESEND_API_KEY` and `ORDER_EMAIL_WORKER_SECRET` in Supabase Edge Function secrets. Supabase supplies its normal server-side URL/service role; never copy the service-role key to frontend hosting variables.
4. Deploy `order-email` and the updated `store-api`, including their `_shared` dependencies. Preserve reviewed function-level authentication (`verify_jwt=false`); the email worker requires its private bearer secret, and store-api validates the customer's Supabase identity and privileged actions. Do not activate PayPal.
5. Configure a trusted server-side scheduler to POST `{}` once per minute to `https://roamotmagssiipntchgh.supabase.co/functions/v1/order-email` with `Authorization: Bearer <worker secret>`. Store the secret privately, not in frontend code, public cron URLs or logs. Five jobs are claimed per call; monitor backlog and adapt the schedule to measured volume and plan limits. No scheduler was created here.
6. In Supabase Authentication's custom SMTP settings, configure Resend: host `smtp.resend.com`, port `465`, username `resend`, password = the sending API key; sender email `support@coastlinedevice.com`, sender name `Coastline Device Co.`. Recheck the provider's current settings before saving. Set the confirmation and recovery HTML from `supabase/templates/confirmation.html` and `recovery.html` with suitable subjects. Keep the `{{ .ConfirmationURL }}` variable. Local files do not update hosted templates automatically.
7. Once the real temporary hosting URL is known, set Supabase Auth Site URL to that HTTPS URL and allow only the intended callback paths. The current application uses `/#/account`, product-review return parameters, and the diagnostic `/#/connection` route. Google uses Supabase's callback `https://roamotmagssiipntchgh.supabase.co/auth/v1/callback`. Preserve the existing Google client secret privately. Set Edge `SITE_ORIGIN` to the temporary origin (scheme/host, no trailing slash), rather than localhost. These are approval-required hosted settings, not changes made by a local build.
8. Test delivery to an owner-controlled inbox: registration confirmation, reset password and fresh Google callback. The user enters passwords and completes OAuth personally. Check expired/reused links, session restoration, review return routing and logout.
9. In an isolated test project with the same policies, test order receipt, bank-confirmed payment, preparation, dispatch (carrier/tracking), delivered/cancelled/refund status emails and provider failure/retry. Verify actual inbox content and provider delivery state; do not mark real orders paid merely to trigger mail. A Resend accepted response is not proof of inbox delivery.

## Delivery semantics and monitoring

- Order insertion queues `order_received` inside the order transaction; it does not claim funds arrived. Paid confirmation is queued only when the payment changes to paid. Preparation, shipping and delivered notices require paid status. Cancelled/refunded status messages report recorded changes; they do not independently verify a bank refund.
- Unique `(order_id,kind)` prevents duplicate event jobs. Claims lock rows with `FOR UPDATE SKIP LOCKED`, lease for ten minutes, and freeze committed line/address/total content on first delivery attempt. Provider retry uses the same content and idempotency key. Sending is outside the order transaction, so provider failure cannot delete or duplicate an order.
- Up to eight attempts occur within 23 hours of first attempt. This stays inside Resend's documented 24-hour idempotency retention. Jobs stop for manual reconciliation after either boundary. This is bounded retry, **not** an unconditional exactly-once guarantee.
- Monitor old unsent jobs, null recipients, `last_error`, growing backlog and failed worker calls. Alerts must exclude customer addresses, email bodies and secrets. Before retrying an exhausted job or resending beyond the provider retention window, check provider delivery logs/message IDs to avoid duplicates. Do not reset its key/timestamps automatically.
- An unreferenced Zelle screenshot is removed only after a successful read proves the payment refers to a different path. Unknown database outcomes retain the image for reconciliation. Private-bucket retention and cleanup still need an operational policy.

## Temporary-host SEO

The frontend remains a static HTML/CSS/JavaScript deployment. Netlify can use the existing `netlify.toml`; Vercel needs equivalent security headers before public deployment.

Frontend build settings:

- Existing public Supabase URL and publishable key only; `PUBLIC_FRONTEND_REVIEW=false` for the approved integration build.
- `PUBLIC_SITE_URL` = the actual temporary HTTPS URL, without a hash or query. Do not use a made-up host. When omitted, Netlify `DEPLOY_PRIME_URL` / `URL` or `VERCEL_URL` are detected; explicit `PUBLIC_SITE_URL` takes precedence. Local fallback is the store's configured domain.
- `PUBLIC_INDEXING_ENABLED=false` for private previews. Set **true** for the approved public production build and rebuild; both robots meta and robots.txt change together. Do not leave an approved production build blocked indefinitely.
- Build `npm ci && npm run build`, publish `dist`. The build reads the public catalogue RPC and public promotions using the publishable key. It stops if the configured catalogue request fails, instead of substituting the old draft catalogue.

Generated pages: `/pages/products/<database UUID>.html`, `/categories/<category>/`, `/shop/`, policy directories, root homepage, `sitemap.xml` and `robots.txt`. Product cards point to direct pages, retaining the selected variant in the hash for the existing app. Titles, descriptions, canonicals, Open Graph and Product JSON-LD use real catalogue content. Incomplete/nonpurchasable variants do not get an Offer. No review/rating data was invented or added to structured data.

Rebuild after catalogue/price/image/availability changes and at promotion boundaries. Static structured data is a build-time snapshot; customer purchasing still uses live Supabase data and server-side validation. A successful local sitemap test does not establish indexing or search ranking. After approval/deployment, check public HTTPS URLs, headers, direct pages, robots and sitemap; then use Search Console/Rich Results Test.

When connecting Hostinger's domain later: approve DNS/hosting changes, change `PUBLIC_SITE_URL`, Auth Site URL/allowlist and `SITE_ORIGIN`, rebuild, redirect the temporary host to the chosen canonical host as appropriate, and resubmit the sitemap. No code rewrite is needed for each product.

## Rollback

Pause the email scheduler first and restore previous Edge Function versions if needed. Keep queued/sent rows and provider IDs for reconciliation; do not delete them or blindly replay messages. Revert the specific queue trigger/function definitions from the backup only after checking compatibility with the previous worker. The additional purchase guards can be removed individually if a verified compatibility issue requires it; retain all pre-existing RLS and payment guards. No automatic destructive down-migration is supplied. Restore a verified backup only through a separately reviewed recovery process that reconciles orders/payments made since the backup.
