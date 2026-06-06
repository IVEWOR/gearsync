import { prisma } from "@/lib/db";

export const PLAN_LIMITS = {
  FREE:    { marketplaces: 1,        products: 25       },
  STARTER: { marketplaces: 1,        products: 500      },
  GROWTH:  { marketplaces: 2,        products: 2500     },
  PRO:     { marketplaces: Infinity, products: Infinity },
};

// Returns the limit config for the shop's current active plan.
// Falls back to FREE when no active subscription exists.
export async function getShopLimits(shopId) {
  const sub = await prisma.subscription.findFirst({
    where: { shopId, status: "ACTIVE" },
    select: { planName: true },
    orderBy: { activatedAt: "desc" },
  });

  const plan = sub?.planName ?? "FREE";
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
}

export async function canAddProduct(shopId) {
  const { products } = await getShopLimits(shopId);
  if (products === Infinity) return true;
  const count = await prisma.product.count({ where: { shopId } });
  return count < products;
}

export async function canAddMarketplace(shopId) {
  const { marketplaces } = await getShopLimits(shopId);
  if (marketplaces === Infinity) return true;
  const count = await prisma.marketplaceConnection.count({ where: { shopId } });
  return count < marketplaces;
}
