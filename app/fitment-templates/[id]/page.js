import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import TemplateEditor from "./_components/TemplateEditor";

export default async function TemplatePage({ params }) {
  const { id } = await params;

  const template = await prisma.fitmentTemplate.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, vehicleIds: true },
  });

  if (!template) notFound();

  const vehicles = template.vehicleIds.length
    ? await prisma.vehicle.findMany({
        where: { id: { in: template.vehicleIds } },
        select: { id: true, year: true, make: true, model: true },
        orderBy: [{ year: "desc" }, { make: "asc" }, { model: "asc" }],
      })
    : [];

  return <TemplateEditor template={template} initialVehicles={vehicles} />;
}
