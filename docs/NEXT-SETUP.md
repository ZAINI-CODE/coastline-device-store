# Next configuration steps

The owner supplied the existing project's public URL and publishable key on 2026-11-01. They are configured in `.env.local`. Read-only remote checks succeed for Auth. The initially missing Google OAuth secret was configured by the owner; the latest authorization check now redirects to Google. Store tables remain unavailable through the Data API. See `docs/integration/SUPABASE-STATUS.md` for evidence and the remaining checks. No remote database structures were changed.

1. Keep the supplied public settings in the ignored `.env.local`. Never send service-role, database, PayPal or OAuth secrets into public configuration.
2. The user-completed live Google sign-in/callback/new-user and reload-persistence checks passed. Complete the remaining Email/password, recovery and logout checks with an appropriate confirmed account; do not send passwords or tokens into chat.
3. The initial audit confirms no store tables in `public`. Review `docs/security/SUPABASE-FINDINGS-2026-11-01.md` and run the remaining function/bucket read-only follow-up before an installation decision. A guarded application installer is prepared, not executed. Preserve Storage defaults and the existing auto-RLS function; do not grant customers schema privileges.
4. Configure email verification, recovery and redirects. Register and verify the actual owner, provision its UUID in `admin_members`, and enrol MFA.
5. Configure the three Edge Functions and provider secrets in Supabase's server-side settings. Test PayPal Sandbox and signed webhooks before enabling transactions. Zelle stays manually verified.
6. Supply actual products/revisions, prices, inventory and verified compatibility, business name/contact details, approved destinations/tax/shipping rules, policy text and domain. Existing studio files are separate assets; they do not verify stock or specifications.

Local code checks pass. Staging, provider and authenticated browser acceptance remain required. This session's browser automation failed to initialize, so new owner screens have not been browser-tested. No live readiness is claimed.
