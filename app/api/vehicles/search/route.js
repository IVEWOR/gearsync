import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim() || null;
  const year = searchParams.get("year");
  const make = searchParams.get("make")?.trim() || null;
  const model = searchParams.get("model")?.trim() || null;
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const where = {};

  if (year) {
    const y = parseInt(year, 10);
    if (!isNaN(y)) where.year = y;
  }

  // Exact filters (from structured selects)
  if (make) where.make = { equals: make, mode: "insensitive" };
  if (model) where.model = { equals: model, mode: "insensitive" };

  // Free-text search across make and model — only when no exact make/model provided
  if (q && !make && !model) {
    where.OR = [
      { make: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
    ];
  } else if (q && make && !model) {
    // make is already filtered; apply q to model
    where.model = { contains: q, mode: "insensitive" };
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    select: { id: true, year: true, make: true, model: true, trim: true, engine: true },
    orderBy: [{ year: "desc" }, { make: "asc" }, { model: "asc" }],
    take: limit,
  });

  return NextResponse.json(vehicles);
}
