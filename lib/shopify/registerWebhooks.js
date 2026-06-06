const TOPICS = [
  "APP_UNINSTALLED",
  "APP_SUBSCRIPTIONS_UPDATE",
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
  "INVENTORY_LEVELS_UPDATE",
  "ORDERS_CREATE",
];

const MUTATION = `
  mutation webhookSubscriptionCreate(
    $topic: WebhookSubscriptionTopic!
    $webhookSubscription: WebhookSubscriptionInput!
  ) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: $webhookSubscription
    ) {
      webhookSubscription {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function registerWebhooks(client) {
  const callbackUrl = `${process.env.SHOPIFY_APP_URL}/api/webhooks`;

  for (const topic of TOPICS) {
    try {
      const res = await client.request(MUTATION, {
        variables: {
          topic,
          webhookSubscription: { callbackUrl, format: "JSON" },
        },
      });
      const errors = res.data?.webhookSubscriptionCreate?.userErrors;
      if (errors?.length) {
        // "taken" means the subscription already exists — safe to ignore on re-install
        const fatal = errors.filter((e) => !e.message.includes("taken"));
        if (fatal.length) {
          console.error(`[registerWebhooks] ${topic}:`, fatal);
        }
      }
    } catch (err) {
      console.error(`[registerWebhooks] ${topic} request failed:`, err.message);
    }
  }
}
