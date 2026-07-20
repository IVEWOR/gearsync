import { NextResponse } from "next/server";
import { getAuthenticatedShop } from "@/lib/shopify/sessionAuth";
import { buildOAuthUrl } from "@/lib/amazon/auth.js";
import crypto from "crypto";

export async function GET(request) {
  const { shop, error } = await getAuthenticatedShop(request);
  if (error) return error;

  const state = Buffer.from(
    JSON.stringify({ shopId: shop.id, nonce: crypto.randomUUID() }),
  ).toString("base64");

  return NextResponse.json({ oauthUrl: buildOAuthUrl(state) });
}
