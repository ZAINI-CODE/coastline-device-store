# Catalogue and backend continuation

No hosted SQL, deployment, authentication configuration change, or database write occurred. The owner's final price and stock sheet is pending. Installer approval remains outstanding.

## Prepared locally

`npm run catalogue:prepare` writes `outputs/catalogue-import/draft-plan.json`. It contains 53 product records and six approved category records with stable version-8 UUIDs. Product rows use only existing reviewed-schema fields. A full local source_record preserves specifications, image metadata, supplier references, pricing proposals and unresolved details; it is provenance, not a database column. The build does not copy this plan to the public frontend.

No variants or inventory are fabricated. The schema requires positive variant prices and exact SKU/configuration, so those rows await the final sheet. Zero stock must mean a confirmed zero, not unknown stock. Reference/proposed prices are not active sale prices. All planned products remain unpublished and checkout disabled. Selected images with unconfirmed rights remain local-review assets.

Stable IDs prevent plan drift across retries but are not permission to overwrite existing records. Before any import, reconcile current hosted categories/products by both identity and UUID; abort on ambiguous matches. Add the six approved categories without deleting historical category rows or their dependencies. Reuse an existing compatible category ID when appropriate and remap product category_id in the reviewed execution plan. A database importer/execution transaction is not yet supplied or executed.

## Fixes

- Published catalogue export now goes to outputs/catalogue-export/published-products.json, preserving data/products.json and its owner-supplied details.
- Homepage feature images and the foldable media layout can resolve stable catalogue keywords after products receive database UUIDs.
- Backend test suite includes catalogue-plan validation and insertion of all planned product rows into isolated PostgreSQL, checking unpublished product RLS for anonymous and customer roles.

## Current hosted blocker

Validation completed: 9 backend tests and 22 frontend tests passed; all five Edge source files parsed. These tests use isolated PostgreSQL and mock provider/Auth services, not hosted acceptance tests. The reviewed installer hash remains unchanged.

The latest read-only doctor reports public.categories and public.store_settings absent from the API schema cache. This confirms those API resources are unavailable; it does not alone establish physical table absence. A fresh SQL schema audit and backup are needed before installation, as described in the unchanged migration safety review.

## Next actions requiring owner input

1. Explicit approval of supabase/setup/install-store.sql, SHA-256 7750584909226e1e0497ab925614f5b976a86a1b4473cf38ef4c3dbba3325cc1, after reviewing docs/security/migration-safety-2026-11-06/REVIEW.md and backup/preflight conditions.
2. Final variant sheet: local product ID, exact SKU, colour, storage/configuration, USD selling price, owned stock quantity and supporting price source/confirmation. Include confirmed zero stock explicitly; leave unknown fields blank.
3. Confirm exact image mapping and commercial rights before publication.

After schema installation is approved and verified, prepare and review the actual import transaction against existing rows. Payment secrets stay in private server configuration. Hosted customer isolation, owner MFA, Edge Functions and PayPal sandbox/webhook/refund tests must pass before checkout activation. This work does not establish production readiness.
