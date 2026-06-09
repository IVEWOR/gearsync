import { NextResponse } from "next/server";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";
import { getEbayCategories } from "@/lib/ebay/taxonomy";

export async function GET(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  try {
    const categories = await getEbayCategories(shop.id);
    return NextResponse.json(categories);
  } catch (err) {
    console.error("[ebay/categories] fetch failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
