import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { mockPrisma } from "@/mocks/mock-prisma";

function crearPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  process.env.USE_MOCK === "true"
    ? (mockPrisma as unknown as PrismaClient)
    : (globalForPrisma.prisma ?? crearPrismaClient());

if (process.env.NODE_ENV !== "production" && process.env.USE_MOCK !== "true") {
  globalForPrisma.prisma = prisma;
}
