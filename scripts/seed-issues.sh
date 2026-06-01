#!/usr/bin/env bash
set -e

REPO="ivewor/gearsync"
PROJECT_NUM=1  # your project number

create() {
  local title="$1"
  local phase="$2"
  local label="$3"
  
  url=$(gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --label "$label" \
    --label "phase:$phase" \
    --body "Part of $phase phase. See TODO.md.")
  
  gh project item-add "$PROJECT_NUM" --owner "@me" --url "$url"
  echo "✓ $title"
}

# Foundation
create "Repo scaffold (Next.js 15 + Tailwind)" "foundation" "chore"
create "Supabase project + Prisma init" "foundation" "chore"
create "pg-boss boot + dummy job" "foundation" "chore"

# Data model
create "Draft schema.prisma" "data-model" "feature"
create "Run initial migration" "data-model" "chore"
create "Supabase RLS policies" "data-model" "feature"

# Shopify
create "Shopify OAuth install flow" "shopify" "feature"
create "Session storage (Prisma adapter)" "shopify" "feature"
create "Webhook receiver + HMAC verify" "shopify" "feature"
create "Polaris shell + App Bridge" "shopify" "feature"
create "Shopify Billing API integration" "shopify" "feature"

# Fitment
create "NHTSA vPIC import script" "fitment" "feature"
create "Vehicle search API endpoint" "fitment" "feature"
create "Product fitment attachment UI" "fitment" "feature"
create "CSV bulk fitment import" "fitment" "feature"
create "Fitment templates" "fitment" "feature"

# eBay
create "eBay OAuth + token refresh" "ebay" "feature"
create "eBay Taxonomy + category mapping" "ebay" "feature"
create "eBay Compatibility API (ePID)" "ebay" "feature"
create "eBay Sell API listing CRUD" "ebay" "feature"
create "eBay order import" "ebay" "feature"

# Amazon
create "SP-API LWA + IAM auth" "amazon" "feature"
create "Catalog API ASIN matching" "amazon" "feature"
create "Listings API + PartFinder" "amazon" "feature"
create "Feeds API bulk upload" "amazon" "feature"
create "Amazon order import" "amazon" "feature"

# Sync
create "Product sync job" "sync" "feature"
create "Inventory sync (real-time)" "sync" "feature"
create "Price sync + markup rules" "sync" "feature"
create "Retry queue with backoff" "sync" "feature"

# Observability
create "Sync history log UI" "observability" "feature"
create "Error dashboard" "observability" "feature"
create "Email alerts" "observability" "feature"

# Onboarding
create "Setup wizard" "onboarding" "feature"
create "Health checks dashboard" "onboarding" "feature"

# Pre-launch
create "GDPR webhooks" "pre-launch" "feature"
create "Privacy policy + ToS" "pre-launch" "chore"
create "App listing copy + screenshots" "pre-launch" "chore"
create "App Store submission" "pre-launch" "chore"

echo "Done."