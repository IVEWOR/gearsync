import { LWA_TOKEN_URL, getSandboxOAuthUrl } from "./constants.js";

// Per-process cache: refreshToken → { accessToken, expiresAt }
const tokenCache = new Map();

export async function getAccessToken(refreshToken) {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.AMAZON_SP_CLIENT_ID,
      client_secret: process.env.AMAZON_SP_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Amazon LWA token refresh failed ${res.status}: ${body}`);
  }

  const data = await res.json();
  tokenCache.set(refreshToken, {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  });

  return data.access_token;
}

export async function exchangeAuthCode(code, redirectUri) {
  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.AMAZON_SP_CLIENT_ID,
      client_secret: process.env.AMAZON_SP_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Amazon LWA code exchange failed ${res.status}: ${body}`);
  }

  return res.json();
}

export function buildOAuthUrl(state) {
  const params = new URLSearchParams({
    application_id: process.env.AMAZON_SP_CLIENT_ID,
    state,
    version: "beta",
  });
  return `${getSandboxOAuthUrl()}?${params.toString()}`;
}
