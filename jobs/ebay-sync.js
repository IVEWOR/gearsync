import { prisma } from "@/lib/db";
import { createOrUpdateListing } from "@/lib/ebay/listings";

const QUEUE = "ebay_listing_sync";

async function handleEbaySync(jobs) {
  for (const job of jobs) {
    const { shopId, productId } = job.data;
    console.log(`[ebay-sync] start shopId=${shopId} productId=${productId}`);

    try {
      const result = await createOrUpdateListing(shopId, productId);

      await prisma.syncLog.create({
        data: {
          shopId,
          jobId: job.id,
          marketplace: "EBAY",
          resourceType: "product",
          resourceId: productId,
          action: "sync",
          status: "SUCCESS",
          message: `eBay listing synced — offerId: ${result.offerId}`,
          metadata: { offerId: result.offerId, listingId: result.listingId ?? null },
        },
      });

      console.log(
        `[ebay-sync] done shopId=${shopId} productId=${productId} offerId=${result.offerId}`,
      );
    } catch (err) {
      console.error(
        `[ebay-sync] error shopId=${shopId} productId=${productId}:`,
        err.message,
      );

      // Log the failure — best-effort, don't let this hide the original error
      try {
        await prisma.syncLog.create({
          data: {
            shopId,
            jobId: job.id,
            marketplace: "EBAY",
            resourceType: "product",
            resourceId: productId,
            action: "sync",
            status: "ERROR",
            message: err.message,
          },
        });

        // Mark the listing as errored so the UI can surface it
        await prisma.marketplaceListing.upsert({
          where: { productId_marketplace: { productId, marketplace: "EBAY" } },
          create: {
            shopId,
            productId,
            marketplace: "EBAY",
            externalListingId: "error",
            status: "ERROR",
            lastSyncedAt: new Date(),
            lastError: err.message,
          },
          update: {
            status: "ERROR",
            lastSyncedAt: new Date(),
            lastError: err.message,
          },
        });
      } catch (logErr) {
        console.error("[ebay-sync] failed to write error log:", logErr.message);
      }

      throw err; // let pg-boss see the failure and handle retry
    }
  }
}

export async function register(boss) {
  await boss.createQueue(QUEUE);
  await boss.work(QUEUE, handleEbaySync);
  console.log(`[workers] registered: ${QUEUE}`);
}
