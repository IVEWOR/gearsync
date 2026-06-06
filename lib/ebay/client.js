import { prisma } from "@/lib/db";

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ");

const FIVE_MIN_MS = 5 * 60 * 1000;

function isProd() {
  return process.env.EBAY_ENV === "production";
}

function authBase() {
  return isProd()
    ? "https://auth.ebay.com/oauth2/authorize"
    : "https://auth.sandbox.ebay.com/oauth2/authorize";
}

function tokenEndpoint() {
  return isProd()
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";
}

function apiBase() {
  return isProd() ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
}

function basicAuth() {
  return Buffer.from(
    `${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`,
  ).toString("base64");
}

// Builds the eBay OAuth consent URL. state = shopId (DB UUID) for callback routing.
export function getEbayAuthUrl(shopId) {
  const params = new URLSearchParams({
    client_id: process.env.EBAY_APP_ID,
    redirect_uri: process.env.EBAY_RU_NAME,
    response_type: "code",
    scope: SCOPES,
    state: shopId,
  });
  return `${authBase()}?${params.toString()}`;
}

// POST to eBay token endpoint with an authorization code.
// Returns { accessToken, refreshToken, expiresIn }.
export async function exchangeCodeForTokens(code) {
  const res = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.EBAY_RU_NAME,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay token exchange failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in, // seconds
  };
}

// Fetches the eBay account username for the given access token.
// Used as accountId on first connect.
export async function getEbayAccountId(accessToken) {
  try {
    const res = await fetch(`${apiBase()}/commerce/identity/v1/user/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "unknown";
    const data = await res.json();
    return data.username || data.userId || "unknown";
  } catch {
    return "unknown";
  }
}

// Uses the stored refresh token to get a new access token and persists it.
// Returns the new access token string.
export async function refreshEbayToken(shopId) {
  const connection = await prisma.marketplaceConnection.findFirst({
    where: { shopId, marketplace: "EBAY", disconnectedAt: null },
    select: { id: true, refreshToken: true },
  });
  if (!connection)
    throw new Error(`No active eBay connection for shop ${shopId}`);

  const res = await fetch(tokenEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay token refresh failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.marketplaceConnection.update({
    where: { id: connection.id },
    data: { accessToken: data.access_token, expiresAt },
  });

  return data.access_token;
}

// Returns a fetch wrapper that:
//   - Auto-refreshes the token if within 5 min of expiry
//   - Prepends the eBay API base URL
//   - Adds Authorization + Content-Type headers
// Usage: const client = await ebayClient(shopId)
//        const res = await client.request('/sell/inventory/v1/inventory_item', { method: 'GET' })
export async function ebayClient(shopId) {
  const connection = await prisma.marketplaceConnection.findFirst({
    where: { shopId, marketplace: "EBAY", disconnectedAt: null },
    select: { accessToken: true, expiresAt: true },
  });
  if (!connection)
    throw new Error(`No active eBay connection for shop ${shopId}`);

  let token = connection.accessToken;
  if (connection.expiresAt.getTime() - Date.now() < FIVE_MIN_MS) {
    token = await refreshEbayToken(shopId);
  }

  const base = apiBase();

  return {
    request(path, options = {}) {
      return fetch(`${base}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
    },
  };
}
