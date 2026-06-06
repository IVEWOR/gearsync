import { adminClient } from "@/lib/shopify/admin";

export const PLANS = {
  FREE: { name: "Free", price: 0 },
  STARTER: { name: "Starter", price: 49 },
  GROWTH: { name: "Growth", price: 99 },
  PRO: { name: "Pro", price: 199 },
};

// Maps Shopify AppSubscriptionStatus → our SubscriptionStatus enum.
// EXPIRED has no equivalent in our schema; treat as CANCELLED.
export const STATUS_MAP = {
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
  DECLINED: "DECLINED",
  EXPIRED: "CANCELLED",
  FROZEN: "FROZEN",
  PENDING: "PENDING",
};

const SUBSCRIBE_MUTATION = `
  mutation appSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      test: $test
      lineItems: $lineItems
    ) {
      appSubscription {
        id
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

// Returns { chargeId: BigInt, confirmationUrl: string } for paid plans.
// Returns null for FREE — no Shopify subscription is created.
export async function createRecurringCharge(shopDomain, plan) {
  if (plan === "FREE") return null;

  const planConfig = PLANS[plan];
  if (!planConfig) throw new Error(`Unknown plan: ${plan}`);

  const client = await adminClient(shopDomain);
  const returnUrl = `${process.env.SHOPIFY_APP_URL}/api/billing/callback`;
  const isTest = process.env.NODE_ENV !== "production";

  const res = await client.request(SUBSCRIBE_MUTATION, {
    variables: {
      name: `GearSync ${planConfig.name}`,
      returnUrl,
      test: isTest,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: planConfig.price, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    },
  });

  console.log("[billing] subscribe response:", JSON.stringify(res, null, 2));

  // Handle both shapes: { data: {...} } and direct {...}
  const body = res.data ?? res;
  const result = body?.appSubscriptionCreate;

  if (!result) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(res)}`);
  }

  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((e) => e.message).join(", "));
  }

  const chargeId = BigInt(result.appSubscription.id.split("/").pop());
  return { chargeId, confirmationUrl: result.confirmationUrl };
}
