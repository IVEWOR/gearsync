import { NextResponse } from "next/server";
import { shopify } from "@/lib/shopify/client";
import { prisma } from "@/lib/db";
import { createRecurringCharge, PLANS } from "@/lib/shopify/billing";

export async function POST(request) {
  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.replace("Bearer ", "");
  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let shopDomain;
  try {
    const payload = await shopify.session.decodeSessionToken(idToken);
    shopDomain = new URL(payload.dest).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
  }

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { id: true },
  });
  if (!shop) {
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { plan } = body;
  if (!PLANS[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  if (plan === "FREE") {
    return NextResponse.json({ confirmationUrl: null });
  }

  let charge;
  try {
    charge = await createRecurringCharge(shopDomain, plan);
  } catch (err) {
    console.error("[billing/subscribe] createRecurringCharge failed:", err.message);
    return NextResponse.json({ error: "Failed to create charge" }, { status: 502 });
  }

  await prisma.subscription.create({
    data: {
      shopId: shop.id,
      planName: plan,
      shopifyChargeId: charge.chargeId,
      status: "PENDING",
      price: PLANS[plan].price,
      currency: "USD",
    },
  });

  return NextResponse.json({ confirmationUrl: charge.confirmationUrl });
}
