import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";

export async function GET(request) {
  const { error } = await getAuthenticatedShop(request);
  if (error) return error;

  const year = parseInt(new URL(request.url).searchParams.get("year") || "", 10);
  if (!year || isNaN(year)) {
    return NextResponse.json({ error: "year required" }, { status: 400 });
  }

  const rows = await prisma.vehicle.findMany({
    where: { year },
    select: { make: true },
    distinct: ["make"],
    orderBy: { make: "asc" },
  });

  return NextResponse.json(rows.map((r) => r.make));
}
