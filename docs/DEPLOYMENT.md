# Run and deploy

**Hosted deployment on 9 November 2026.** Project `roamotmagssiipntchgh` already contained the base store schema. Migrations `012_catalogue_inventory.sql` and `013_payment_operation_leases.sql` were applied through the Dashboard SQL Editor in one transaction with the catalogue import and verification checks. The guarded installer is for an empty application schema. This project had no Supabase CLI migration history, so treat these entries as the Dashboard deployment record and establish a verified baseline before any future CLI deployment.

- The verified import contains 53 models, 112 SKUs and 795 provisional units, with exactly 15 units per model. The single imported batch is tracked in `public.catalogue_imports`.
- The deployed functions are `store-api`, `paypal-webhook` and `refund-order`. They use user-session verification, PayPal signature verification and admin MFA as applicable. All three rejected unsigned or unauthenticated probes with HTTP 401 after deployment.
- Cron job `electronic-store-expire-pending-reservations` runs once a minute. A hosted run succeeded. PayPal orders in `processing` require reconciliation before releasing stock.
- The Free plan provided no scheduled backup. The deployment used a targeted preflight baseline and an atomic transaction with checks before commit. Checkout is disabled. Approved shipping rules, confirmed physical stock, catalogue image approvals and payment setup are still pending.

## Local preview

Install Node.js 22 or 24 LTS. In the project directory run:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

Open `http://localhost:4173`. The server serves `dist`, so rebuild after edits. The default mode is the isolated storefront preview. Run `npm.cmd run dev -- --connected` to serve the built public configuration and test the actual Supabase connection locally.

For local public configuration, copy `.env.example` to `.env` and replace only the public Supabase URL/key and public PayPal client ID. The build reads `.env` automatically. Never use a service-role key in a public variable; the build rejects known secret/service-role key formats. Run `npm run doctor` to perform read-only public catalogue and migration/settings checks once the public settings are present. It deliberately does not claim that authentication or payment providers work.

For a fresh application schema, the guarded installer combines migrations 001–013. Compare the hosted schema against the migration definitions before upgrading an existing project.

## Supabase

1. Create your own Supabase project. Install the official Supabase CLI using its documented supported installation method. Record the project reference and public URL. Never commit its service-role key.
2. From this project, authenticate/link and apply migrations:

```text
supabase login
supabase link --project-ref YOUR_REAL_PROJECT_REFERENCE
supabase db push
```

3. Use a staging project first. Run the SQL migration tests locally with `npm test`, then test real users against the deployed project's RLS. The local engine uses small auth stand-ins; it does not prove hosted Supabase Auth integration works.
4. In Authentication settings enable email confirmation, a strong password policy, production SMTP, rate limits and appropriate bot protection. Set the Site URL to your actual HTTPS website. Add that exact URL and your approved local/staging callback URLs to the redirect allowlist. Email verification and password recovery must be tested with delivered emails.
5. Enable Google only after supplying a Google OAuth client and secret. In Google Cloud configure the consent screen and the callback URL shown by Supabase (`https://YOUR_PROJECT.supabase.co/auth/v1/callback`). Allow the actual website in Supabase redirects. Set `googleEnabled` in the public store configuration only after testing.
6. Enable Apple only after configuring the Apple developer account, Services ID, Team ID, Key ID, private key and generated client secret with the callback/domain configuration shown by Supabase. Track secret expiration/rotation. Set `appleEnabled` only after testing. Never place those secrets in frontend files.
7. Create the owner's user through normal registration and verify the email. In the Supabase SQL editor, using a trusted administrator connection, provision its real UUID:

```sql
insert into public.admin_members(user_id) values ('ACTUAL_OWNER_AUTH_USER_UUID');
```

8. Sign into the website and visit Owner dashboard. Enrol the authenticator and verify its code. The database denies admin access at `aal1`, including for a provisioned owner. Recovery of a lost factor requires your documented Supabase administrator procedure. Never add a frontend bypass.

## Edge Functions and secrets

Set the following in Supabase Dashboard → Edge Functions → Secrets. Do not paste secrets into public config or a committed file:

