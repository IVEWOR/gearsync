import { NextResponse } from "next/server";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";
import { prisma } from "@/lib/db";
import { createAmazonClient } from "@/lib/amazon/client.js";
import { searchCatalog } from "@/lib/amazon/catalog.js";

export async function GET(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const q = new URL(request.url).searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ error: "q parameter required" }, { status: 400 });
  }

  const connection = await prisma.marketplaceConnection.findFirst({
    where: { shopId: shop.id, marketplace: "AMAZON", disconnectedAt: null },
  });
  if (!connection) {
    return NextResponse.json(
      { error: "Amazon not connected" },
      { status: 403 },
    );
  }

  const client = createAmazonClient(connection.refreshToken);
  const items = await searchCatalog(client, q);
  return NextResponse.json({ items });
}
