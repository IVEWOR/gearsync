export async function getOrders(client, marketplaceId, createdAfter) {
  const res = await client.get("/orders/v0/orders", {
    params: {
      MarketplaceIds: marketplaceId,
      CreatedAfter: createdAfter.toISOString(),
      OrderStatuses: "Unshipped,PartiallyShipped,Shipped",
    },
  });
  return res.data?.payload?.Orders ?? [];
}
