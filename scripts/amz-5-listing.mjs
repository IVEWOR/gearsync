import 'dotenv/config'
import { prisma } from './db.mjs'
import { createAmazonClient } from '../lib/amazon/client.js'
import { putListing } from '../lib/amazon/listings.js'
import { buildListingAttributes, buildSku } from '../lib/amazon/fitment.js'

const conn = await prisma.marketplaceConnection.findFirst({
  where: { marketplace: 'AMAZON' }
})
if (!conn) { console.log('❌ No AMAZON connection — run amz-2 first'); process.exit(1) }

const sellerId = conn.metadata?.sellerId ?? conn.accountId
if (!sellerId || sellerId === 'PENDING') {
  console.log('❌ sellerId not set — run amz-3 first')
  process.exit(1)
}
console.log('sellerId:', sellerId)

// Find a product that belongs to this shop
const product = await prisma.product.findFirst({
  where:   { shopId: conn.shopId },
  include: { variants: true, fitments: true }
})
if (!product) {
  console.log('❌ No products in DB for this shop')
  console.log('   Create a product in your Shopify dev store and let the webhook sync it, or check Product table directly')
  process.exit(1)
}
console.log('Product:', product.title, '| variants:', product.variants.length, '| fitments:', product.fitments.length)

const client  = createAmazonClient(conn.refreshToken)
const sku        = buildSku(product)
const attributes = buildListingAttributes(product, product.variants, product.fitments)

console.log('\nSKU:', sku)
console.log('Attributes (truncated):')
console.log(JSON.stringify(attributes, null, 2).substring(0, 600))

console.log('\nCalling putListing...')
try {
  const result = await putListing(client, sellerId, sku, 'AUTO_PARTS', attributes)
  console.log('\n✅ putListing response:')
  console.log(JSON.stringify(result, null, 2))

  const issues = result?.issues ?? []
  const errors  = issues.filter(i => i.severity === 'ERROR')
  const warnings = issues.filter(i => i.severity === 'WARNING')
  console.log(`\nIssues: ${errors.length} errors, ${warnings.length} warnings`)
  if (errors.length) {
    console.log('❌ Errors:')
    errors.forEach(e => console.log(' -', e.code, e.message))
  } else {
    console.log('✅ No blocking errors — listing accepted by sandbox')
  }
} catch (e) {
  console.error('❌', e.response?.status, JSON.stringify(e.response?.data, null, 2) || e.message)
}

await prisma.$disconnect()
