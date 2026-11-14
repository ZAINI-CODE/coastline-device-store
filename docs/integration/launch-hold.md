# Frontend deployment hold — November 11, 2026

Update — November 12: the owner explicitly authorized Zelle implementation and activation. Zelle-only checkout is now enabled in the hosted project, with manual bank verification and MFA-protected admin actions. PayPal/cards remain disabled. See [ZELLE-CHECKOUT.md](ZELLE-CHECKOUT.md) for applied changes and test limits. The historical disabled-checkout findings below describe the earlier inspection. Public frontend deployment remains on hold; actual bank acceptance and email delivery remain pending.

No public deployment is authorized before the owner supplies the logo, favicon and banner. Checkout must remain disabled until payment integration is ready. Existing reviews and inventory must remain unchanged.

The existing `dist/` build was inspected without repeating the previous 55-test suite. The deployment manifest is saved privately at `.private/launch-readiness/deployment-manifest.json`, with SHA-256 hashes for all 292 files (14,600,268 bytes). Read-only live checks found 13 published products and all 90 referenced product image paths present in the build. Entry-page scripts/styles are present. The scan found no environment files, private folders, SQL, tests, source maps, private-key blocks or service-role JWTs in the build. This is a scoped packaging check, not a full security certification.

The build uses live Supabase public configuration, with frontendReview and localTools off. PayPal has no client ID configured. The hosted store_settings checkout_enabled value was read as false; it was not updated. Netlify response headers are configured in the existing netlify.toml, but cannot be verified on the public host before deployment. Prelaunch noindex remains in place.

A fresh Google login reached Google's account chooser, used the existing store account and returned to localhost:4173/#/connection. The page reported that Supabase verified a sign-in after this test began; the authorization code was removed from the address bar. No Google callback error was observed. The browser session restarted before the first reload-persistence check finished. After restoring the local preview, the same signed-in identity was present; a new reload check explicitly reported “Session restored after reload and identity verified by Supabase.” Evidence is saved privately at .private/launch-readiness/session-persistence.jpg. Fresh email/password login and delivered email-link callbacks require the owner's account interaction; these must not be marked passed from mocks or the old tests.

## Release sequence after branding is supplied

1. Integrate the owner-approved logo, favicon and banner. Preserve the theme and catalogue. Rebuild once and regenerate the private file manifest.
2. Confirm the hosting provider/account. The existing repository configuration targets Netlify with publish directory dist and build command npm ci && npm run build. Do not upload the project root or .private directory. Use only the public Supabase URL and publishable key as frontend build settings; keep payment/service secrets server-side.
3. Finish the fresh email/password and email-link callback tests in the same browser that initiated the flow, including review return and reload persistence. PKCE email callbacks require the initiating browser's verifier: https://supabase.com/docs/guides/auth/sessions/pkce-flow .
4. Obtain explicit deployment approval after branding review. No deployment, DNS or hosting-account changes were performed during this check.
5. On the approved production host, verify coastlinedevice.com TLS, static assets, response security headers, Supabase redirect matching and the Edge Functions' allowed origin. Change the default Supabase Site URL from local testing to the production URL only as part of approved launch configuration. Do not assume the hosting provider has applied netlify.toml headers until observed.
6. Test authentication again on the real HTTPS origin. Keep checkout disabled and noindex intact until the corresponding launch gates are approved. Payment acceptance and checkout activation are separate from static frontend publication.

Pending owner input: logo, favicon, banner; hosting provider/account; fresh email authentication test results. No passwords, tokens or confirmation links should be pasted into chat.
