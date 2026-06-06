import { shopify } from "@/lib/shopify/client";
import { prisma } from "@/lib/db";
import { registerWebhooks } from "@/lib/shopify/registerWebhooks";
import { redirect } from "next/navigation";

export async function GET(request) {
  const callback = await shopify.auth.callback({ rawRequest: request });
  const { session } = callback;

  await prisma.shop.upsert({
    where: { domain: session.shop },
    create: {
      domain: session.shop,
      shopifyShopId: BigInt(0), // updated below
      accessToken: session.accessToken,
      scope: session.scope,
    },
    update: {
      accessToken: session.accessToken,
      scope: session.scope,
      uninstalledAt: null,
    },
  });

  // Fetch shop details
  const client = new shopify.clients.Graphql({ session });
  const response = await client.request(
    `{ shop { id name email myshopifyDomain currencyCode ianaTimezone plan { displayName } } }`,
  );
  const s = response.data.shop;
  await prisma.shop.update({
    where: { domain: session.shop },
    data: {
      shopifyShopId: BigInt(s.id.split("/").pop()),
      email: s.email,
      currency: s.currencyCode,
      timezone: s.ianaTimezone,
      planName: s.plan.displayName,
    },
  });

  await registerWebhooks(client);

  return redirect(
    `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`,
  );
}
