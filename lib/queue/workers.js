import { prisma } from "@/lib/db";
import { adminClient } from "@/lib/shopify/admin";

const PRODUCT_QUERY = `
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      descriptionHtml
      status
      vendor
      productType
      tags
      variants(first: 100) {
        edges {
          node {
            id
            title
            sku
            barcode
            price
            compareAtPrice
            inventoryQuantity
            inventoryItem {
              id
            }
            position
          }
        }
      }
    }
  }
`;

function gidToId(gid) {
  return BigInt(gid.split("/").pop());
}

async function syncOneProduct(shopId, payload) {
  console.log(
    `[worker] product_sync start shopId=${shopId} productId=${payload.id}`,
  );

  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { domain: true },
    });
    if (!shop) throw new Error(`Shop not found: ${shopId}`);

    const client = await adminClient(shop.domain);
    const res = await client.request(PRODUCT_QUERY, {
      variables: { id: `gid://shopify/Product/${payload.id}` },
    });
    const p = res.data.product;
    if (!p) throw new Error(`Product not found in Shopify: ${payload.id}`);

    const productRecord = await prisma.product.upsert({
      where: { shopifyProductId: BigInt(payload.id) },
      create: {
        shopId,
        shopifyProductId: BigInt(payload.id),
        title: p.title,
        handle: p.handle,
        description: p.descriptionHtml,
        status: p.status,
        vendor: p.vendor,
        productType: p.productType,
        tags: p.tags,
        lastSyncedAt: new Date(),
      },
      update: {
        title: p.title,
        handle: p.handle,
        description: p.descriptionHtml,
        status: p.status,
        vendor: p.vendor,
        productType: p.productType,
        tags: p.tags,
        lastSyncedAt: new Date(),
      },
    });

    for (const { node: v } of p.variants.edges) {
      const shopifyVariantId = gidToId(v.id);
      const inventoryItemId = v.inventoryItem?.id
        ? gidToId(v.inventoryItem.id)
        : null;

      await prisma.variant.upsert({
        where: { shopifyVariantId },
        create: {
          productId: productRecord.id,
          shopifyVariantId,
          title: v.title,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          inventory: v.inventoryQuantity,
          inventoryItemId,
          position: v.position,
        },
        update: {
          title: v.title,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          compareAtPrice: v.compareAtPrice ?? null,
          inventory: v.inventoryQuantity,
          inventoryItemId,
          position: v.position,
        },
      });
    }

    console.log(
      `[worker] product_sync done shopId=${shopId} productId=${payload.id}`,
    );
  } catch (err) {
    console.error(
      `[worker] product_sync error shopId=${shopId} productId=${payload.id}`,
      err.message,
    );
    throw err;
  }
}

async function handleProductSync(jobs) {
  for (const job of jobs) {
    const { shopId, payload } = job.data;
    await syncOneProduct(shopId, payload);
  }
}

async function handleProductDelete(jobs) {
  for (const job of jobs) {
    const { payload } = job.data;
    console.log(`[worker] product_delete start productId=${payload.id}`);

    try {
      await prisma.product.deleteMany({
        where: { shopifyProductId: BigInt(payload.id) },
      });
      console.log(`[worker] product_delete done productId=${payload.id}`);
    } catch (err) {
      console.error(
        `[worker] product_delete error productId=${payload.id}`,
        err.message,
      );
      throw err;
    }
  }
}

async function handleInventoryUpdate(jobs) {
  for (const job of jobs) {
    const { payload } = job.data;
    console.log(
      `[worker] inventory_update start inventoryItemId=${payload.inventory_item_id}`,
    );

    try {
      await prisma.variant.updateMany({
        where: { inventoryItemId: BigInt(payload.inventory_item_id) },
        data: { inventory: payload.available },
      });
      console.log(
        `[worker] inventory_update done inventoryItemId=${payload.inventory_item_id}`,
      );
    } catch (err) {
      console.error(
        `[worker] inventory_update error inventoryItemId=${payload.inventory_item_id}`,
        err.message,
      );
      throw err;
    }
  }
}

export async function registerWorkers(boss) {
  await boss.createQueue("products_create");
  await boss.createQueue("products_update");
  await boss.createQueue("products_delete");
  await boss.createQueue("inventory_levels_update");

  await boss.work("products_create", handleProductSync);
  await boss.work("products_update", handleProductSync);
  await boss.work("products_delete", handleProductDelete);
  await boss.work("inventory_levels_update", handleInventoryUpdate);
  console.log(
    "[workers] registered: products_create, products_update, products_delete, inventory_levels_update",
  );
}
