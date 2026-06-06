import { redirect } from "next/navigation";
import { adminClient } from "@/lib/shopify/admin";
import { prisma } from "@/lib/db";
import { STATUS_MAP } from "@/lib/shopify/billing";

const CHARGE_QUERY = `
  query getAppSubscription($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        status
      }
    }
  }
`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chargeId = searchParams.get("charge_id");
  const shop = searchParams.get("shop");

  if (!chargeId || !shop) {
    return new Response("Missing charge_id or shop", { status: 400 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { shopifyChargeId: BigInt(chargeId) },
    select: { id: true },
  });
  if (!sub) {
    return new Response("Subscription not found", { status: 404 });
  }

  let shopifyStatus;
  try {
    const client = await adminClient(shop);
    const res = await client.request(CHARGE_QUERY, {
      variables: { id: `gid://shopify/AppSubscription/${chargeId}` },
    });
    shopifyStatus = res.data?.node?.status;
  } catch (err) {
    console.error("[billing/callback] GraphQL error:", err.message);
    return new Response("Failed to verify charge", { status: 502 });
  }

  const status = STATUS_MAP[shopifyStatus] ?? "CANCELLED";

  await prisma.subscription.update({
    where: { shopifyChargeId: BigInt(chargeId) },
    data: {
      status,
      activatedAt: status === "ACTIVE" ? new Date() : undefined,
      cancelledAt: status === "CANCELLED" || status === "DECLINED" ? new Date() : undefined,
    },
  });

  return redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`);
}
