import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const rows = await prisma.marketplaceConnection.findMany();
console.log("MC rows:", rows.length);
console.log(rows);

await prisma.$disconnect();
