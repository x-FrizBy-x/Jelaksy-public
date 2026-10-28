import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { getEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaNeon({ connectionString: getEnv().DATABASE_URL }),
    });
  }

  return globalForPrisma.prisma;
}

// Created on first query, not at import, so env validation errors surface
// where the database is used and builds don't need DATABASE_URL.
export const prisma = new Proxy({} as PrismaClient, {
  get: (_target, property) => Reflect.get(getClient(), property),
});
