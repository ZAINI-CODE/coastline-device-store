# Coastline Device identity

Original vector identity created November 11, 2026 after the owner clarified that the two supplied pictures were design references. The CD monogram combines an open coastline curve, a device-shaped D and a wave. The exact wordmark is Coastline Device. Primary logos and icon-only artwork have transparent backgrounds. Favicons use a navy tile for contrast. Reference pixels are not used in these final assets.

## Logo assets

- images/branding/coastline-device-light.svg
- images/branding/coastline-device-light.png (1800 × 500)
- images/branding/coastline-device-dark.svg
- images/branding/coastline-device-dark.png (1800 × 500)
- images/branding/coastline-device-icon-light.svg
- images/branding/coastline-device-icon-light.png (1180 × 1000)
- images/branding/coastline-device-icon-dark.svg
- images/branding/coastline-device-icon-dark.png (1180 × 1000)

Light means artwork for light backgrounds; dark means artwork for dark backgrounds. SVG wordmarks use editable Segoe UI / Arial text. PNGs are rendered exports. Rebuild assets with node scripts/build-brand-assets.mjs.

## Favicon assets at project root

- favicon.svg (original vector icon)
- favicon.ico (16, 32 and 48 pixel entries)
- favicon-16x16.png
- favicon-32x32.png
- apple-touch-icon.png (180 × 180)
- android-chrome-192x192.png
- android-chrome-512x512.png
- site.webmanifest

## Integration files

- index.html: header/footer image links, favicon links, Apple touch icon and web manifest.
- js/app.js: removed text-node replacement for the former header/footer wordmarks so image elements remain intact.
- css/product-experience.css: scoped logo size rules and theme-specific asset visibility. No palette, page typography, animations or navigation redesign.
- scripts/build.mjs: copies branding and favicon files into dist and generated static pages inherit the metadata.
- scripts/serve.mjs: serves ICO and web manifest with their appropriate media types.
- scripts/build-brand-assets.mjs: original vector artwork and deterministic PNG/ICO exports.

## Validation

Local build succeeded. Seven existing frontend/SEO checks passed. HTTP checks returned 200 and correct media types for all favicon/manifest variants and primary SVG logos. PNG transparency and ICO entries were verified. Running-browser checks covered header/footer, account and owner-access shell, homepage logo link, mobile menu, dark/light switching, and 1280, 820, 390 and 360 pixel viewports. The final 360 pixel logo is 128 × 36 with the menu aligned on the same row and no horizontal overflow. The old logomark element is absent. Screenshots are saved privately under .private/branding/.

No public deployment was performed. Actual installed mobile home-screen/bookmark behavior has not been device-tested. Reviews, inventory, authentication configuration and checkout settings were not changed. Banner and publication approval remain outstanding. The earlier deployment manifest predates this branding build and must be refreshed before release.
