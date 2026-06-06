import { shopify } from "@/lib/shopify/client";
import { prisma } from "@/lib/db";
import { enqueue } from "@/lib/queue";
import { STATUS_MAP } from "@/lib/shopify/billing";

export async function POST(request) {
  const rawBody = await request.text();

  const validation = await shopify.webhooks.validate({
    rawBody,
    rawRequest: request,
  });

  if (!validation.valid) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { topic, domain } = validation;

  const shop = await prisma.shop.findUnique({
    where: { domain },
    select: { id: true },
  });

  // Store raw event before routing — best-effort (don't let this block 200)
  if (shop) {
    prisma.webhookEvent
      .create({
        data: {
          shopId: shop.id,
          source: "shopify",
          topic,
          payload: JSON.parse(rawBody),
        },
      })
      .catch((err) => console.error("[webhook] event store failed:", err.message));
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      await handleAppUninstalled(domain);
      break;

    case "APP_SUBSCRIPTIONS_UPDATE":
      await handleSubscriptionUpdate(JSON.parse(rawBody));
      break;

    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE":
    case "PRODUCTS_DELETE":
    case "INVENTORY_LEVELS_UPDATE":
    case "ORDERS_CREATE":
      if (shop) {
        await enqueue(topic.toLowerCase(), {
          shopId: shop.id,
          payload: JSON.parse(rawBody),
        });
      }
      break;
  }

  return new Response(null, { status: 200 });
}

async function handleSubscriptionUpdate(body) {
  const sub = body.app_subscription;
  const chargeId = BigInt(sub.admin_graphql_api_id.split("/").pop());
  const status = STATUS_MAP[sub.status] ?? "CANCELLED";

  await prisma.subscription.updateMany({
    where: { shopifyChargeId: chargeId },
    data: {
      status,
      activatedAt: status === "ACTIVE" ? new Date() : undefined,
      cancelledAt: status === "CANCELLED" || status === "DECLINED" ? new Date() : undefined,
    },
  });
}

async function handleAppUninstalled(domain) {
  // updateMany does not throw when 0 rows match
  await prisma.shop.updateMany({
    where: { domain },
    data: {
      uninstalledAt: new Date(),
      accessToken: "",
    },
  });
}
