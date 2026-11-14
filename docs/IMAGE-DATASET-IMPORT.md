# Product image dataset and galleries

Frontend work only. SQL, security documentation and Supabase are unchanged. Importing a dataset never activates a product or invents a price, specification, stock quantity or permission.

## Dataset layout

Keep original photos in folders, with a JSON manifest matching [dataset-template.json](images/dataset-template.json). Each image needs:

- Exact existing `product_id` from `data/products.json` (44 researched models).
- Explicit `variant_key`, `color` and `configuration`; no filename-based model guessing.
- Distinct `angle` key, such as `front`, `rear`, `left`, `ports` or `detail`, plus a readable label.
- Relative `file` path inside the dataset folder.
- `kind: "photograph"`, source, and documented ownership or commercial-use rights.

For a new colour/configuration, `allow_new_variant: true` stages it as a new variant needing review. It does not silently replace an existing variant. If a known key conflicts with its colour/configuration, the batch is rejected. Specifications and product descriptions supplied with the dataset must be separately matched and verified before changing the catalogue; the image importer does not overwrite them.

## Review and import

From the project directory:

```powershell
node scripts/import-product-images.mjs --manifest "C:\your-dataset\dataset.json" --source "C:\your-dataset"
```

This is a dry run: it validates matching, source paths, image decoding/resolution, duplicate bytes and output collisions without writing files. Review the printed plan before staging:

```powershell
node scripts/import-product-images.mjs --manifest "C:\your-dataset\dataset.json" --source "C:\your-dataset" --apply
```

Staging stores immutable filenames under `images/imports/`, originals under `images/originals/imported/`, and a batch report under `data/image-import-batches/`. Identical existing files are reused; different bytes at an existing target cause an error. Exact duplicate photos are not counted as different angles; assigning identical bytes to different products/variants is rejected. The source directory and source files are never modified.

Only JPEG, PNG, WebP and AVIF still images are accepted, up to 25 MB / 64 megapixels, with at least 960 pixels on the longest edge. Orientation metadata is respected, responsive WebP sizes are produced without enlargement, metadata is stripped from derivatives, and backgrounds/colours/products are not generated, cropped or recoloured. Filename/path validation prevents directory traversal and source symlinks escaping the dataset folder.

## Human approval before display

All staged records start with rights and visual review pending. They are excluded from the deployed build and the frontend's accepted image paths. Inspect each full image for genuine photographic origin, model/generation/colour/configuration, complete product edges, focus, watermark/promotional text and rights. An importer cannot prove model accuracy or copyright ownership from pixels or filenames.

After review, copy approved immutable files into `images/products/`, record source/licence/change notices in `data/image-manifest.json`, and explicitly attach the approved primary path and distinct `gallery_paths` to the matching variant in `data/products.json`. Keep required attribution on the image-credits page. Do not publish a sellable offer merely because an image was approved; owner prices, SKU, exact retail configuration and inventory remain separate gates.

The frontend accepts primary + legacy `gallery_paths` and richer per-image descriptors, including product/variant identity, angle label, alternative text, dimensions and source hash. The read-only preview further requires each image to be approved in the manifest for the same product. Responsive sizes of one original are deduplicated. Different photo proportions use containing frames; switching photographs does not crop them or move the surrounding product details. Thumbnails, next/previous buttons and arrow/Home/End keys are supported when multiple genuine views exist. One image is shown once when only one approved photograph exists.

## Themes and motion

The header theme button switches light/dark, persists the choice locally and initially follows the operating system. Photography stays neutral and unfiltered in both themes. Section reveals, card/button responses, theme transitions and gallery fades respect reduced-motion preferences; content stays readable if animation support is unavailable.

## Current gaps

Four approved genuine photos currently cover four of the 44 researched products. The other 40 remain listed in `docs/images/IMAGE-GAPS.json`; no missing photograph is silently replaced. Additional angles and the remaining exact-model photos await an acceptable dataset or verified rights source. All sale offers remain unpublished and service connections paused during frontend review.
