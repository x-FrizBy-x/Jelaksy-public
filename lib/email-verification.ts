import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email";

export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Issues a fresh link and invalidates any earlier ones for the user.
export async function sendVerificationEmail(user: {
  id: number;
  email: string;
  name: string;
}) {
  const token = randomBytes(32).toString("hex");

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
    }),
  ]);

  const link = `${getEnv().APP_URL}/api/auth/verify?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Verify your email for Jelaksy",
    text: `Hi ${user.name},\n\nConfirm your email to finish creating your account:\n${link}\n\nThe link expires in 24 hours. If you didn't sign up, ignore this email.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p><a href="${link}">Confirm your email</a> to finish creating your account.</p><p>The link expires in 24 hours. If you didn't sign up, ignore this email.</p>`,
  });
}

// Marks the email verified and returns the user id, or null for an unknown
// or expired token. The token is single use.
export async function consumeVerificationToken(token: string) {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record) {
    return null;
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    return null;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return record.userId;
}

// True if a link was issued within the cooldown, so resend can be refused.
export async function wasVerificationRecentlySent(userId: number) {
  const recent = await prisma.emailVerificationToken.findFirst({
    where: {
      userId,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    select: { id: true },
  });

  return recent !== null;
}
