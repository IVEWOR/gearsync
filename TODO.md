# GearSync — Build Tracker

Legend:
[ ] not started
[~] in progress
[x] done
[!] blocked

## 0. External approvals (start day 1, run in background)

- [~] Amazon SP-API developer registration
  - [x] Submit app application
  - [ ] IAM role + LWA credentials received
- [~] eBay Developer account
  - [x] Sandbox keyset
  - [~] Production keyset approved
- [x] Shopify Partner account
  - [x] Development store created
  - [x] App created in Partner dashboard
  - [x] API credentials saved

## 1. Foundation

- [x] Repo scaffold (Next.js 15 App Router, JS, Tailwind)
- [x] Dependencies installed
- [ ] Folder structure committed
- [x] Supabase project created
- [x] Prisma initialized + connected
- [ ] `.env` template committed (`.env.example`)
- [ ] pg-boss boot + dummy job cycling

## 2. Data model

- [x] `schema.prisma` drafted
  - [x] Shop
  - [x] Subscription
  - [x] Product
  - [x] Vehicle
  - [x] Fitment
  - [x] FitmentTemplate
  - [x] MarketplaceConnection
  - [x] MarketplaceListing
  - [x] SyncJob
  - [x] SyncLog
  - [x] WebhookEvent
- [x] Migrations run
- [ ] Row-level security policies (Supabase)
- [x] Prisma client singleton (`lib/db.js`)

## 3. Shopify integration

- [ ] OAuth install flow
- [ ] Session storage (Prisma adapter)
- [ ] Embedded app loads via App Bridge
- [ ] Polaris shell + sidebar nav
- [ ] Webhook receiver + HMAC verify
  - [ ] `app/uninstalled`
  - [ ] `products/create`
  - [ ] `products/update`
  - [ ] `products/delete`
  - [ ] `inventory_levels/update`
  - [ ] `orders/create`
- [ ] Shopify Admin GraphQL client wrapper
- [ ] Shopify Billing API
  - [ ] Recurring charge create
  - [ ] Tier enforcement middleware
  - [ ] Upgrade/downgrade flow

## 4. Fitment layer

- [ ] NHTSA vPIC import script
- [ ] Vehicle table populated
- [ ] Vehicle search API endpoint
- [ ] Product → Fitment attachment UI
- [ ] Fitment list save/edit/delete
- [ ] CSV bulk import
- [ ] Fitment templates (create/apply)
- [ ] Fitment validation rules

## 5. eBay Motors integration

- [ ] eBay OAuth flow
- [ ] Token refresh handler
- [ ] Taxonomy API — category mapping
- [ ] Category mapping UI
- [ ] Compatibility API — ePID lookup
- [ ] Sell API — create listing
- [ ] Sell API — update listing
- [ ] Sell API — end listing
- [ ] Listing template builder UI
- [ ] eBay order import

## 6. Amazon integration

- [ ] SP-API auth (LWA + IAM)
- [ ] Catalog API — ASIN search
- [ ] Listings API — create
- [ ] Listings API — update
- [ ] PartFinder fitment submission
- [ ] Feeds API — bulk upload
- [ ] Amazon order import

## 7. Sync engine

- [ ] Product sync job (Shopify → marketplaces)
- [ ] Debounce logic for rapid updates
- [ ] Inventory sync (real-time)
- [ ] Order import job
- [ ] Price sync + markup rules
- [ ] Conflict resolution rules
- [ ] Retry queue with exponential backoff

## 8. Observability

- [ ] Sync history log UI
- [ ] Error dashboard (grouped by type)
- [ ] Error translation map (cryptic → plain English)
- [ ] Email alerts
  - [ ] Sync failures
  - [ ] OAuth expirations
  - [ ] Listing suppressions

## 9. Onboarding

- [ ] Setup wizard
  - [ ] Connect Shopify (auto)
  - [ ] Connect eBay
  - [ ] Connect Amazon (optional)
  - [ ] Test sync one product
- [ ] Health checks dashboard
- [ ] In-app help / docs links

## 10. Pre-launch

- [ ] App listing copy (App Store)
- [ ] Screenshots
- [ ] Demo video
- [ ] Privacy policy
- [ ] Terms of service
- [ ] GDPR webhooks (customers/data_request, customers/redact, shop/redact)
- [ ] App Store submission
- [ ] Beta merchant outreach (Marketplace Connect 1-star reviewers)

## 11. Post-launch (v1.1+)

- [ ] AI-assisted fitment extraction
- [ ] Walmart marketplace
- [ ] UK eBay Motors
- [ ] Multi-currency
