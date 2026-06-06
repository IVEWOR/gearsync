import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";

export async function POST(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { productId, vehicleId, notes } = body;
  if (!productId || !vehicleId) {
    return NextResponse.json({ error: "productId and vehicleId required" }, { status: 400 });
  }

  // Ensure the product belongs to this shop
  const product = await prisma.product.findFirst({
    where: { id: productId, shopId: shop.id },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  try {
    const fitment = await prisma.fitment.create({
      data: {
        shopId: shop.id,
        productId,
        vehicleId: Number(vehicleId),
        notes: notes || null,
        source: "MANUAL",
      },
      include: {
        vehicle: { select: { id: true, year: true, make: true, model: true } },
      },
    });
    return NextResponse.json(fitment, { status: 201 });
  } catch (err) {
    // P2002 = unique constraint violation (duplicate fitment)
    if (err.code === "P2002") {
      return NextResponse.json({ error: "Fitment already exists" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { fitmentId } = body;
  if (!fitmentId) {
    return NextResponse.json({ error: "fitmentId required" }, { status: 400 });
  }

  // Ensure fitment belongs to this shop before deleting
  const fitment = await prisma.fitment.findFirst({
    where: { id: fitmentId, shopId: shop.id },
    select: { id: true },
  });
  if (!fitment) {
    return NextResponse.json({ error: "Fitment not found" }, { status: 404 });
  }

  await prisma.fitment.delete({ where: { id: fitmentId } });
  return new Response(null, { status: 204 });
}
