import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";

export async function GET(request) {
  const { error } = await getAuthenticatedShop(request);
  if (error) return error;

  const sp = new URL(request.url).searchParams;
  const year = parseInt(sp.get("year") || "", 10);
  const make = sp.get("make")?.trim();

  if (!year || isNaN(year) || !make) {
    return NextResponse.json({ error: "year and make required" }, { status: 400 });
  }

  const rows = await prisma.vehicle.findMany({
    where: { year, make: { equals: make, mode: "insensitive" } },
    select: { id: true, model: true },
    distinct: ["model"],
    orderBy: { model: "asc" },
  });

  // Return id so the client can send vehicleId directly to POST /api/fitments
  return NextResponse.json(rows.map((r) => ({ id: r.id, model: r.model })));
}
