"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { createSession } from "@/lib/session";
import { redirect } from "next/navigation";

export async function registerUser(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm-password") ?? "");

  const existingUser = await prisma.user.findUnique({where: {email}});

  if (!name ||!email || !password || !confirmPassword) {
    throw new Error("Please fill in all fields.");
  }

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  if (existingUser) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
  data: {
    name,
    email,
    passwordHash,
  },
  });

const session = await createSession(user.id);

const cookieStore = await cookies();

cookieStore.set("session", session, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 3,
});

redirect("/platform");
}

export async function loginUser(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    throw new Error("Please enter your email and password.");
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordMatches) {
    throw new Error("Invalid email or password.");
  }

  const session = await createSession(user.id);

  const cookieStore = await cookies();

  cookieStore.set("session", session, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 3,
});

redirect("/platform");
}

export async function logoutUser() {
  const cookieStore = await cookies();

  cookieStore.delete("session");

  redirect("/authorization");
}