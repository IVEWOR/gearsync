export function buildCompatibilityAttributes(fitments) {
  return fitments
    .filter((f) => f.vehicle != null)
    .map((f) => {
      const entry = {
        vehicle_year: [{ value: String(f.vehicle.year) }],
        vehicle_make: [{ value: f.vehicle.make }],
        vehicle_model: [{ value: f.vehicle.model }],
      };
      if (f.vehicle.trim) entry.vehicle_trim = [{ value: f.vehicle.trim }];
      if (f.vehicle.engine)
        entry.vehicle_engine = [{ value: f.vehicle.engine }];
      return entry;
    });
}

export function buildSku(product, variantId = null) {
  const productId = product.shopifyProductId?.toString() ?? product.id;
  return variantId ? `GS-${productId}-${variantId}` : `GS-${productId}`;
}

export function buildListingAttributes(product, variants, fitments) {
  const primaryVariant = variants[0];
  const compatibility = buildCompatibilityAttributes(fitments);

  const attrs = {
    item_name: [{ value: product.title ?? "Untitled", language_tag: "en_US" }],
    brand: [{ value: product.vendor || "Generic" }],
    product_description: [
      {
        value: (product.description || product.title || "Auto Part").substring(
          0,
          2000,
        ),
      },
    ],
    list_price: [
      {
        value: parseFloat(primaryVariant?.price?.toString() ?? "0"), // Decimal → string → float
        currency: "USD",
      },
    ],
    fulfillment_availability: [
      {
        fulfillment_channel_code: "DEFAULT",
        quantity: primaryVariant?.inventory ?? 0, // inventory not inventoryQuantity
      },
    ],
    part_number: [
      {
        value:
          primaryVariant?.sku ||
          primaryVariant?.shopifyVariantId?.toString() ||
          product.shopifyProductId?.toString() ||
          product.id,
      },
    ],
  };

  if (compatibility.length > 0) {
    attrs.compatibility = compatibility;
  }

  return attrs;
}
