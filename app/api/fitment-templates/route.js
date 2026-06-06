import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";

export async function GET(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const templates = await prisma.fitmentTemplate.findMany({
    where: { shopId: shop.id },
    select: {
      id: true,
      name: true,
      description: true,
      vehicleIds: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    templates.map((t) => ({ ...t, vehicleCount: t.vehicleIds.length })),
  );
}

export async function POST(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, description, vehicleIds = [] } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  try {
    const template = await prisma.fitmentTemplate.create({
      data: {
        shopId: shop.id,
        name: name.trim(),
        description: description?.trim() || null,
        vehicleIds: vehicleIds.map(Number),
      },
    });
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A template with that name already exists" }, { status: 409 });
    }
    throw err;
  }
}
