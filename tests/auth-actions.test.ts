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
    compare: vi.fn(),
    isLoginThrottled: vi.fn(),
    recordLoginFailure: vi.fn(),
    clearLoginFailures: vi.fn(),
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
  default: { hash: mocks.hash, compare: mocks.compare },
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
  clearLoginFailures: mocks.clearLoginFailures,
  isLoginThrottled: mocks.isLoginThrottled,
  recordLoginFailure: mocks.recordLoginFailure,
}));
vi.mock("@/lib/email-verification", () => ({
  sendVerificationEmail: mocks.sendVerificationEmail,
  wasVerificationRecentlySent: mocks.wasVerificationRecentlySent,
  consumeVerificationToken: mocks.consumeVerificationToken,
}));

import {
  confirmEmailVerification,
  loginUser,
  registerUser,
  resendVerification,
} from "@/app/authorization/actions";

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

function loginForm(email = "Ada@Example.com", password = "correct horse") {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  return form;
}

describe("loginUser", () => {
  const verifiedUser = { id: 3, passwordHash: "h", emailVerified: new Date() };
  const invalid = "Invalid email or password.";

  it("rejects empty fields without touching the database", async () => {
    const result = await loginUser({}, loginForm("", ""));

    expect(result.error).toBe("Please enter your email and password.");
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("refuses while throttled", async () => {
    mocks.isLoginThrottled.mockResolvedValue(true);

    const result = await loginUser({}, loginForm());

    expect(result.error).toMatch(/Too many failed attempts/);
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("records a failure for a wrong password", async () => {
    mocks.userFindUnique.mockResolvedValue(verifiedUser);
    mocks.compare.mockResolvedValue(false);

    const result = await loginUser({}, loginForm());

    expect(result.error).toBe(invalid);
    expect(mocks.recordLoginFailure).toHaveBeenCalledWith("ada@example.com", "unknown");
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("gives the same message for an unknown email and an OAuth-only account", async () => {
    mocks.compare.mockResolvedValue(true);

    mocks.userFindUnique.mockResolvedValue(null);
    expect((await loginUser({}, loginForm())).error).toBe(invalid);

    mocks.userFindUnique.mockResolvedValue({ ...verifiedUser, passwordHash: null });
    expect((await loginUser({}, loginForm())).error).toBe(invalid);

    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("sends an unverified user to check-email only after the right password", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...verifiedUser, emailVerified: null });
    mocks.compare.mockResolvedValue(true);

    await expect(loginUser({}, loginForm())).rejects.toThrow(check("ada@example.com"));
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("signs a verified user in and clears their failures", async () => {
    mocks.userFindUnique.mockResolvedValue(verifiedUser);
    mocks.compare.mockResolvedValue(true);

    await expect(loginUser({}, loginForm())).rejects.toThrow("REDIRECT:/platform");
    expect(mocks.clearLoginFailures).toHaveBeenCalledWith("ada@example.com");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(3);
  });
});

describe("resendVerification", () => {
  const emailForm = (email: string) => {
    const form = new FormData();
    form.set("email", email);
    return form;
  };
  const generic = "If that address needs verification, we've sent a new link.";
  const unverified = { id: 4, email: "ada@example.com", name: "Ada", emailVerified: null };

  it("sends a link to an unverified user", async () => {
    mocks.userFindUnique.mockResolvedValue(unverified);
    mocks.wasVerificationRecentlySent.mockResolvedValue(false);

    const result = await resendVerification({}, emailForm("Ada@Example.com"));

    expect(result.message).toBe(generic);
    expect(mocks.recordLoginFailure).toHaveBeenCalledWith("resend:ada@example.com", "unknown");
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith(unverified);
  });

  it("gives the same answer and sends nothing for unknown, verified or recently-sent", async () => {
    mocks.wasVerificationRecentlySent.mockResolvedValue(false);

    mocks.userFindUnique.mockResolvedValue(null);
    expect((await resendVerification({}, emailForm("x@example.com"))).message).toBe(generic);

    mocks.userFindUnique.mockResolvedValue({ ...unverified, emailVerified: new Date() });
    expect((await resendVerification({}, emailForm("x@example.com"))).message).toBe(generic);

    mocks.userFindUnique.mockResolvedValue(unverified);
    mocks.wasVerificationRecentlySent.mockResolvedValue(true);
    expect((await resendVerification({}, emailForm("x@example.com"))).message).toBe(generic);

    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("refuses while throttled without looking the user up", async () => {
    mocks.isLoginThrottled.mockResolvedValue(true);

    const result = await resendVerification({}, emailForm("ada@example.com"));

    expect(result.message).toMatch(/Too many requests/);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("still answers when the email provider fails", async () => {
    mocks.userFindUnique.mockResolvedValue(unverified);
    mocks.wasVerificationRecentlySent.mockResolvedValue(false);
    mocks.sendVerificationEmail.mockRejectedValue(new Error("resend down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await resendVerification({}, emailForm("ada@example.com"))).message).toBe(generic);
  });
});
