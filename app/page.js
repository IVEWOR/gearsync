import { redirect } from "next/navigation";
import { shopify } from "@/lib/shopify/client";
import { prisma } from "@/lib/db";
import AppShell from "./_components/AppShell";

export default async function Home({ searchParams }) {
  const { id_token, shop } = await searchParams;

  if (!id_token && shop) {
    redirect(`/api/auth?shop=${shop}`);
  }

  if (!id_token) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>Install GearSync from the Shopify App Store.</p>
      </div>
    );
  }

  let shopDomain = null;

  try {
    const payload = await shopify.session.decodeSessionToken(id_token);
    shopDomain = new URL(payload.dest).hostname;
  } catch {
    redirect(`/api/auth${shop ? `?shop=${shop}` : ""}`);
  }

  const shopRecord = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: {
      id: true,
      domain: true,
      email: true,
      planName: true,
      _count: { select: { products: true } },
      marketplaceConnections: {
        where: { disconnectedAt: null },
        select: { marketplace: true },
      },
    },
  });

  if (!shopRecord) {
    redirect(`/api/auth?shop=${shopDomain}`);
  }

  const [activeListings, lastSync] = await Promise.all([
    prisma.marketplaceListing.count({
      where: { shopId: shopRecord.id, status: "ACTIVE" },
    }),
    prisma.syncLog.findFirst({
      where: { shopId: shopRecord.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return (
    <AppShell
      shopId={shopRecord.id}
      shopDomain={shopRecord.domain}
      shopEmail={shopRecord.email}
      planName={shopRecord.planName}
      stats={{
        productsCount: shopRecord._count.products,
        activeListings,
        lastSyncAt: lastSync?.createdAt?.toISOString() ?? null,
      }}
      connections={{
        ebay: shopRecord.marketplaceConnections.some((c) => c.marketplace === "EBAY"),
        amazon: shopRecord.marketplaceConnections.some((c) => c.marketplace === "AMAZON"),
      }}
    />
  );
}
