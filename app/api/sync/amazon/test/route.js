import { NextResponse } from "next/server";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";
import { prisma } from "@/lib/db";
import { enqueue } from "@/lib/queue/index.js";

export async function POST(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const product = await prisma.product.findFirst({
    where: { shopId: shop.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });

  if (!product) {
    return NextResponse.json({ error: "No products found" }, { status: 404 });
  }

  await enqueue("amazon_sync_product", {
    shopId: shop.id,
    productId: product.id,
    action: "create",
  });

  return NextResponse.json({ queued: true, productTitle: product.title });
}
