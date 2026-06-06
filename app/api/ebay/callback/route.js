import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForTokens,
  getEbayAccountId,
} from "@/lib/ebay/client";

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const code  = sp.get("code");
  const shopId = sp.get("state"); // state encodes our DB shop UUID
  const error = sp.get("error");

  if (error) {
    console.error("[ebay/callback] eBay returned error:", error, sp.get("error_description"));
    return new Response(`eBay authorization denied: ${error}`, { status: 400 });
  }

  if (!code || !shopId) {
    return new Response("Missing code or state", { status: 400 });
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, domain: true },
  });
  if (!shop) {
    return new Response("Shop not found", { status: 404 });
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    console.error("[ebay/callback] token exchange failed:", err.message);
    return new Response("Token exchange failed", { status: 502 });
  }

  const { accessToken, refreshToken, expiresIn } = tokens;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Best-effort: get eBay username as the accountId
  const accountId = await getEbayAccountId(accessToken);

  const environment = process.env.EBAY_ENV === "production" ? "PRODUCTION" : "SANDBOX";

  await prisma.marketplaceConnection.upsert({
    where: { shopId_marketplace: { shopId: shop.id, marketplace: "EBAY" } },
    create: {
      shopId: shop.id,
      marketplace: "EBAY",
      environment,
      accountId,
      accessToken,
      refreshToken,
      expiresAt,
      disconnectedAt: null,
    },
    update: {
      environment,
      accountId,
      accessToken,
      refreshToken,
      expiresAt,
      disconnectedAt: null,
    },
  });

  return redirect(
    `https://${shop.domain}/admin/apps/${process.env.SHOPIFY_API_KEY}`,
  );
}
