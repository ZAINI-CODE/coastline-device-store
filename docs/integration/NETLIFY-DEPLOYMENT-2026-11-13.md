# Netlify deployment — 13 November 2026

Public storefront: https://coastline-device.netlify.app

Netlify project: coastline-device, ID 797bff30-ae8a-4e73-9064-6f3b6d6a0e21, team zaini-code.
The production site is public; previews remain private. The owner explicitly approved these launch access settings. Initial upload failed; retry succeeded within the same project, without creating another project. A subsequent successful deployment contains metadata rebuilt for the assigned Netlify origin.

Only the prepared public static files were uploaded. The package includes `_headers` derived from the existing netlify.toml. No environment files, private folders, database source, or backend credentials were included. The frontend uses its existing Supabase public publishable key. Manual upload deployment is configured; automatic Git-based builds are not configured.

## Approved configuration applied

- Supabase Site URL: https://coastline-device.netlify.app/
- Added redirect: https://coastline-device.netlify.app/**; retained previous entries.
- Edge Function SITE_ORIGIN: https://coastline-device.netlify.app
- Search indexing remains disabled for the temporary launch.
- Custom domain coastlinedevice.com is not purchased or connected. No DNS or purchase changes were made.

## Verified on the hosted site

- Homepage, shop, favicon, public configuration and robots.txt return HTTP 200. CSP and nosniff headers are present. Canonical URL points to the Netlify origin.
- HTTP HEAD checks passed for all 320 packaged HTML/image/script/style URLs, with no failures. Evidence: .private/netlify-launch-2026-11-13/asset-http-check.json.
- Connected catalogue renders 13 products with existing prices and availability.
- Fresh Google login using the existing store account returned successfully to the Netlify account page. Account session restored after reload; callback authorization code was absent afterward.
- Authenticated checkout loads shipping options and Zelle from the hosted API. Zelle is selectable; PayPal is visible as Temporarily Unavailable and disabled. Cards are disabled; Safepay is absent.
- API CORS preflight returned HTTP 200 with exactly the approved Netlify origin.
- At 390px mobile viewport, checkout page width was 375px and payment controls retained the correct availability; no horizontal overflow.
- Temporary browser cart item was removed. No order, bank payment, customer review, product, price or inventory change was performed.

## Remaining limits

This deployment is not certification of full commercial launch readiness. Fresh email/password and delivered email-link callbacks were not tested on this hosted origin. Customer order emails remain in test mode with the scheduler paused, as documented in LAUNCH-SETUP-2026-11-13.md. The unpurchased domain's support mailbox is not verified operational. Actual Zelle receipt and subsequent paid/dispatch/delivery lifecycle were not exercised with a real transfer. PayPal is intentionally unavailable. Netlify adds its platform badge under the current plan; no paid upgrade was purchased.

For future manual deployments, build with PUBLIC_SITE_URL=https://coastline-device.netlify.app, upload only the public artifact including security headers, and verify the live response headers afterward. Keep secret values in Supabase. Domain cutover requires ownership, DNS/TLS, metadata, authentication redirect and SITE_ORIGIN updates for the chosen final origin, followed by fresh authentication and checkout verification.

Evidence screenshots are under .private/netlify-launch-2026-11-13/: live-homepage.png, live-checkout.png, live-checkout-mobile.png and deployed-project.png. They contain no credential values.
