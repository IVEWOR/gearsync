import { prisma } from "@/lib/db";
import { ebayClient } from "./client.js";

const MARKETPLACE_ID = "EBAY_US";

// Build the eBay compatibility list from Fitment + Vehicle rows.
function buildCompatibilities(fitments) {
  return fitments.map((f) => ({
    compatibilityProperties: [
      { name: "Year", value: String(f.vehicle.year) },
      { name: "Make", value: f.vehicle.make },
      { name: "Model", value: f.vehicle.model },
    ],
  }));
}

// Build listing policies object from env vars — fields are only included when set,
// because the eBay API rejects empty-string policy IDs.
function listingPolicies() {
  const p = {};
  if (process.env.EBAY_FULFILLMENT_POLICY_ID)
    p.fulfillmentPolicyId = process.env.EBAY_FULFILLMENT_POLICY_ID;
  if (process.env.EBAY_PAYMENT_POLICY_ID)
    p.paymentPolicyId = process.env.EBAY_PAYMENT_POLICY_ID;
  if (process.env.EBAY_RETURN_POLICY_ID)
    p.returnPolicyId = process.env.EBAY_RETURN_POLICY_ID;
  return Object.keys(p).length ? p : null;
}

// Parse eBay API error body into a readable string.
async function ebayError(res) {
  try {
    const j = await res.json();
    console.log("[ebay] error body:", JSON.stringify(j, null, 2));
    const msgs = (j.errors ?? [])
      .map((e) => `${e.message} (${e.errorId})`)
      .join("; ");
    return msgs || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

// Ensures the shop is opted into eBay's SELLING_POLICY_MANAGEMENT program.
// Safe to call on every sync — exits early if already enrolled.
async function ensureSellingPolicyProgram(client) {
  const res = await client.request("/sell/account/v1/program");
  if (res.ok) {
    const data = await res.json();
    const active = data.activePrograms ?? [];
    if (active.includes("SELLING_POLICY_MANAGEMENT")) return;
  }

  const optInRes = await client.request("/sell/account/v1/program/opt_in", {
    method: "POST",
    body: JSON.stringify({ programType: "SELLING_POLICY_MANAGEMENT" }),
  });
  // 409 = already enrolled — fine
  if (!optInRes.ok && optInRes.status !== 409) {
    throw new Error(
      `eBay SELLING_POLICY_MANAGEMENT opt-in failed: ${await ebayError(optInRes)}`,
    );
  }
}

// Checks/creates the DEFAULT inventory location for the shop.
// Inventory location must have a full address before offers can be published.
async function ensureInventoryLocation(client) {
  const res = await client.request("/sell/inventory/v1/location/DEFAULT");
  if (res.ok) return;

  const createRes = await client.request(
    "/sell/inventory/v1/location/DEFAULT",
    {
      method: "POST",
      body: JSON.stringify({
        location: {
          address: {
            addressLine1:
              process.env.EBAY_LOCATION_ADDRESS_LINE1 ?? "123 Main St",
            city: process.env.EBAY_LOCATION_CITY ?? "San Jose",
            stateOrProvince: process.env.EBAY_LOCATION_STATE ?? "CA",
            postalCode: process.env.EBAY_LOCATION_POSTAL_CODE ?? "95131",
            country: process.env.EBAY_LOCATION_COUNTRY ?? "US",
          },
        },
        locationTypes: ["WAREHOUSE"],
        name: "Default Warehouse",
      }),
    },
  );

  // 409 = location already exists — fine
  if (!createRes.ok && createRes.status !== 409) {
    throw new Error(
      `eBay inventory location create failed: ${await ebayError(createRes)}`,
    );
  }
}

// Creates or updates the eBay listing for a product.
// Returns { offerId, listingId }.
// Throws if category mapping is missing or product has no SKU variants.
export async function createOrUpdateListing(shopId, productId) {
  // Load product with all needed relations
  const product = await prisma.product.findFirst({
    where: { id: productId, shopId },
    include: {
      variants: { orderBy: { position: "asc" } },
      fitments: { include: { vehicle: true } },
    },
  });
  if (!product) throw new Error(`Product not found: ${productId}`);

  // Category mapping required to list
  const mapping = await prisma.categoryMapping.findFirst({
    where: {
      shopId,
      marketplace: "EBAY",
      shopifyProductType: product.productType ?? "",
    },
  });
  if (!mapping) {
    throw new Error(
      `No eBay category mapping for product type "${product.productType}" — configure it in Settings › eBay Categories`,
    );
  }

  // Only variants with a SKU can be listed
  const skuVariants = product.variants.filter((v) => v.sku?.trim());
  if (!skuVariants.length) {
    throw new Error(
      `Product has no variants with a SKU — add SKUs in Shopify before syncing`,
    );
  }

  const compatibilities = buildCompatibilities(product.fitments);
  const client = await ebayClient(shopId);

  // ── Prerequisites (idempotent) ────────────────────────────────────────────
  await ensureSellingPolicyProgram(client);
  await ensureInventoryLocation(client);

  // ── Step 1: PUT inventory item for every SKU variant ──────────────────────
  for (const variant of skuVariants) {
    const payload = {
      availability: {
        shipToLocationAvailability: {
          quantity: Math.max(variant.inventory ?? 0, 0),
        },
      },
      condition: "NEW",
      product: {
        title: (product.title ?? variant.title ?? "").slice(0, 80),
        description: product.description ?? "",
        aspects: {
          ...(product.vendor ? { Brand: [product.vendor] } : {}),
          "Part Type": [product.productType ?? "Auto Part"],
        },
      },
    };

    if (compatibilities.length) {
      payload.compatibilityList = { compatibilities };
    }

    const res = await client.request(
      `/sell/inventory/v1/inventory_item/${encodeURIComponent(variant.sku)}`,
      { method: "PUT", body: JSON.stringify(payload) },
    );

    // PUT returns 204 on success — any other non-2xx is an error
    if (!res.ok && res.status !== 204) {
      throw new Error(
        `eBay inventory item PUT (${variant.sku}) failed: ${await ebayError(res)}`,
      );
    }
  }

  // ── Step 2: Find existing offer for the primary SKU ───────────────────────
  const primaryVariant = skuVariants[0];
  const primarySku = primaryVariant.sku;

  const offersRes = await client.request(
    `/sell/inventory/v1/offer?sku=${encodeURIComponent(primarySku)}&marketplace_id=${MARKETPLACE_ID}`,
  );

  let existingOfferId = null;
  if (offersRes.ok) {
    const offersData = await offersRes.json();
    existingOfferId = offersData?.offers?.[0]?.offerId ?? null;
  }

  const offerBody = {
    sku: primarySku,
    marketplaceId: MARKETPLACE_ID,
    format: "FIXED_PRICE",
    availableQuantity: Math.max(primaryVariant.inventory ?? 0, 0),
    categoryId: mapping.externalCategoryId,
    listingDescription: product.description ?? product.title ?? "",
    pricingSummary: {
      price: {
        currency: "USD",
        value: Number(primaryVariant.price).toFixed(2),
      },
    },
    merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY ?? "DEFAULT",
  };

  const policies = listingPolicies();
  if (policies) offerBody.listingPolicies = policies;

  let offerId;

  if (existingOfferId) {
    // Update existing offer
    const updateRes = await client.request(
      `/sell/inventory/v1/offer/${existingOfferId}`,
      { method: "PUT", body: JSON.stringify(offerBody) },
    );
    if (!updateRes.ok && updateRes.status !== 204) {
      throw new Error(
        `eBay offer update failed: ${await ebayError(updateRes)}`,
      );
    }
    offerId = existingOfferId;
  } else {
    // Create offer — eBay returns error 25002 if one already exists for this SKU
    const createRes = await client.request("/sell/inventory/v1/offer", {
      method: "POST",
      body: JSON.stringify(offerBody),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      offerId = createData.offerId;
    } else {
      let errBody;
      try {
        errBody = await createRes.json();
      } catch {
        errBody = {};
      }
      console.log(
        "[ebay] offer create error body:",
        JSON.stringify(errBody, null, 2),
      );

      // 25002 = offer already exists; the existing offerId is in parameters[0].value
      const dupErr = (errBody.errors ?? []).find((e) => e.errorId === 25002);
      if (dupErr) {
        const dupId = dupErr.parameters?.[0]?.value;
        if (!dupId)
          throw new Error(
            "eBay offer duplicate (25002) but no offerId in error",
          );
        const updateRes = await client.request(
          `/sell/inventory/v1/offer/${dupId}`,
          { method: "PUT", body: JSON.stringify(offerBody) },
        );
        if (!updateRes.ok && updateRes.status !== 204) {
          throw new Error(
            `eBay offer update (after dup) failed: ${await ebayError(updateRes)}`,
          );
        }
        offerId = dupId;
      } else {
        const msgs = (errBody.errors ?? [])
          .map((e) => `${e.message} (${e.errorId})`)
          .join("; ");
        throw new Error(
          `eBay offer create failed: ${msgs || `HTTP ${createRes.status}`}`,
        );
      }
    }
  }

  // ── Step 3: Publish ───────────────────────────────────────────────────────
  // eBay returns HTTP 411 if Content-Length is absent on this bodyless POST.
  const publishRes = await client.request(
    `/sell/inventory/v1/offer/${offerId}/publish`,
    { method: "POST", headers: { "Content-Length": "0" } },
  );
  if (!publishRes.ok) {
    throw new Error(
      `eBay offer publish failed: ${await ebayError(publishRes)}`,
    );
  }
  const publishData = await publishRes.json();
  const listingId = publishData.listingId; // visible eBay item ID

  // ── Step 4: Upsert MarketplaceListing ─────────────────────────────────────
  await prisma.marketplaceListing.upsert({
    where: { productId_marketplace: { productId, marketplace: "EBAY" } },
    create: {
      shopId,
      productId,
      marketplace: "EBAY",
      externalListingId: offerId,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
    update: {
      externalListingId: offerId,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
      lastError: null,
    },
  });

  return { offerId, listingId };
}

// Withdraws an eBay offer (ends the listing).
// externalListingId is the offerId stored in MarketplaceListing.
export async function endListing(shopId, externalListingId) {
  const client = await ebayClient(shopId);
  const res = await client.request(
    `/sell/inventory/v1/offer/${externalListingId}/withdraw`,
    { method: "POST" },
  );
  if (!res.ok) {
    throw new Error(`eBay withdraw failed: ${await ebayError(res)}`);
  }

  await prisma.marketplaceListing.updateMany({
    where: { shopId, externalListingId, marketplace: "EBAY" },
    data: { status: "ENDED", lastSyncedAt: new Date() },
  });
}
