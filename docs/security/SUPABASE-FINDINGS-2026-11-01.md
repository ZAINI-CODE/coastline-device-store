# Supabase security findings — 2026-11-01

Update 2026-11-03: the owner has supplied the follow-up function/bucket/role audit. See `docs/security/installer-review/FINAL-REVIEW.md` for its assessment and the corrected installer awaiting approval. Unresolved-follow-up statements below describe the earlier evidence state.

Project: `roamotmagssiipntchgh.supabase.co`. Evidence: the owner-provided SQL audit, read-only API checks, the current application source, and the official references linked below. This is a configuration review, not a penetration test or production certification.

**Decision: do not revoke Supabase Storage grants, alter internal Storage tables, disable RLS, force RLS, or add broad allow policies. No remote change was executed.** The evidence establishes a missing application schema, not a confirmed public Storage breach.

## Finding categories

- **Confirmed critical security exposures:** none established by this report. This does not prove the project is secure; bucket configuration, function definition and cross-user enforcement remain unverified.
- **Launch blocker / required application setup:** no store tables or columns exist in the audited `public` schema. Orders, inventory and application authorization therefore cannot be tested in the hosted project.
- **Normal defaults:** broad managed Storage grants, enabled RLS without custom allow policies, `rls_forced=false`, and an absent CLI migration-history table on a project not yet managed through CLI migrations.
- **Verification required:** the exact `rls_auto_enable` implementation/owner/event binding, API role attributes, bucket public/private settings, and any application relations in other schemas.
- **Recommendations:** versioned application migrations, least-privilege application policies, and bucket-specific policies only when an implemented upload feature actually needs them.

## 1. Storage grants: consistent with the standard model

The reported `anon` and `authenticated` CRUD grants on `storage.buckets` and `storage.objects` are consistent with Supabase's platform permission model. The upstream initialization migration grants schema usage and broad default privileges to the API roles. Later service migrations and deployed versions can narrow individual internal-table grants; this audit does not identify your exact Storage build. Treat the observed grant pattern as compatible with defaults, not proof of an accidental exposure or a byte-for-byte version match. [Official initialization source](https://raw.githubusercontent.com/supabase/postgres/develop/migrations/db/init-scripts/00000000000002-storage-schema.sql).

For ordinary API roles, a table grant permits an operation category while RLS controls eligible rows. A grant is not itself an RLS bypass. The `service_role` grants are expected for trusted backend operations; that role's credentials must remain server-side. No evidence here justifies revoking the managed Storage permissions. [Supabase access-control documentation](https://supabase.com/docs/guides/storage/security/access-control).

No `TRUNCATE` grant to `anon` or `authenticated` is shown in this audit. The service role's wider grants must not be mistaken for anonymous privileges. Ownership and role bypass flags were not included; inspect them before making stronger enforcement claims.

## 2. No Storage policies: absent, but not automatically a defect

