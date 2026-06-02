import { shopify } from "@/lib/shopify/client";

export async function GET(request) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  return shopify.auth.begin({
    shop: shopify.utils.sanitizeShop(shop, true),
    callbackPath: "/api/auth/callback",
    isOnline: false,
    rawRequest: request,
  });
}
