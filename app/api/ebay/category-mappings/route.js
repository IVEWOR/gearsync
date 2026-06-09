import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";

export async function GET(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const mappings = await prisma.categoryMapping.findMany({
    where: { shopId: shop.id, marketplace: "EBAY" },
    select: {
      id: true,
      shopifyProductType: true,
      externalCategoryId: true,
      externalCategoryName: true,
    },
  });

  return NextResponse.json(mappings);
}

export async function POST(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { shopifyProductType, externalCategoryId, externalCategoryName } = body;
  if (!shopifyProductType || !externalCategoryId || !externalCategoryName) {
    return NextResponse.json(
      { error: "shopifyProductType, externalCategoryId, and externalCategoryName required" },
      { status: 400 },
    );
  }

  const mapping = await prisma.categoryMapping.upsert({
    where: {
      shopId_marketplace_shopifyProductType: {
        shopId: shop.id,
        marketplace: "EBAY",
        shopifyProductType,
      },
    },
    create: {
      shopId: shop.id,
      marketplace: "EBAY",
      shopifyProductType,
      externalCategoryId,
      externalCategoryName,
    },
    update: { externalCategoryId, externalCategoryName },
  });

  return NextResponse.json(mapping, { status: 201 });
}
