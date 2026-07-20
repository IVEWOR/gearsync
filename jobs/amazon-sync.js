import { prisma } from "@/lib/db";
import { createAmazonClient } from "@/lib/amazon/client.js";
import { putListing, deleteListing } from "@/lib/amazon/listings.js";
import { buildListingAttributes, buildSku } from "@/lib/amazon/fitment.js";
import { getOrders } from "@/lib/amazon/orders.js";
import { US_MARKETPLACE_ID } from "@/lib/amazon/constants.js";

const SYNC_QUEUE = "amazon_sync_product";
const ORDERS_QUEUE = "amazon_import_orders";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handleProductSync(jobs) {
  for (const job of jobs) {
    const { shopId, productId, action } = job.data;
    console.log(
      `[amazon-sync] start shopId=${shopId} productId=${productId} action=${action}`,
    );

    try {
      const product = await prisma.product.findFirst({
        where: { id: productId, shopId },
        include: {
          variants: { orderBy: { position: "asc" } },
          fitments: { include: { vehicle: true } },
        },
      });
      if (!product) {
        console.warn(
          `[amazon-sync] product not found shopId=${shopId} productId=${productId}`,
        );
        continue;
      }

      const connection = await prisma.marketplaceConnection.findFirst({
        where: { shopId, marketplace: "AMAZON", disconnectedAt: null },
      });
      if (!connection) {
        console.warn(
          `[amazon-sync] no active Amazon connection for shopId=${shopId} — skipping`,
        );
        continue;
      }

      const client = createAmazonClient(connection.refreshToken);
      const sellerId = connection.metadata?.sellerId ?? connection.accountId;

      const variants =
        product.variants.length > 0 ? product.variants : [null];

      for (const variant of variants) {
        const sku = buildSku(product, variant?.shopifyVariantId ?? null);

        if (action === "delete") {
          await deleteListing(client, sellerId, sku);
          await prisma.marketplaceListing.updateMany({
            where: { productId, marketplace: "AMAZON" },
            data: { status: "ENDED", lastSyncedAt: new Date() },
          });
        } else {
          const attributes = buildListingAttributes(
            product,
            variant ? [variant] : product.variants,
            product.fitments,
          );
          const result = await putListing(
            client,
            sellerId,
            sku,
            "AUTO_PARTS",
            attributes,
          );

          const hasErrors =
            result?.issues?.some((i) => i.severity === "ERROR") ||
            result?.status === "INVALID";

          await prisma.marketplaceListing.upsert({
            where: { productId_marketplace: { productId, marketplace: "AMAZON" } },
            create: {
              shopId,
              productId,
              marketplace: "AMAZON",
              externalListingId: result?.sku || sku,
              status: hasErrors ? "ERROR" : "ACTIVE",
              lastSyncedAt: new Date(),
              lastError: hasErrors
                ? result?.issues?.map((i) => i.message).join("; ") || null
                : null,
            },
            update: {
              externalListingId: result?.sku || sku,
              status: hasErrors ? "ERROR" : "ACTIVE",
              lastSyncedAt: new Date(),
              lastError: hasErrors
                ? result?.issues?.map((i) => i.message).join("; ") || null
                : null,
            },
          });
        }

        await sleep(200);
      }

      await prisma.syncLog.create({
        data: {
          shopId,
          jobId: job.id,
          marketplace: "AMAZON",
          resourceType: "product",
          resourceId: productId,
          action: action === "delete" ? "delete" : "sync",
          status: "SUCCESS",
          message: `Amazon listing ${action === "delete" ? "ended" : "synced"} — ${product.variants.length} variant(s)`,
        },
      });

      console.log(
        `[amazon-sync] done shopId=${shopId} productId=${productId}`,
      );
    } catch (err) {
      console.error(
        `[amazon-sync] error shopId=${shopId} productId=${productId}:`,
        err.message,
      );

      try {
        await prisma.syncLog.create({
          data: {
            shopId,
            jobId: job.id,
            marketplace: "AMAZON",
            resourceType: "product",
            resourceId: productId,
            action: "sync",
            status: "ERROR",
            message: err.message,
          },
        });
      } catch (logErr) {
        console.error("[amazon-sync] failed to write error log:", logErr.message);
      }

      throw err;
    }
  }
}

async function handleImportOrders(jobs) {
  for (const job of jobs) {
    const { shopId } = job.data;
    console.log(`[amazon-orders] start shopId=${shopId}`);

    try {
      const connection = await prisma.marketplaceConnection.findFirst({
        where: { shopId, marketplace: "AMAZON", disconnectedAt: null },
      });
      if (!connection) {
        console.warn(
          `[amazon-orders] no active Amazon connection for shopId=${shopId} — skipping`,
        );
        continue;
      }

      const client = createAmazonClient(connection.refreshToken);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const orders = await getOrders(client, US_MARKETPLACE_ID, since);

      for (const order of orders) {
        await prisma.syncLog.create({
          data: {
            shopId,
            jobId: job.id,
            marketplace: "AMAZON",
            resourceType: "order",
            resourceId: order.AmazonOrderId,
            action: "import",
            status: "SUCCESS",
            message: `Order ${order.AmazonOrderId} status=${order.OrderStatus}`,
            metadata: order,
          },
        });
      }

      console.log(
        `[amazon-orders] done shopId=${shopId} orders=${orders.length}`,
      );
    } catch (err) {
      console.error(
        `[amazon-orders] error shopId=${shopId}:`,
        err.message,
      );
      throw err;
    }
  }
}

export async function registerAmazonWorkers(boss) {
  await boss.createQueue(SYNC_QUEUE);
  await boss.createQueue(ORDERS_QUEUE);
  await boss.work(SYNC_QUEUE, handleProductSync);
  await boss.work(ORDERS_QUEUE, handleImportOrders);
  console.log(`[workers] registered: ${SYNC_QUEUE}, ${ORDERS_QUEUE}`);
}
