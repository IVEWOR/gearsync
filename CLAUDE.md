# GearSync — Claude Code Context

## What is this

Shopify app for auto parts merchants to sync products to eBay Motors and Amazon with vehicle fitment data (Year/Make/Model/Engine/Trim). Shopify is source of truth; marketplaces are downstream sinks.

Dev store: gearsync-vhmul6hk.myshopify.com

## Stack (locked — do not change)

- **Framework:** Next.js 15 App Router, JavaScript (not TypeScript)
- **DB:** Supabase Postgres + Prisma 7 + `@prisma/adapter-pg`
- **Queue:** pg-boss v10 (on same Postgres, no Redis)
- **Shopify:** `@shopify/shopify-api` v12+ with web-api adapter
- **UI:** Shopify Polaris + Tailwind CSS
- **Hosting:** Render

## Critical gotchas

### Prisma 7

- Config goes in `prisma.config.ts`, NOT `schema.prisma`
- Requires `@prisma/adapter-pg` driver adapter
- `datasource db` block in schema intentionally omits `url` field
- Always use direct Supabase connection (port 5432), never pooler (port 6543)
- Pooler URL causes tenant-not-found errors and breaks pg-boss polling

### Shopify API v12+

- Use `client.request()` — `client.query()` is deprecated and removed
- Hardcode API version as `"2026-04"` — `LATEST_API_VERSION` export was removed
- Install button in dev dashboard bypasses OAuth — use `/api/auth?shop=` URL directly
- All secrets in `.env` (not `.env.local`) — `dotenv/config` only loads `.env`

### pg-boss v10

- Call `createQueue()` explicitly before `send()`
- Handlers receive job **arrays**, not single jobs — always loop `for (const job of jobs)`
- Register all workers in `instrumentation.js`

### eBay API (sandbox)

- **Token type:** Must use User OAuth token (not Application token) for all Inventory + Account API calls. Application tokens return 403.
- **Token storage:** Stored in `MarketplaceConnection` table (`accessToken`, `refreshToken`, `accessTokenExpiry`). Refresh token lasts 18 months.
- **Refresh flow:** `POST https://api.sandbox.ebay.com/identity/v1/oauth2/token` with `grant_type=refresh_token`
- **Required scopes:** `sell.inventory sell.account sell.fulfillment`
- **Content-Language:** Add `'Content-Language': 'en-US'` to ALL Inventory API requests
- **Content-Length:** `POST /offer/{offerId}/publish` has no body — must send `Content-Length: 0` or eBay returns HTTP 411
- **Business policies:** Seller must be opted into `SELLING_POLICY_MANAGEMENT` via `POST /sell/account/v1/program/opt_in`
- **Offer policies:** All three required — `fulfillmentPolicyId`, `paymentPolicyId`, `returnPolicyId`
- **Sandbox policy IDs:** fulfillment `6230659000`, payment `6230660000`, return `6230661000` (in `.env`)
- **merchantLocationKey:** Required on offer — use `"DEFAULT"`. Location must have full address.
- **Leaf categories:** eBay only accepts leaf (not parent) category IDs. Sandbox categories differ from production — use Taxonomy API `get_category_suggestions` to find valid leaves.
- **Item specifics:** Auto parts categories require `Part Type` in `product.aspects`. Format: `{ "Part Type": ["Brake Pads"] }`
- **Duplicate offer (25002):** If offer exists for SKU, error returns existing `offerId` in `parameters[0].value` — catch and PUT update instead
- **Opt-in check:** `GET /sell/account/v1/program` to check enrolled programs before calling opt_in
- **Omit headers:** Do NOT send `Accept-Language` or `Content-Language` on account/taxonomy endpoints — only Inventory API

### Environment variables

```
DATABASE_URL=          # direct Supabase (port 5432) — for Prisma
DIRECT_URL=            # same as DATABASE_URL
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
EBAY_APP_ID=           # Client ID
EBAY_CERT_ID=          # Client Secret
EBAY_DEV_ID=
EBAY_RU_NAME=
EBAY_ENV=sandbox
EBAY_MERCHANT_LOCATION_KEY=DEFAULT
EBAY_FULFILLMENT_POLICY_ID=6230659000
EBAY_PAYMENT_POLICY_ID=6230660000
EBAY_RETURN_POLICY_ID=6230661000
```

## What's built and working

- [x] Prisma schema (12 models), migrated to Supabase
- [x] Shopify OAuth end-to-end
- [x] Webhook receiver with HMAC (APP*UNINSTALLED, PRODUCTS*\*, INVENTORY_LEVELS_UPDATE)
- [x] pg-boss queue + product/inventory sync workers
- [x] Polaris embedded app shell
- [x] Shopify Billing API (createRecurringCharge, subscribe/callback, tier enforcement)
- [x] NHTSA vPIC vehicle data import (34,836 vehicles)
- [x] Vehicle search API + Fitment UI
- [x] CSV bulk fitment import
- [x] FitmentTemplate UI
- [x] eBay OAuth + token storage in MarketplaceConnection
- [x] eBay Taxonomy API + CategoryMapping UI
- [x] **eBay listing sync — full end-to-end working in sandbox**
  - inventory item PUT, offer create/update, publish
  - First live sandbox listing: `110589620267`
- [x] eBay token auto-refresh (accessToken expires in 2h — needs refresh logic in `ebayClient`)

## In progress

- [ ] Amazon SP-API integration (identity verification in progress)

## Deferred

- Billing API public distribution (app locked to Custom — requires App Store submission)
- Fuzzy vehicle matching (v1.1)
- eBay CategoryMapping UI in dev (cross-origin iframe issue — works in production)

## Key files

- `lib/ebay/listings.js` — createOrUpdateListing, endListing
- `lib/ebay/client.js` — ebayClient(shopId), token management
- `jobs/ebay-sync.js` — pg-boss worker for ebay_listing_sync queue
- `app/api/ebay/sync/route.js` — manual sync trigger (POST { productId })
- `instrumentation.js` — worker registration on startup
- `prisma/schema.prisma` — data model
- `prisma.config.ts` — Prisma 7 datasource config

## Next priorities

1. eBay token auto-refresh in `ebayClient`
2. Amazon SP-API listing sync
3. Billing subscription flow (confirmationUrl fix)
4. App Store submission prep
