import { US_MARKETPLACE_ID } from "./constants.js";

export async function searchCatalog(
  client,
  keywords,
  marketplaceId = US_MARKETPLACE_ID,
) {
  const res = await client.get("/catalog/2022-04-01/items", {
    params: {
      keywords,
      marketplaceIds: marketplaceId,
      includedData: "attributes,images,summaries",
      pageSize: 20,
    },
  });
  return res.data?.items ?? [];
}

export async function getItemByAsin(
  client,
  asin,
  marketplaceId = US_MARKETPLACE_ID,
) {
  const res = await client.get(`/catalog/2022-04-01/items/${asin}`, {
    params: {
      marketplaceIds: marketplaceId,
      includedData: "attributes,images,summaries",
    },
  });
  return res.data;
}
