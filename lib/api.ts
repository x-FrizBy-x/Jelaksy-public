import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Resolves the signed-in user for an API route. When there is none, `response`
 * is the 401 to return:
 *
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;
 */
export async function requireUser(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, user };
}

/** Finds a project only if it belongs to the given user. */
export function getOwnedProject(id: string, userId: number) {
  return prisma.project.findFirst({ where: { id, ownerId: userId } });
}

export function projectNotFound() {
  return NextResponse.json({ error: "Project not found" }, { status: 404 });
}
