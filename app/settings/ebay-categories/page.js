import { prisma } from "@/lib/db";
import CategoryMappingUI from "./_components/CategoryMappingUI";

export default async function EbayCategoriesPage() {
  // Distinct Shopify product types from synced products, excluding blanks
  const rows = await prisma.product.findMany({
    where: { productType: { not: null } },
    select: { productType: true },
    distinct: ["productType"],
    orderBy: { productType: "asc" },
  });

  const productTypes = rows
    .map((r) => r.productType)
    .filter(Boolean);

  const existingMappings = await prisma.categoryMapping.findMany({
    where: { marketplace: "EBAY" },
    select: {
      shopifyProductType: true,
      externalCategoryId: true,
      externalCategoryName: true,
    },
  });

  return (
    <CategoryMappingUI
      productTypes={productTypes}
      initialMappings={existingMappings}
    />
  );
}
