# Product images and catalogue publication

Updated 2026-11-03: Four genuine licensed photographs are stored locally and used in the review: Ultramarine iPhone 16 (CC BY 4.0), original white DualSense (CC BY-SA 4.0), original PS5 disc console with controller (CC BY-SA 4.0), and white DualSense Edge (CC0). The standard DualSense original was upgraded to 3120 × 2760. Attribution, source links, changes and derivative licences remain on the image-credits page; photographs have no added credit/watermark/promotional overlay. Native physical product branding is retained for accuracy. Exact US retail revision/storage cannot be proved solely from a photograph, so all sale offers remain unpublished.

The owner's latest instruction prohibits AI product images. Earlier generated studio files remain historical source files only, are rejected by the frontend path validator, have no frontend references, and are excluded from the build. Their provenance is retained so they are never mistaken for genuine photos. They are not replacements for missing photos.

`data/products.json` now contains 44 manufacturer-verified, unpublished research drafts in exactly six approved categories. Only four have approved photos; the other 40 remain listed in `docs/images/IMAGE-GAPS.json`. The local review's visual catalogue excludes all missing/rejected photos; the model-research page is text-only, not a grid of placeholders. Owner sale prices and inventory are null everywhere.

Additional primary-source candidates and rights are recorded in `docs/images/additional-photo-candidates.json`. The downloaded iPhone 17/Lavender, 17 Pro/Silver and 17 Pro Max comparison photos were rejected for hands/tethers, retail display text and/or multiple products. The alternate iPhone 16 rear photo and mixed AirPods photo were also rejected. Explicitly generative-edited iPhone sources were excluded. Several other candidates could not be downloaded because Wikimedia returned HTTP 429; no rate-limit workaround was used. A CC0 AirPods 4 photo remains rejected for soft focus and unknown ANC subvariant.

Apple's [third-party guidelines](https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html) say express written permission is necessary for photographs owned or licensed by Apple. A public product webpage does not establish commercial reproduction permission. The independently made Wikimedia source photographs have their own documented licences; meet their attribution/share-alike terms. For any future manufacturer, distributor or stock image, establish its actual commercial permission before downloading for publication. An image licence does not verify owner stock, specifications, or the exact sellable hardware revision.

For each variant: verify manufacturer, released model, exact colour/configuration and compatibility, source a permitted photograph, preserve permission evidence, optimize locally into `images/<variant>.webp`, and enter an image manifest record:

```json
{
  "product_id": "actual database UUID",
  "product_name": "verified name",
  "variant": "verified colour / configuration",
  "filename": "actual-file.webp",
  "local_path": "images/actual-file.webp",
  "original_source": "source URL or owner original reference",
  "permission_status": "approved",
  "permission_evidence": "permission document reference",
  "verification_date": "actual verification date"
}
```

Place publishable genuine assets under `images/products/`. Studio and research files must not be deployed. The build copies optimized web assets, keeping large research originals out of deployment. Variant image paths accept local supported raster images only. Set `image_source`, `image_permission='approved'` and `image_verified_at` before activation; verify prices with `price_source` and `price_verified_at`. Do not activate merely to bypass a constraint. Database checks cannot independently prove a licence or that a local file exists; the owner must review evidence and staging display. An invalid/missing image must cause the affected product to be unpublished, never silently replaced. Each variant supports a primary `image_path` and additional exact-variant `gallery_paths`. All images in that gallery need the same verification process.

Current research notes: the Apple US iPhone 16 purchase page showed a $829 connect-to-any-carrier-later reference on 2026-10-31. This is not the store's selling price. The old AirPods 4 specifications URL redirected to AirPods 5 during verification: it must not be used for AirPods 4 imagery or specifications. Support archive specifications are retained only as research. Recheck pricing, exact model numbers, live availability and all rights before import.

