import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";

async function ownedTemplate(shopId, id) {
  return prisma.fitmentTemplate.findFirst({
    where: { id, shopId },
  });
}

export async function GET(request, { params }) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const { id } = await params;
  const template = await ownedTemplate(shop.id, id);
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Hydrate vehicle data for all stored vehicleIds
  const vehicles = template.vehicleIds.length
    ? await prisma.vehicle.findMany({
        where: { id: { in: template.vehicleIds } },
        select: { id: true, year: true, make: true, model: true },
        orderBy: [{ year: "desc" }, { make: "asc" }, { model: "asc" }],
      })
    : [];

  return NextResponse.json({ ...template, vehicles });
}

export async function PUT(request, { params }) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const { id } = await params;
  const template = await ownedTemplate(shop.id, id);
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.vehicleIds !== undefined) data.vehicleIds = body.vehicleIds.map(Number);

  try {
    const updated = await prisma.fitmentTemplate.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A template with that name already exists" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(request, { params }) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const { id } = await params;
  const template = await ownedTemplate(shop.id, id);
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.fitmentTemplate.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
