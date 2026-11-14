# Coastline Device Co.

Electronics storefront built with HTML, CSS, vanilla JavaScript, Supabase PostgreSQL/Auth/Storage, and Supabase Edge Functions.

Store: https://coastline-device.netlify.app/

## Development

```sh
npm ci
npm test
npm run build
npm run dev
```

Copy `.env.example` to `.env.local` and configure the public Supabase settings. Keep service-role, payment, and email credentials only in server-side secrets. Environment files, private exports, dependencies, and built deployment packages are excluded from Git.

## Payment status

- Zelle: manual transfer instructions and reference/screenshot submission; paid status requires admin MFA and actual bank receipt verification.
- PayPal: visible but temporarily unavailable.
- Cards and instalments: not integrated; not offered as working payment methods.
- Shipping: U.S. delivery, free standard or $25 fast delivery.

## Operations

The repository contains migration history, tests and historical implementation notes. Do not run the complete installer against an existing project. Review and apply only necessary incremental migrations.

The hosted database is the source of truth for current product prices, variants and inventory. Private historical catalogue drafts are retained for provenance, not published automatically. See `docs/integration/STOREFRONT-CORRECTIONS-2026-11-14.md` for the last completed deployment checks. Customer email delivery and fresh OAuth callback acceptance have remaining setup/test gates; this README does not certify production readiness.
