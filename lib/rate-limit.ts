import { prisma } from "@/lib/prisma";

export const CHAT_TOKEN_BUDGET = 200_000;
export const CHAT_WINDOW_SECONDS = 6 * 60 * 60;
// Loose backstop so zero-token or failing calls can't be retried forever.
export const CHAT_MAX_REQUESTS = 100;
// Charged up front and replaced with the real usage once the call finishes.
export const CHAT_RESERVED_TOKENS = 4000;

// Sliding window: a user's spend is the sum of their ChatUsage rows from the
// last CHAT_WINDOW_SECONDS. Reserving is a single statement, so in-flight
// calls already count against the budget.
export async function reserveChatUsage(userId: number) {
  await prisma.$executeRaw`
    DELETE FROM "ChatUsage"
    WHERE "userId" = ${userId}
      AND "createdAt" < NOW() - make_interval(secs => ${CHAT_WINDOW_SECONDS}::double precision)
  `;

  const rows = await prisma.$queryRaw<{ id: number }[]>`
    INSERT INTO "ChatUsage" ("userId", "tokens")
    SELECT ${userId}::int, ${CHAT_RESERVED_TOKENS}::int
    WHERE (
      SELECT COALESCE(SUM("tokens"), 0) FROM "ChatUsage"
      WHERE "userId" = ${userId}
        AND "createdAt" > NOW() - make_interval(secs => ${CHAT_WINDOW_SECONDS}::double precision)
    ) < ${CHAT_TOKEN_BUDGET}
    AND (
      SELECT COUNT(*) FROM "ChatUsage"
      WHERE "userId" = ${userId}
        AND "createdAt" > NOW() - make_interval(secs => ${CHAT_WINDOW_SECONDS}::double precision)
    ) < ${CHAT_MAX_REQUESTS}
    RETURNING "id"
  `;

  return rows[0]?.id ?? null;
}

export async function settleChatUsage(id: number, tokens: number) {
  await prisma.chatUsage.update({
    where: { id },
    data: { tokens: Math.max(0, Math.round(tokens)) },
  });
}
