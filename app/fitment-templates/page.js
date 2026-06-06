import { prisma } from "@/lib/db";
import TemplatesShell from "./_components/TemplatesShell";

export default async function FitmentTemplatesPage() {
  const templates = await prisma.fitmentTemplate.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      vehicleIds: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <TemplatesShell
      templates={templates.map((t) => ({
        ...t,
        vehicleCount: t.vehicleIds.length,
      }))}
    />
  );
}
