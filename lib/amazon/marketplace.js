export async function getMarketplaceParticipations(client) {
  const res = await client.get("/sellers/v1/marketplaceParticipations");
  const participations = res.data?.payload?.participations ?? [];
  const sellerId = participations[0]?.seller?.sellerId ?? null;
  return { sellerId, marketplaces: participations.map((p) => p.marketplace) };
}
