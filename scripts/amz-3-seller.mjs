import 'dotenv/config'
import { prisma } from './db.mjs'          // scripts helper — no @/ alias
import { createAmazonClient } from '../lib/amazon/client.js'

const conn = await prisma.marketplaceConnection.findFirst({
  where: { marketplace: 'AMAZON' }
})
if (!conn) { console.log('❌ No AMAZON connection — run amz-2 first'); process.exit(1) }
console.log('Connection found:', conn.id)

// In sandbox, Amazon returns mock/empty data and doesn't validate seller IDs.
// Use env var if set, otherwise fall back to a sandbox placeholder.
const sellerId = process.env.AMAZON_TEST_SELLER_ID ?? 'SANDBOX_SELLER'

console.log('Using sellerId:', sellerId)
console.log('(Set AMAZON_TEST_SELLER_ID in .env to use a real seller ID when you go to production)\n')

// Still call the endpoint to verify auth + connectivity work
const client = createAmazonClient(conn.refreshToken)
try {
  const res = await client.get('/sellers/v1/marketplaceParticipations')
  console.log('✅ API reachable — raw response:')
  console.log(JSON.stringify(res.data, null, 2))
} catch (e) {
  const status = e.response?.status
  const data   = e.response?.data
  if (status === 403 || status === 401) {
    console.log('❌ Auth error — check tokens:', status, data)
    process.exit(1)
  }
  // 400/404 in sandbox is fine — endpoint may not be mocked
  console.log(`⚠️  API returned ${status} (normal in sandbox for this endpoint) — continuing`)
}

// Write sellerId to DB
await prisma.marketplaceConnection.update({
  where: { id: conn.id },
  data: {
    accountId: sellerId,
    metadata:  { ...(conn.metadata ?? {}), sellerId, marketplaceId: 'ATVPDKIKX0DER' }
  }
})
console.log('\n✅ DB updated — accountId:', sellerId)
console.log('Ready for amz-4 (catalog) and amz-5 (listing)')

await prisma.$disconnect()
