import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeAuthCode } from "@/lib/amazon/auth.js";
import { US_MARKETPLACE_ID } from "@/lib/amazon/constants.js";
import axios from "axios";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const spapi_oauth_code = searchParams.get("spapi_oauth_code");
  const state = searchParams.get("state");
  const selling_partner_id = searchParams.get("selling_partner_id");

  if (!spapi_oauth_code || !state) {
    return NextResponse.json(
      { error: "Missing spapi_oauth_code or state" },
      { status: 400 },
    );
  }

  let shopId;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    shopId = decoded.shopId;
  } catch {
    return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
  }

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  let tokens;
  try {
    const redirectUri = `${process.env.NEXTAUTH_URL ?? process.env.SHOPIFY_APP_URL}/api/amazon/callback`;
    tokens = await exchangeAuthCode(spapi_oauth_code, redirectUri);
  } catch (err) {
    console.error("[amazon-callback] token exchange failed:", err.message);
    return NextResponse.json(
      { error: "Token exchange failed", detail: err.message },
      { status: 502 },
    );
  }

  // Use the fresh access token to verify seller identity
  let sellerId = selling_partner_id;
  if (!sellerId) {
    try {
      const baseUrl =
        process.env.AMAZON_ENV === "sandbox"
          ? "https://sandbox.sellingpartnerapi-na.amazon.com"
          : "https://sellingpartnerapi-na.amazon.com";
      const res = await axios.get(
        `${baseUrl}/sellers/v1/marketplaceParticipations`,
        { headers: { "x-amz-access-token": tokens.access_token } },
      );
      sellerId =
        res.data?.payload?.participations?.[0]?.seller?.sellerId ?? "unknown";
    } catch {
      sellerId = "unknown";
    }
  }

  await prisma.marketplaceConnection.upsert({
    where: { shopId_marketplace: { shopId, marketplace: "AMAZON" } },
    create: {
      shopId,
      marketplace: "AMAZON",
      accountId: sellerId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      disconnectedAt: null,
      metadata: { sellerId, marketplaceId: US_MARKETPLACE_ID },
    },
    update: {
      accountId: sellerId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      disconnectedAt: null,
      metadata: { sellerId, marketplaceId: US_MARKETPLACE_ID },
    },
  });

  const appUrl = process.env.NEXTAUTH_URL ?? process.env.SHOPIFY_APP_URL ?? "";
  return NextResponse.redirect(`${appUrl}/amazon?connected=true`);
}
