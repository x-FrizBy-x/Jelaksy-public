import { prisma } from "@/lib/prisma";

export const LOGIN_MAX_FAILURES_PER_EMAIL = 5;
export const LOGIN_MAX_FAILURES_PER_IP = 20;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function keysFor(email: string, ip: string) {
  return [`email:${email}`, `ip:${ip}`];
}

// Failed logins in the window are counted per email and per client IP.
export async function isLoginThrottled(email: string, ip: string) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [emailKey, ipKey] = keysFor(email, ip);

  const [emailFailures, ipFailures] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: emailKey, createdAt: { gt: since } } }),
    prisma.loginAttempt.count({ where: { key: ipKey, createdAt: { gt: since } } }),
  ]);

  return (
    emailFailures >= LOGIN_MAX_FAILURES_PER_EMAIL ||
    ipFailures >= LOGIN_MAX_FAILURES_PER_IP
  );
}

export async function recordLoginFailure(email: string, ip: string) {
  await prisma.loginAttempt.createMany({
    data: keysFor(email, ip).map((key) => ({ key })),
  });
}

export async function clearLoginFailures(email: string) {
  await prisma.loginAttempt.deleteMany({
    where: {
      OR: [
        { key: `email:${email}` },
        { createdAt: { lt: new Date(Date.now() - LOGIN_WINDOW_MS) } },
      ],
    },
  });
}
