import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
}

// If the cached singleton is missing a model that exists in the generated client
// (happens when prisma generate runs while the dev server is still running),
// throw away the stale instance so the next import gets a fresh one.
function getClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    // Quick smoke-test: if liveStream delegate is missing the client is stale
    if (!(globalForPrisma.prisma as any).liveStream) {
      globalForPrisma.prisma.$disconnect().catch(() => {});
      globalForPrisma.prisma = undefined;
    }
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = makeClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = getClient();
