import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";

const MAX_ROWS = 1000;

// Minimal CSV parser — handles quoted fields with embedded commas, CRLF/LF.
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    rows.push(fields);
  }
  return rows;
}

// Returns column indices for year/make/model from a header row, or null if not a header.
function detectHeaders(row) {
  const n = row.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const yi = n.findIndex((h) => h === "year" || h === "yr");
  const mi = n.findIndex((h) => h === "make" || h === "manufacturer");
  const di = n.findIndex((h) => h === "model" || h === "mod");
  if (yi >= 0 && mi >= 0 && di >= 0) return { yi, mi, di };
  return null;
}

export async function POST(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const productId = formData.get("productId");
  const file = formData.get("file");

  if (!productId || !file) {
    return NextResponse.json({ error: "productId and file required" }, { status: 400 });
  }

  // Verify product belongs to this shop
  const product = await prisma.product.findFirst({
    where: { id: productId, shopId: shop.id },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, errors: [] });
  }

  // Detect headers or fall back to positional mapping
  let dataRows = rows;
  let yi, mi, di;

  const headerMap = detectHeaders(rows[0]);
  if (headerMap) {
    dataRows = rows.slice(1);
    ({ yi, mi, di } = headerMap);
  } else {
    // Positional: 3 cols → year, make, model; 4+ cols → sku, year, make, model
    if (rows[0].length >= 4) {
      yi = 1; mi = 2; di = 3;
    } else {
      yi = 0; mi = 1; di = 2;
    }
  }

  if (dataRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_ROWS} row limit (got ${dataRows.length})` },
      { status: 422 },
    );
  }

  const errors = [];
  // Parsed rows: { rowNum, year, make, model }
  const parsed = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = headerMap ? i + 2 : i + 1; // 1-based, account for header
    const row = dataRows[i];
    const yearStr = row[yi] ?? "";
    const make = row[mi] ?? "";
    const model = row[di] ?? "";

    const year = parseInt(yearStr, 10);
    if (!year || isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
      errors.push({ row: rowNum, message: `Invalid year "${yearStr}"` });
      continue;
    }
    if (!make) { errors.push({ row: rowNum, message: "Missing make" }); continue; }
    if (!model) { errors.push({ row: rowNum, message: "Missing model" }); continue; }

    parsed.push({ rowNum, year, make, model });
  }

  // Batch vehicle lookup — one query with OR clauses
  const uniqueCombos = [...new Map(
    parsed.map((r) => [`${r.year}|${r.make.toLowerCase()}|${r.model.toLowerCase()}`, r])
  ).values()];

  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: uniqueCombos.map(({ year, make, model }) => ({
        AND: [
          { year },
          { make: { equals: make, mode: "insensitive" } },
          { model: { equals: model, mode: "insensitive" } },
        ],
      })),
    },
    select: { id: true, year: true, make: true, model: true },
  });

  const vehicleMap = new Map(
    vehicles.map((v) => [
      `${v.year}|${v.make.toLowerCase()}|${v.model.toLowerCase()}`,
      v.id,
    ]),
  );

  const toCreate = [];
  for (const { rowNum, year, make, model } of parsed) {
    const vehicleId = vehicleMap.get(`${year}|${make.toLowerCase()}|${model.toLowerCase()}`);
    if (!vehicleId) {
      errors.push({ row: rowNum, message: `Vehicle not found: ${year} ${make} ${model}` });
    } else {
      toCreate.push({ shopId: shop.id, productId, vehicleId, source: "CSV" });
    }
  }

  // createMany with skipDuplicates handles the @@unique([productId, vehicleId]) constraint
  const { count: imported } = await prisma.fitment.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  const skipped = toCreate.length - imported;

  return NextResponse.json({ imported, skipped, errors });
}
