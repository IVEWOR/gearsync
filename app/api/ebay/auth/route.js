import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEbayAuthUrl } from "@/lib/ebay/client";

export async function GET(request) {
  const shopId = new URL(request.url).searchParams.get("shopId");
  if (!shopId) {
    return new Response("Missing shopId", { status: 400 });
  }

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true },
  });
  if (!shop) {
    return new Response("Shop not found", { status: 404 });
  }

  return redirect(getEbayAuthUrl(shopId));
}
