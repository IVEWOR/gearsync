import { US_MARKETPLACE_ID } from "./constants.js";

export async function putListing(
  client,
  sellerId,
  sku,
  productType,
  attributes,
) {
  const res = await client.put(
    `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}`,
    { productType, requirements: "LISTING", attributes },
    { params: { marketplaceIds: US_MARKETPLACE_ID } },
  );
  return res.data;
}

export async function deleteListing(client, sellerId, sku) {
  const res = await client.delete(
    `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}`,
    { params: { marketplaceIds: US_MARKETPLACE_ID } },
  );
  return res.data;
}

export async function getListing(client, sellerId, sku) {
  const res = await client.get(
    `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}/${encodeURIComponent(sku)}`,
    {
      params: {
        marketplaceIds: US_MARKETPLACE_ID,
        includedData:
          "attributes,issues,offers,fulfillmentAvailability",
      },
    },
  );
  return res.data;
}
