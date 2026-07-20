import 'dotenv/config'
import { getAccessToken, buildOAuthUrl } from '../lib/amazon/auth.js'

console.log('--- OAuth URL ---')
const url = buildOAuthUrl('test-state-123')
console.log(url)
console.log('Contains client ID:', url.includes(process.env.AMAZON_SP_CLIENT_ID))
console.log('Sandbox URL:', url.includes('sandbox'))

console.log('\n--- Access Token ---')
const refreshToken = process.env.AMAZON_TEST_REFRESH_TOKEN
if (!refreshToken) {
  console.log('⚠️  AMAZON_TEST_REFRESH_TOKEN not set — skipping token test')
  console.log('   Get it from: Amazon Developer Console → your app → Authorize tab → Generate refresh token')
  process.exit(0)
}

try {
  const token = await getAccessToken(refreshToken)
  console.log('✅ Token received:', token.substring(0, 40) + '...')
} catch (e) {
  console.error('❌ Auth failed:', e.response?.data || e.message)
}
