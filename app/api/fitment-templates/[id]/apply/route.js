import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";

export async function POST(request, { params }) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const { id } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { productId } = body;
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  const [template, product] = await Promise.all([
    prisma.fitmentTemplate.findFirst({ where: { id, shopId: shop.id } }),
    prisma.product.findFirst({ where: { id: productId, shopId: shop.id }, select: { id: true } }),
  ]);

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (template.vehicleIds.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0 });
  }

  const { count: imported } = await prisma.fitment.createMany({
    data: template.vehicleIds.map((vehicleId) => ({
      shopId: shop.id,
      productId,
      vehicleId,
      source: "TEMPLATE",
    })),
    skipDuplicates: true,
  });

  const skipped = template.vehicleIds.length - imported;
  return NextResponse.json({ imported, skipped });
}
