import { NextResponse } from "next/server";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";
import { prisma } from "@/lib/db";

export async function GET(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const connection = await prisma.marketplaceConnection.findFirst({
    where: { shopId: shop.id, marketplace: "AMAZON" },
  });

  if (!connection) {
    return NextResponse.json({ status: "NOT_CONNECTED" });
  }

  // Strip sensitive token fields before returning
  const { refreshToken: _r, accessToken: _a, ...safe } = connection;
  return NextResponse.json({
    ...safe,
    status: connection.disconnectedAt ? "DISCONNECTED" : "CONNECTED",
  });
}