- `SITE_ORIGIN`: exact website origin, e.g. your actual `https://...` Netlify host (no trailing slash).
- `PAYPAL_ENV`: `sandbox` until live acceptance is complete.
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`: matching Sandbox app credentials.
- `PAYPAL_MERCHANT_ID`: expected Sandbox seller merchant ID; required for verification.
- `PAYPAL_WEBHOOK_ID`: ID of the webhook registered for that exact app/environment.
- `ZELLE_RECIPIENT_EMAIL`: actual approved recipient, and verify your account's eligibility.
- `ZELLE_RECIPIENT_NAME`: exact enrolled name customers should check in their banking app.

## Order and shipping emails

1. Verify `coastlinedevice.com` with Resend and configure the support mailbox separately. The worker sends from `support@coastlinedevice.com`.
2. On an existing project, apply `supabase/migrations/018_order_email_outbox.sql`. It queues future paid and shipped transitions without backfilling existing orders.
3. Set `RESEND_API_KEY` and a random `ORDER_EMAIL_WORKER_SECRET` in Supabase Edge Function secrets. Deploy `order-email` using the repository's function configuration.
4. Configure Supabase Cron to POST to `/functions/v1/order-email` every minute. Store the worker secret in Vault and pass it as the bearer token. Keep the worker token out of browser configuration and job SQL text.
5. Test both messages on a staging order before opening checkout. Confirm shipping email has the carrier and tracking number. Monitor unsent jobs with a missing recipient or a first attempt older than 23 hours, and reconcile those with the provider before any manual resend.

The Supabase URL, anon key and service role are supplied as platform secrets in hosted functions. Verify their presence. Functions intentionally perform their own JWT validation with `auth.getUser()`; the webhook validates PayPal signatures instead of a customer JWT.

```text
supabase functions deploy store-api
supabase functions deploy paypal-webhook
supabase functions deploy refund-order
```

Register the PayPal webhook at `https://YOUR_PROJECT.supabase.co/functions/v1/paypal-webhook`. Subscribe at least to capture completed, pending, denied, refunded and reversed events. Use the sandbox webhook ID and test Sandbox seller/buyer accounts. Test approval, cancellation, decline, duplicate capture, duplicate signed webhook, wrong merchant/amount/currency and late payment. Keep all launch gates disabled until reconciliation is verified.

In Supabase Cron, schedule this SQL every minute:

```sql
select public.expire_reservations();
```

Use the dashboard's Cron extension/job setup. Confirm expiration releases a pending order once. **Processing** payments are deliberately excluded: inspect PayPal and reconcile uncertain captures before cancelling or releasing stock. A provider capture can succeed while the subsequent database write fails; retry capture/retrieve and signed webhooks reconcile it idempotently. Late completed captures after release require manual refund/reconciliation. Monitor `paypal_reconciliation_required:*` audit entries and function failures. Test Cron on the actual project; it has not been scheduled here.

## Configure and publish inventory

Edit `config/store.json` for the actual name, support details, approved policies and domain. Complete the policy text in `js/app.js` after review; the existing pages are honest pre-launch notices, not finalized legal documents. The 30-day returns proposal is private in `docs/RETURNS-DRAFT.md`. Do not insert a complete street address unless supplied.

In the MFA-protected owner dashboard:

Use the section navigation for Overview, Orders, Catalogue & stock, Promotions, Shipping & tax, Reviews, Messages, Audit history and Launch settings. Record lists and orders are paginated. The overview aggregates all database records instead of the visible page. Guided forms accept amounts as integer USD cents and tax/percentage rates as basis points. Inventory must reflect actual owner-provided available units.

For JSON import, use the selected resource's **Import complete records from JSON** panel. Supply 1–200 complete records. Existing rows require their actual IDs (inventory uses `variant_id`; promotion eligibility uses the promotion/product pair). The browser validates every row before requesting a single PostgREST upsert transaction. Database constraints and RLS still apply; one invalid database record rejects the entire batch. Review the confirmation carefully because omitted checkbox fields become false and imports are complete record writes. Export this page saves the currently visible resource batch only.

1. Create product/category records with verifiable manufacturer, model, specs, source and verification timestamp.
2. Create unique variants with exact configuration, integer USD cents, source-backed pricing and verified image rights. Upload permitted optimized assets into local `images/` and redeploy; the primary path is relative to the static root.
3. Create inventory records with actual owner-supplied quantities. Do not interpret research availability as your inventory.
4. Activate verified variants and publish their product. Preview exact image/model/colour matches. Check reviews display no invented ratings.
5. Create shipping rules for each enabled country AND state/region. This version matches both exactly; use `US`/`FL`, for example, only when you actually fulfil there. Set real rates, delivery descriptions, approved tax basis points (100 basis points = 1%) and any genuine free threshold. `null` tax blocks checkout; use zero only when the owner's adviser confirms it. The simple tax model includes shipping and is not a general multi-jurisdiction tax engine.
6. Create a promotion with active dates and either percentage basis points or fixed integer `discount_cents` (set the unused field to zero), plus eligible product mappings. Bundles require every mapped product and minimum quantity. Compatibility is owner-verified. Promotions are exclusive, with the largest eligible discount applied; complex stacking is not supported.

For a full refund, choose the owner order's full-refund action and confirm. PayPal uses an idempotent request and validates the provider amount/currency before changing the payment record. Pending refunds can be reconciled by repeating the same action, which reuses the refund record. For Zelle, first complete and verify the actual bank refund, then supply its bank reference in the owner action. A record does not initiate a bank transfer. No refund automatically restocks goods; adjust actual inventory only after receiving and inspecting returns. Partial refunds remain unimplemented, and all provider refund flows need Sandbox testing.

Enable checkout only after all launch checks pass:

```sql
update public.store_settings set policies_approved=true,checkout_enabled=true where id=true;
```

Also set `policiesApproved:true` in `config/store.json` so the UI enables the form. The database launch gate is authoritative even if a user modifies the browser.

