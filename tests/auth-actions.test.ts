import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class KnownRequestError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }

  return {
    KnownRequestError,
    userCreate: vi.fn(),
    userFindUnique: vi.fn(),
    userUpdate: vi.fn(),
    hash: vi.fn(),
    setSessionCookie: vi.fn(),
    sendVerificationEmail: vi.fn(),
    wasVerificationRecentlySent: vi.fn(),
    consumeVerificationToken: vi.fn(),
  };
});

// redirect() throws in Next; mirror that so code after it can't run.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: async () => new Headers(),
}));
vi.mock("bcryptjs", () => ({
  default: { hash: mocks.hash, compare: vi.fn() },
}));
vi.mock("@/app/generated/prisma/client", () => ({
  Prisma: { PrismaClientKnownRequestError: mocks.KnownRequestError },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      create: mocks.userCreate,
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));
vi.mock("@/lib/session", () => ({ setSessionCookie: mocks.setSessionCookie }));
vi.mock("@/lib/login-throttle", () => ({
  clearLoginFailures: vi.fn(),
  isLoginThrottled: vi.fn(),
  recordLoginFailure: vi.fn(),
}));
vi.mock("@/lib/email-verification", () => ({
  sendVerificationEmail: mocks.sendVerificationEmail,
  wasVerificationRecentlySent: mocks.wasVerificationRecentlySent,
  consumeVerificationToken: mocks.consumeVerificationToken,
}));

import { confirmEmailVerification, registerUser } from "@/app/authorization/actions";

function registerForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const fields = {
    name: "Ada",
    email: "Ada@Example.com",
    password: "correct horse",
    "confirm-password": "correct horse",
    ...overrides,
  };

  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }

  return form;
}

const check = (email: string) =>
  `REDIRECT:/authorization/check-email?email=${encodeURIComponent(email)}`;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.hash.mockResolvedValue("new-hash");
});

describe("registerUser with an email that already exists", () => {
  const duplicate = () => mocks.userCreate.mockRejectedValue(new mocks.KnownRequestError("P2002"));

  it("keeps the 'already exists' error for a verified account", async () => {
    duplicate();
    mocks.userFindUnique.mockResolvedValue({ id: 1, email: "ada@example.com", emailVerified: new Date() });

    const result = await registerUser({}, registerForm());

    expect(result.error).toBe("An account with this email already exists.");
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("resets the password and resends the link for an unverified account", async () => {
    duplicate();
    mocks.userFindUnique.mockResolvedValue({ id: 1, email: "ada@example.com", emailVerified: null });
    mocks.wasVerificationRecentlySent.mockResolvedValue(false);

    await expect(registerUser({}, registerForm())).rejects.toThrow(check("ada@example.com"));

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "Ada", passwordHash: "new-hash" },
    });
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
      id: 1,
      email: "ada@example.com",
      name: "Ada",
    });
  });

  it("changes nothing inside the resend cooldown", async () => {
    duplicate();
    mocks.userFindUnique.mockResolvedValue({ id: 1, email: "ada@example.com", emailVerified: null });
    mocks.wasVerificationRecentlySent.mockResolvedValue(true);

    await expect(registerUser({}, registerForm())).rejects.toThrow(check("ada@example.com"));

    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("rethrows other database errors", async () => {
    mocks.userCreate.mockRejectedValue(new Error("db down"));

    await expect(registerUser({}, registerForm())).rejects.toThrow("db down");
  });
});

describe("confirmEmailVerification", () => {
  it("signs in and redirects on a valid token", async () => {
    mocks.consumeVerificationToken.mockResolvedValue(5);
    const form = new FormData();
    form.set("token", "good");

    await expect(confirmEmailVerification(form)).rejects.toThrow("REDIRECT:/platform");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(5);
  });

  it("redirects to an error without a session for a bad token", async () => {
    mocks.consumeVerificationToken.mockResolvedValue(null);
    const form = new FormData();
    form.set("token", "bad");

    await expect(confirmEmailVerification(form)).rejects.toThrow(
      "REDIRECT:/authorization?error=verify_invalid"
    );
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("does not consume anything when the token is missing", async () => {
    await expect(confirmEmailVerification(new FormData())).rejects.toThrow(
      "REDIRECT:/authorization?error=verify_invalid"
    );
    expect(mocks.consumeVerificationToken).not.toHaveBeenCalled();
  });
});
