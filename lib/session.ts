import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const getSecretKey = () => new TextEncoder().encode(getEnv().SESSION_SECRET);

export async function createSession(userId: number) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("3d")
    .sign(getSecretKey());
}

export async function setSessionCookie(userId: number) {
  const session = await createSession(userId);
  const cookieStore = await cookies();

  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 3,
  });
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    return {
      userId:
        typeof payload.userId === "number"
          ? payload.userId
          : null,
    };
  } catch {
    return null;
  }
}

// Deduplicated per request, so a page and its children share one lookup.
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return null;
  }

  const session = await verifySession(token);

  if (!session?.userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
    },
  });

  // Also covers sessions issued before email verification existed.
  if (!user?.emailVerified) {
    return null;
  }

  return { id: user.id, name: user.name, email: user.email };
});