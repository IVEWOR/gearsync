import { NextResponse } from "next/server";
import { shopify } from "@/lib/shopify/client";
import { prisma } from "@/lib/db";

// Returns { shop: { id, domain } } on success, or { error: NextResponse } on failure.
export async function getAuthenticatedShop(request) {
  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.replace("Bearer ", "");
  if (!idToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let shopDomain;
  try {
    const payload = await shopify.session.decodeSessionToken(idToken);
    shopDomain = new URL(payload.dest).hostname;
  } catch {
    return { error: NextResponse.json({ error: "Invalid session token" }, { status: 401 }) };
  }

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { id: true, domain: true },
  });
  if (!shop) {
    return { error: NextResponse.json({ error: "Shop not found" }, { status: 404 }) };
  }

  return { shop };
}
