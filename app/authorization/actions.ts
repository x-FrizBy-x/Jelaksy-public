"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { cookies, headers } from "next/headers";
import { setSessionCookie } from "@/lib/session";
import { redirect } from "next/navigation";
import {
  clearLoginFailures,
  isLoginThrottled,
  recordLoginFailure,
} from "@/lib/login-throttle";

// `values` echoes non-secret fields back so React's post-action form reset
// doesn't wipe them on a validation error.
export type AuthState = {
  error?: string;
  values?: { name?: string; email?: string };
};

const RegisterSchema = z
  .object({
    name: z.string().trim().min(1, "Please fill in all fields.").max(100),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Please fill in all fields.")
      .pipe(z.email("Please enter a valid email address.")),
    password: z
      .string()
      .min(1, "Please fill in all fields.")
      .min(8, "Password must be at least 8 characters.")
      // bcrypt ignores everything past 72 bytes, not characters.
      .refine((value) => new TextEncoder().encode(value).length <= 72, {
        message: "Password must be at most 72 bytes.",
      }),
    confirmPassword: z.string().min(1, "Please fill in all fields."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

// Precomputed cost-12 hash of a throwaway string; compared against when the
// email is unknown so both failure paths cost one bcrypt round. Must keep the
// same cost as real hashes (bcrypt.hash(password, 12) below).
const DUMMY_PASSWORD_HASH =
  "$2b$12$bx2LmbbFl2eAQQv0xABtXeGse8kt7om/hyh7JdwD913ctU3lEptoK";

async function getClientIp() {
  const headerList = await headers();

  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown"
  );
}

export async function registerUser(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirm-password") ?? ""),
  };
  const values = { name: raw.name, email: raw.email };
  const parsed = RegisterSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values };
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  let userId: number;

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });
    userId = user.id;
  } catch (error) {
    // Unique constraint on email: also covers concurrent signups.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "An account with this email already exists.", values };
    }

    throw error;
  }

  await setSessionCookie(userId);

  redirect("/platform");
}

export async function loginUser(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const values = { email };

  if (!email || !password) {
    return { error: "Please enter your email and password.", values };
  }

  const ip = await getClientIp();

  if (await isLoginThrottled(email, ip)) {
    return {
      error: "Too many failed attempts. Please try again in a few minutes.",
      values,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  );

  if (!user || !passwordMatches) {
    await recordLoginFailure(email, ip);
    return { error: "Invalid email or password.", values };
  }

  await clearLoginFailures(email);
  await setSessionCookie(user.id);

  redirect("/platform");
}

export async function logoutUser() {
  const cookieStore = await cookies();

  cookieStore.delete("session");

  redirect("/authorization");
}
