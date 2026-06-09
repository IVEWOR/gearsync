import { NextResponse } from "next/server";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";
import { enqueue } from "@/lib/queue";

export async function POST(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { productId } = body;
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  // Verify product belongs to this shop before queuing
  const { prisma } = await import("@/lib/db");
  const product = await prisma.product.findFirst({
    where: { id: productId, shopId: shop.id },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const jobId = await enqueue("ebay_listing_sync", {
    shopId: shop.id,
    productId,
  });

  return NextResponse.json({ jobId });
}
