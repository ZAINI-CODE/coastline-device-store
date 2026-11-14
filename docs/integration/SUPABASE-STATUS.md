# Existing Supabase integration — updated 2026-11-03 (Asia/Karachi)

## Local configuration completed

- The supplied project URL and publishable key are in `.env.local`.
- `.gitignore` explicitly contains `.env.local` and also excludes `.env.*` except `.env.example`. A test checks that exclusion. The workspace has not been initialized as a Git repository, so no Git index was modified.
- Builds, setup diagnostics and catalogue export load `.env.local` before shared `.env` defaults; real process variables retain precedence.
- The browser receives only the explicitly allowlisted project URL, public key and optional public PayPal client ID. No secret/service-role key was requested or used. Build validation rejects secret/service-role key formats.
- Supabase Auth explicitly enables persistence, token refresh and PKCE. A connection/session page is available at `#/connection`.

## Read-only remote results

Target: `roamotmagssiipntchgh.supabase.co`.

- Auth health: HTTP 200.
- Auth settings: HTTP 200. Google and Email are enabled; Apple is disabled. Email signups are enabled and email confirmation is required.
- An unauthenticated user request correctly returns HTTP 401 (`no_authorization`).
- The first Google authorization check returned HTTP 400 (`Unsupported provider: missing OAuth secret`). After the owner configured that secret, the retry returned HTTP 302 to `https://accounts.google.com`. The requested provider callback is `https://roamotmagssiipntchgh.supabase.co/auth/v1/callback`; the generated authorization request uses PKCE and contains a Google client ID. Google's next endpoint returned HTTP 302 within `accounts.google.com`. The secret was never requested or read. Google sign-in is re-enabled locally. **This verifies initiation, not consent completion, a successful callback exchange, user creation or session persistence.** Those require the interactive check below.
- The Data API responds, but all 23 expected store resources return HTTP 404 / `PGRST205` (“not found in the schema cache”). These requests used `limit=0` and did not retrieve customer rows. This does **not** prove that every table is physically absent: schema exposure, grants or cache state can also affect visibility.
- Public-key API metadata introspection returns HTTP 401 (“Secret API key required”). A secret key was not requested as a workaround.

Machine-readable evidence without keys or user tokens: `supabase-readonly.json` contains the initial broad checks, `google-latest.json` supersedes its Google result after the provider-secret fix, and `google-interactive.json` records the user-completed live sign-in/persistence checks. Probe timestamps are UTC; the document date above uses the user's local timezone.

## Database preservation and required preflight

Update after the owner-provided audit: `public` has no reported tables or columns, eight Storage tables have RLS enabled, no policies are listed, and the only public function is `rls_auto_enable` with a hardened search path. The CLI migration history table is absent. The Storage/function security review and required read-only follow-up are recorded in `docs/security/SUPABASE-FINDINGS-2026-11-01.md`. No Storage grant revocation or internal-table modification is justified. The remaining function/bucket follow-up is distinct from the already completed initial audit.

No application tables, policies, functions, data or migration histories were created, overwritten or changed remotely. No migration was applied. Existing database structure must be inspected before applying the project migrations.

Run `supabase/audits/schema_rls_report.sql` in an authorized Supabase SQL Editor session for a single metadata-only JSON result. The longer `read_only_project_audit.sql` also provides separate query results in a read-only transaction. These inspect table/RLS flags, policies, grants, columns, function security/search-path settings and migration-history existence. Share the schema/policy results, without customer records or secrets, for comparison with the local migrations.

The owner supplied the hosted read-only follow-up on 2026-11-03: no buckets or other reported custom relations; anon/authenticated cannot create in public or bypass RLS; the trusted service role has its intended bypass. The existing postgres-owned auto-RLS event function is narrowly scoped but catches/logs failures instead of aborting. It is preserved. See `docs/security/installer-review/FINAL-REVIEW.md`.

Migrations `001_store.sql` through `011_application_privileges.sql` now form a corrected, atomic installer. Migration 011 incorporates the application-only privilege reset, explicit function search paths, narrow moderation grants and refund-proof/retry checks. The original installer and review remain historical evidence. **The corrected installer is awaiting owner approval and has not been applied to Supabase.** Review `supabase/setup/install-store.sql` and its manifest before approval; do not run the historical proposal separately. Public/publishable keys cannot run DDL.

## RLS status

**Hosted RLS is not verified.** Empty responses, inaccessible metadata and missing API resources are insufficient evidence. The local migration suite tests policy logic in PostgreSQL, but those tests do not prove the policies are installed in this project. Hosted acceptance requires the read-only audit plus two authenticated customer accounts and an MFA owner. Verify that customers cannot read each other's orders, items, payments, addresses or private profiles; cannot update authoritative totals/payment/stock/roles; and cannot modify audit logs.

## Authentication and session-persistence status

**Live Google sign-in, callback, new-user creation and persistence were confirmed through the user's completed checks.** The user completed Google consent in the local app, reported that Supabase verified the signed-in identity and Google callback, and that a newly created Supabase account was verified during that flow. The user then clicked **Reload & test persistence** and confirmed **Session restored after reload and identity verified by Supabase**. This is user-completed live acceptance, not an automated browser observation by the agent. No password, OAuth secret, user UUID, email address or token is recorded in the evidence file.

**Email/password sign-in, recovery emails and live sign-out remain untested.** No passwords were requested or supplied. Browser automation still failed to initialize; no email/password test user was created by the agent and no verification/recovery email was sent by the agent.

The automated SDK storage test restores and clears a session across client instances against a mocked Auth server. That tests the session-storage mechanism only. It is not a successful hosted login.

To finish the live check:

1. Run `npm run build` and `npm run dev`; open `http://localhost:4173/#/account`.
2. Sign in yourself using an existing confirmed Email account. Do not send a password or session token into chat.
3. Open `http://localhost:4173/#/connection` and choose **Reload & test persistence**.
4. A successful result must say **Session restored after reload and identity verified by Supabase**. Sign out and verify that the session is no longer present.
5. On `#/connection`, choose **Test Google sign-in** and complete the Google flow yourself. It requests return to `http://localhost:4173/#/connection`; add the actual local/production callback destinations to Supabase's redirect allowlist as appropriate. The provider callback at Google remains the Supabase `/auth/v1/callback` URL shown above.
6. After returning, the page verifies the current user through Supabase and compares the Google identity/sign-in timestamp with the start of this flow. It distinguishes a newly created account from an existing-account sign-in; signing into an existing account does not test new-user creation. Choose **Reload & test persistence**, then sign out. No user token or secret is displayed.

Account authentication now remains usable independently of missing store tables: the customer dashboard shows a setup notice if its store queries fail, and guest cart data is preserved when account cart sync is unavailable.

## Validation and readiness

The local build succeeds. Fifteen automated tests pass, including environment precedence, public-key guardrails, explicit `.env.local` exclusion, schema/RLS rule tests, session storage against a mock Auth server, and the read-only audit SQL. All four Edge Function source files parse.

Not production-ready, not staging-validated and not payment-Sandbox-tested. Blocking work: schema preflight/compatible migrations, hosted RLS verification, remaining Email/password/recovery/logout tests, and the previously documented payment/business/catalogue configuration. The Google provider-secret error is resolved, and the user-completed live Google sign-in/persistence check passed.
