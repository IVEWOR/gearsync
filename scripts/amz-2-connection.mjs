import 'dotenv/config'
import { prisma } from './db.mjs'
import { getAccessToken } from '../lib/amazon/auth.js'

const shop = await prisma.shop.findFirst()
if (!shop) { console.log('❌ No shop row — install the app first'); process.exit(1) }
console.log('Shop:', shop.id, shop.domain)

const refreshToken = process.env.AMAZON_TEST_REFRESH_TOKEN
if (!refreshToken) {
  console.log('❌ AMAZON_TEST_REFRESH_TOKEN not in .env')
  console.log('   Get it from: Amazon Developer Console → your app → Authorize tab → Generate refresh token')
  process.exit(1)
}

console.log('Fetching access token from LWA...')
let accessToken
try {
  accessToken = await getAccessToken(refreshToken)
  console.log('✅ Access token OK:', accessToken.substring(0, 30) + '...')
} catch (e) {
  console.error('❌ LWA token exchange failed:', e.response?.data || e.message)
  process.exit(1)
}

const conn = await prisma.marketplaceConnection.upsert({
  where: { shopId_marketplace: { shopId: shop.id, marketplace: 'AMAZON' } },
  create: {
    shopId:         shop.id,
    marketplace:    'AMAZON',
    environment:    process.env.AMAZON_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX',
    accountId:      'PENDING',
    accessToken,
    refreshToken,
    expiresAt:      new Date(Date.now() + 3500 * 1000),
    disconnectedAt: null,
    metadata:       { sellerId: 'PENDING', marketplaceId: 'ATVPDKIKX0DER' }
  },
  update: {
    accessToken,
    refreshToken,
    expiresAt:      new Date(Date.now() + 3500 * 1000),
    disconnectedAt: null,
  }
})
console.log('✅ Connection row upserted:', conn.id)
console.log('   accountId:', conn.accountId, '| disconnectedAt:', conn.disconnectedAt ?? 'null (connected)')

await prisma.$disconnect()
