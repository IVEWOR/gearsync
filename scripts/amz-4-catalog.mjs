import 'dotenv/config'
import { prisma } from './db.mjs'
import { createAmazonClient } from '../lib/amazon/client.js'

const conn = await prisma.marketplaceConnection.findFirst({
  where: { marketplace: 'AMAZON' }
})
const client = createAmazonClient(conn.refreshToken)
const MARKETPLACE = 'ATVPDKIKX0DER'

// ── Test 1: keyword search ──────────────────────────────────────────────────
// marketplaceIds must be a plain comma-string, NOT an array
// (axios serialises arrays as marketplaceIds[0]=... which Amazon rejects)
console.log('── Test 1: keyword search ──')
try {
  const res = await client.get('/catalog/2022-04-01/items', {
    params: {
      keywords:       'brake pads',
      marketplaceIds: MARKETPLACE,          // string, not array
      includedData:   'summaries',
      pageSize:       5,
    }
  })
  const items = res.data?.items ?? []
  console.log('✅ Items:', items.length)
  if (items[0]) console.log('First ASIN:', items[0].asin, items[0].summaries?.[0]?.itemName ?? '')
} catch (e) {
  console.log('❌', e.response?.status, JSON.stringify(e.response?.data))
}

// ── Test 2: fetch a known sandbox ASIN directly ────────────────────────────
// Amazon sandbox has static mock data for specific ASINs
console.log('\n── Test 2: fetch ASIN B00V5DG6IQ ──')
try {
  const res = await client.get('/catalog/2022-04-01/items/B00V5DG6IQ', {
    params: {
      marketplaceIds: MARKETPLACE,
      includedData:   'summaries,attributes',
    }
  })
  console.log('✅ ASIN data:')
  console.log(JSON.stringify(res.data?.summaries?.[0] ?? res.data, null, 2).substring(0, 400))
} catch (e) {
  console.log('❌', e.response?.status, JSON.stringify(e.response?.data))
}

// ── Test 3: search by identifiers (UPC) ───────────────────────────────────
console.log('\n── Test 3: identifier search (UPC) ──')
try {
  const res = await client.get('/catalog/2022-04-01/items', {
    params: {
      identifiers:       '012345678905',
      identifiersType:   'UPC',
      marketplaceIds:    MARKETPLACE,
      includedData:      'summaries',
    }
  })
  const items = res.data?.items ?? []
  console.log('✅ Items:', items.length)
} catch (e) {
  console.log('❌', e.response?.status, JSON.stringify(e.response?.data))
}

console.log('\nNote: catalog search is optional for the listing flow.')
console.log('If all 3 tests fail, skip to amz-5 — putListing does not need catalog search.')

await prisma.$disconnect()