`policies: []` means the queried `public` and `storage` schemas have no explicit policies listed by the audit. It is not evidence of hidden default allow policies. Supabase documents that Storage uploads are denied until suitable policies are added. For non-owner, non-bypass roles, enabled RLS with no applicable policies is a deny-by-default configuration. The absence is normal if direct client uploads have never been configured. [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

Important boundary: a **public bucket** serves files through its public retrieval endpoint without per-object read-policy enforcement. Private downloads require authorized access or a signed URL. Upload, update and deletion permissions remain separate. Your report did not list bucket rows, so it cannot establish whether public files or private buckets exist. [Public and private bucket behavior](https://supabase.com/docs/guides/storage/buckets/fundamentals).

`rls_forced=false` is not a reason to add `FORCE ROW LEVEL SECURITY` to Supabase-managed tables. Table-owner and privileged service access are intentional parts of the platform. Leave those settings unchanged.

## 3. `rls_auto_enable`: plausible protective function, not yet fully reviewed

Supabase publishes an event-trigger example named `rls_auto_enable()` using `SECURITY DEFINER` and `SET search_path = pg_catalog`. The observed attributes match that example. The intent is to enable RLS when tables are created in `public`. This supports an interpretation that the function is protective; its name alone does not establish its origin or behavior. [Official event-trigger example](https://supabase.com/docs/guides/database/postgres/event-triggers).

`SECURITY DEFINER` executes with the function owner's privileges. A trusted search path is a useful hardening measure, but it cannot establish that an unknown function body is safe. The existing report omits its body, return type, owner, ACL and attached event trigger. Do not replace it, revoke its permissions or certify it solely from the supplied attributes. [PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html).

Read-only checks still needed:

- Confirm `RETURNS event_trigger`, an intended trusted owner, and the complete function definition.
- Confirm the attached trigger is enabled, bound to this exact function, and limited to intended table-creation events.
- Review dynamic SQL and identifier handling, schema restrictions, and error behavior. Confirm errors do not silently leave an intended protected table unsecured.
- Check effective execution grants and whether untrusted roles can create objects in `public`. Do not apply generic grant changes without inspecting the actual function and role context.

Even a correct auto-enable trigger only enables RLS. It does not create the application's ownership/moderation/admin policies and is not a substitute for them.

## 4. Migration history: application tracking is separate from platform history

`migration_history_exists: false` means `supabase_migrations.schema_migrations` was absent when the audit ran. It does not mean Supabase failed to install its platform schemas, and does not prove that no SQL has ever run. CLI migration tracking uses that table; direct dashboard SQL changes bypass that tracking. A new or dashboard-managed project can therefore have working Auth/Storage without application migration history. [Official migration tracking guide](https://supabase.com/docs/guides/deployment/database-migrations).

The separately reported `storage.migrations` table belongs to the Storage service. Do not create, repair, delete or seed that table manually. Do not invent CLI history entries merely to make a history check pass. Choose a migration workflow and record a reviewed application baseline when installation is approved.

## 5. Application schema: `public` is empty of tables; the whole database is not empty

The table report contains eight Storage tables and no public tables. `public_columns: []` corroborates the absence of public relation columns visible to this administrator audit. Only the `rls_auto_enable` function is listed in `public`. No conflicting store objects are shown there.

This establishes that the expected store application schema has not been installed in `public`. It does **not** establish an empty database: managed Storage tables exist, and the user-completed Google test already verified an Auth account. The original query did not inventory other custom schemas, all views or foreign tables. A follow-up inventory can identify those before any broader claim or installation.

## 6. Storage architecture for the electronics store

### Required now: no Supabase Storage bucket

The current implementation deploys optimized product images as local static assets. Zelle accepts a transaction reference without accepting uploaded evidence. The existing code therefore does not require a Storage bucket or Storage policy today. Creating buckets and permissions without a consuming feature would add unused access paths. Future Storage image URLs will also require a deliberate change to the frontend's current local-path allowlist.

### Future product images: `product-images` (proposed)

Use a public bucket only for approved, intentionally public catalogue photographs or studio assets. Public downloads need no extra anonymous object-read policy at the public endpoint. Draft/embargoed material and private customer records must stay elsewhere. Restrict authenticated uploads, edits and deletions to a backend-verified, MFA owner and this bucket alone. Ordinary customers and anonymous visitors must have no write permission through policies. Prefer unique versioned filenames. Proposed size/type limits: 5 MiB, JPEG/PNG/WebP/AVIF; validate actual image bytes server-side before publication. These are proposed technical limits, not configured bucket properties.

### Future Zelle screenshots: `payment-evidence` (proposed, private)

Create this only when the supporting upload/validation feature is implemented. Suggested object layout: `<customer UUID>/<order UUID>/<random file UUID>.webp`. Permit append-only uploads only for the authenticated owner of an eligible Zelle order; never accept an order UUID alone as authorization. Customer reads, if offered, must be limited to that customer's own order, with MFA-owner review access. Deny customer overwrite/deletion. Use short-lived authorized downloads and a reviewed backend retention/deletion workflow. Proposed limits: 5 MiB, JPEG/PNG/WebP only, with decoded-image validation, metadata handling and safe display. A screenshot must never mark an order paid; actual bank receipt and owner verification remain mandatory.

No avatars, invoices, analytics or vector buckets are necessary for currently implemented features. Add private invoice storage later only if real generated invoices require it. The preinstalled analytics/vector **tables** do not prove any such **buckets** exist.

Use the supported Storage API/Dashboard to create buckets and upload/delete files. Do not manipulate internal Storage row metadata or table definitions to simulate file operations. [Storage schema guidance](https://supabase.com/docs/guides/storage/schema/design).

## Exact SQL: what is necessary and what is not

**Storage remediation migration: none justified at present.** No Storage grant revocation, broad allow policy, table modification, RLS disable/force operation, or replacement auto-enable function is supplied.

**Read-only investigation:** `supabase/audits/storage_function_followup.sql` returns the missing function definition/owner/ACL, event-trigger binding, bucket configuration, API role flags, public-schema creation permissions and other non-managed-schema relations. It does not fetch object names, customer files or credentials. It was syntax-tested locally.

**Application setup, separate from Storage remediation:** `supabase/setup/install-store.sql` packages the ten local application migrations. It is prepared, not remotely executed and **not an instruction to install before reviewing this report/follow-up**. It uses one transaction, stops on an existing application object/function, preserves Storage and unrelated public functions, and leaves checkout disabled. It creates 23 store tables with explicit access rules. Review SQL and choose the CLI-managed migration workflow before deployment. A manual SQL Editor installation does not populate the CLI's tracking history automatically; do not later run `db push` without a reviewed baseline.

A local migration defect was corrected before packaging: the blanket `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public` was replaced with application-function-specific revocations, and broad service grants were narrowed to application tables/sequences. This avoids changing `rls_auto_enable` or unrelated objects. This was a source correction only; no remote permissions were changed.

## Validation and remaining acceptance

Seventeen local tests pass. New installer tests preserve a pre-existing function's definition and execute permission, preserve simulated Storage rows/grants, verify application RLS/disabled checkout, reject repeated installation, and reject collisions without overwriting an existing table. Local fixtures are isolated and not a hosted Storage service test.

Hosted acceptance still requires: full application-schema installation/review, two-customer isolation tests, MFA-owner enforcement, real inventory concurrency/expiry checks, payment Sandbox tests, and any later bucket-specific access tests. If Storage uploads are added, test anonymous/customer-A/customer-B/MFA-owner access, guessed order paths, forbidden overwrites, private/public download behavior, and size/type/content validation. **The project is not production-ready.**
