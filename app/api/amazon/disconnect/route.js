import { NextResponse } from "next/server";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";
import { prisma } from "@/lib/db";

export async function POST(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  await prisma.marketplaceConnection.updateMany({
    where: { shopId: shop.id, marketplace: "AMAZON" },
    data: {
      disconnectedAt: new Date(),
      accessToken: "",
      refreshToken: "",
    },
  });

  return NextResponse.json({ ok: true });
}