Central page text is in `config/content.json`; review and approve its real policy paragraphs before launch. The database and public configuration approval flags are deliberate separate launch gates. The default maximum is five simultaneous unpaid/processing reservations per customer; an MFA owner can change the limit (1–50) in Launch settings. Processing payments are held for reconciliation and cannot be cancelled as ordinary unpaid orders.

Customers can select saved addresses at checkout; shipping options are filtered to the selected country and state/region, with the database enforcing the match again. Pending orders can be reopened from account history. A PayPal order already processing is reconciled using a trusted provider lookup before any further payment action; customers are told not to send a second payment while the result is uncertain.

## Netlify (preferred)

1. Put this project in your own Git repository; exclude `.env`, secrets and `node_modules`. Connect that repository in Netlify, with this folder as base.
2. Build command: `npm ci && npm run build`; publish directory: `dist` (provided by `netlify.toml`).
3. Set only these **public** build variables in Netlify: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_PAYPAL_CLIENT_ID`. Never set a service-role or PayPal secret as a `PUBLIC_` variable.
4. Deploy to staging, update Supabase redirects and `SITE_ORIGIN`, then exercise all acceptance scenarios. The security headers in `netlify.toml` must be checked against actual PayPal Sandbox behaviour; adjust only the specifically required domains after observing browser violations. Do not remove the policy wholesale.
5. For a custom domain, add the actual owner-supplied domain to Netlify, follow its shown DNS records and wait for TLS issuance. Update public domain config, Supabase redirects, Edge origin and all provider settings; rebuild. Do not invent DNS records or a domain.

## GitHub Pages alternative

Build the same `dist` directory and publish it using a GitHub Pages Actions workflow. Hash routes and relative assets work under a repository subpath. Set public build variables as repository variables, configure the exact Pages callback URL including subpath, and set Edge `SITE_ORIGIN` to the origin. GitHub Pages does not support the Netlify response-header file: use a hosting layer that supplies equivalent headers, or use Netlify for launch. SEO limitations below still apply.

## Indexing and SEO

Pre-launch `robots.txt` and the HTML noindex directive deliberately block indexing. Set the real custom domain, then use the public build variables with `node scripts/export-catalogue.mjs` and rebuild. Approved exported records generate static per-product HTML, canonical URLs, Product/Offer/Breadcrumb JSON-LD and sitemap entries; only available verified data is emitted. Static informational pages are generated from `config/content.json`. Publish/export again after catalogue changes. Remove noindex and change robots only after launch approval. Submit the final sitemap to Google Search Console, verify domain ownership with its actual DNS token, and check indexing; no ranking or indexing outcome has been claimed.

## Storefront publication checks

Migrations `014_storefront_catalogue.sql` and `015_ps5_pro_photo.sql` were applied to the hosted store on 2026-11-09. The public catalogue RPC replaces anonymous reads of the catalogue base tables. The existing admin policies continue to protect access to raw products, variants and inventory. The migration kept all 53 models, 112 internal SKUs and 795 provisional units. The catalogue exposes five distinct licensed photographs across six variant mappings. The iPhone 16 Ultramarine exterior is shared by its 128GB and 256GB options. Other models or finishes without approved photos use a neutral background.

Keep licensing evidence and review images in the source workspace. The public build copies only approved, quality-checked photos from `data/image-manifest.json` and publishes legally required credits on a separate acknowledgements page. Add new licensed local images to the manifest before publishing a corresponding variant.

Before opening checkout, approve the actual selling prices and confirm physical stock per SKU. Also confirm the customer support contact, legal business identity and governing terms, delivery regions, shipping and tax rules, warranty eligibility, privacy retention and rights procedures, and return terms. The proposed 30-day return window remains unapproved. Once approved, set `approvedReturnWindowDays` and finish reviewing the policy wording before enabling either checkout flag.

## Isolated local browser fixture

For testing UI controls without real services, build first and run `npm run qa:fixture`, then open `http://127.0.0.1:4174/#/account`. Use `owner@qa.invalid` and any disposable test password. This server implements in-memory responses only, labels the page as a local QA fixture and starts with no published catalogue. It cannot send emails or payments and does not touch Supabase. Never deploy it or treat its fake authentication as an integration test. Restarting clears its records. This continuation could not exercise it in a browser because browser automation failed to initialize.

## Backups, privacy and operation

Enable Supabase backups/PITR appropriate to the selected plan and test restoration into a separate project. Export schema and business data through approved database backup tools; keep backups encrypted with access limited to owners. Preserve separately licensed image originals and permission records, and exclude personal exports from source control. A restore drill must include inventory/order/payment reconciliation with PayPal/bank records to avoid duplicate fulfilment.

The owner must approve retention periods for customer profiles, addresses, order obligations, reviews, payment references and audit logs. Provide a real support/deletion request route. An authorized operator handles account deletion and anonymization while preserving required accounting records; automatic account deletion is not implemented. Rotate secrets, monitor auth/function errors and audits, apply dependency updates with regression tests, and document lost-MFA recovery. No email notification or newsletter service is configured.
