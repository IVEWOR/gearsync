import { prisma } from "@/lib/db";
import ProductsShell from "./_components/ProductsShell";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      vendor: true,
      productType: true,
      _count: { select: { fitments: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return <ProductsShell products={products} />;
}
