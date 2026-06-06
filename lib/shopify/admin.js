import { Session } from "@shopify/shopify-api";
import { shopify } from "@/lib/shopify/client";
import { prisma } from "@/lib/db";

export async function adminClient(shopDomain) {
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: {
      domain: true,
      accessToken: true,
      scope: true,
      uninstalledAt: true,
    },
  });

  if (!shop) throw new Error(`Shop not found: ${shopDomain}`);
  if (shop.uninstalledAt) throw new Error(`Shop uninstalled: ${shopDomain}`);

  const session = new Session({
    id: `offline_${shop.domain}`,
    shop: shop.domain,
    state: "",
    isOnline: false,
    accessToken: shop.accessToken,
    scope: shop.scope,
  });

  return new shopify.clients.Graphql({ session });
}
