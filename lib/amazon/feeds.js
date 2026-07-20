import axios from "axios";

export async function createFeedDocument(
  client,
  contentType = "application/json",
) {
  const res = await client.post("/feeds/2021-06-30/documents", { contentType });
  return res.data; // { feedDocumentId, url }
}

export async function uploadFeedContent(presignedUrl, content) {
  await axios.put(presignedUrl, content, {
    headers: { "Content-Type": "application/json" },
    transformRequest: [(d) => d],
  });
}

export async function createFeed(
  client,
  feedType,
  feedDocumentId,
  marketplaceId,
) {
  const res = await client.post("/feeds/2021-06-30/feeds", {
    feedType,
    marketplaceIds: [marketplaceId],
    inputFeedDocumentId: feedDocumentId,
  });
  return res.data; // { feedId }
}

export async function getFeedStatus(client, feedId) {
  const res = await client.get(`/feeds/2021-06-30/feeds/${feedId}`);
  return res.data; // { processingStatus, resultFeedDocumentId? }
}
