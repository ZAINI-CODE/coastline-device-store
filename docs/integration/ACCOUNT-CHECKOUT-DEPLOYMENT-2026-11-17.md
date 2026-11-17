# Account and checkout deployment — November 17, 2026

Published at https://coastline-device.netlify.app/ through Netlify deploy `6afc8ca97af803dafb9676ed`. Live JavaScript, stylesheet, content and flag files were checked against the build. Migrations 028, 029 and 030 were applied to the existing Supabase project as an incremental transaction, without running the installer.

## Implemented

- Account overview opens first. Edit Profile and Account security are separate closed disclosures.
- Google name and picture synchronize into the existing profile record. Manual names and picture preferences remain intact on later synchronization.
- Profile pictures upload as resized WebP files to a private, owner-scoped bucket and display through temporary signed URLs. Upload/change, remove and Google-picture controls are provided. Profile contact is optional so picture edits do not require adding a number; registration and checkout retain required contact fields.
- Registration, profile and checkout use the same country/flag selector and E.164 normalization. Checkout prefills available account details and displays the authenticated email.
- Apple and Google SVG icons render at 20 by 20 pixels. Apple remains disabled because the owner confirmed its provider credentials are not configured.
- Purchase and positive actions use green, destructive actions red, and general actions blue. Admin order-action colour changes with the operation selected.
- The checkout submit handler targets its submit button instead of the country-picker button.
- The public projection and order-item guard share purchase readiness. An optional, non-variant PC exterior-colour placeholder no longer blocks an otherwise confirmed fixed PC configuration. SKU, price evidence, active/published state, configuration, image approval and non-provisional inventory checks remain enforced. Incomplete phone configurations still fail closed.

## Reviews

All 150 published reviews matched the supplied feedback by product ID, customer name, rating and text. Live pages showed 15 reviews for iPhone 16, 13 for iPhone 17, and 12 for iPhone 17e. Existing counts and associations were preserved. No reviews were fabricated, deleted, redistributed or submitted during testing. Signed-in review controls, including a 4.5-star selection and submission for moderation, were verified without posting test feedback.

## Verification completed

- Fresh Google authorization and callback with the owner-approved testing account returned to the account overview. Name and Google photo synchronized; the photo loaded; edit panels stayed closed.
- Uploaded the same existing Google profile picture through the live profile editor. Save succeeded and the image loaded through the private signed-URL endpoint. No substitute identity or invented contact data was used.
- Live desktop and 393-pixel mobile account views; mobile country search and Pakistan +92 placeholder; no horizontal overflow.
- Live cart continuity after sign-in, In Stock status and quantity limits; cart-to-checkout navigation; authenticated email and name display.
- Missing mandatory checkout phone blocked submission. Alaska and the $25 fast-delivery option selected a valid shipping rule. Checkout retained U.S.-only delivery, active Zelle and disabled PayPal/cards.
- Computed purchase-button green and Remove-button red; both provider icons visible in the sign-in screen; white default background.
- Hosted profile RLS enabled, avatar bucket private with a 2 MB limit and WebP restriction, anonymous profile-sync execution denied, authenticated execution allowed. No published in-stock variant failed the shared readiness check.
- 36 frontend regression tests and 18 targeted account/checkout/payment/review security tests passed. The five persistent-catalogue tests also passed after extending the full mixed-campaign checkout fixture to cover the PC colour-placeholder regression. Additional catalogue schema/import fixture tests passed.
- Production build succeeded. No browser console errors were observed during the live account/profile checks.

## Data preservation

Before and after the migration: 53 database products, 115 variants, 150 reviews and 3 orders. The public storefront still contained 13 published products. Final checks after browser testing still showed 150 reviews and 3 orders. Aggregate fingerprints for all variant prices and inventory quantities were unchanged. Requested profile synchronization and the owner's picture upload are the intentional customer-data changes.

## Not claimed as tested

- Apple authentication: blocked until the owner configures its provider credentials.
- A new email-registration verification callback was not performed in this release.
- No real order, payment, refund, bank verification, shipping notification or delivery was generated. Full live payment completion requires the owner to use actual delivery/contact details and verify the bank receipt.
- Live picture removal was not exercised; owner isolation and deletion policies were tested in isolated PostgreSQL. The uploaded copy of the existing Google picture remains available to the owner.

## Recovery

The private working directory `.private/account-updates/` contains the pre-migration function definitions, before/after data fingerprints, security checks, deployment package and screenshots. `rollback-functions.sql` restores the three previous function definitions if a regression requires a full rollback; pair it with the previous Netlify release `6af7d34fc4869be50057e873`. Retain the new private profile columns and uploaded pictures rather than deleting customer data. Do not rerun the complete SQL installer or reset/reseed inventory.

## Feature commits

- `4a5a050`: purchase readiness and private profile storage.
- `aa67176`: account overview, avatars and international contacts.
- `94b6d93`: semantic action colours.
- `1c135b7`: configured Apple provider availability.
- `52485f7`: profile-picture edits without a mandatory contact number.

Private exports, signed URLs, credentials and profile-image files are excluded from Git.
