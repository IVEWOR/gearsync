import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import FitmentEditor from "./_components/FitmentEditor";

export default async function ProductPage({ params }) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      shopifyProductId: true,
      fitments: {
        include: {
          vehicle: {
            select: { id: true, year: true, make: true, model: true },
          },
        },
        orderBy: [
          { vehicle: { year: "desc" } },
          { vehicle: { make: "asc" } },
          { vehicle: { model: "asc" } },
        ],
      },
    },
  });

  if (!product) notFound();

  // BigInt is not JSON-serialisable — convert before passing to client component
  const serialisable = {
    ...product,
    shopifyProductId: product.shopifyProductId.toString(),
  };

  return (
    <FitmentEditor
      product={serialisable}
      initialFitments={serialisable.fitments}
    />
  );
}
