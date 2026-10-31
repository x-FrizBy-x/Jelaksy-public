import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accountFind: vi.fn(),
  accountCreate: vi.fn(),
  userFind: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_URL: "http://app.test" }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    oAuthAccount: { findUnique: mocks.accountFind, create: mocks.accountCreate },
    user: {
      findUnique: mocks.userFind,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
  },
}));

import { findOrCreateOAuthUser, isOAuthProvider } from "@/lib/oauth";

const profile = {
  providerAccountId: "g-1",
  email: "ann@example.com",
  emailVerified: true,
  name: "Ann",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.accountFind.mockResolvedValue(null);
  mocks.transaction.mockResolvedValue([]);
});

describe("isOAuthProvider", () => {
  it("accepts only google and github", () => {
    expect(isOAuthProvider("google")).toBe(true);
    expect(isOAuthProvider("github")).toBe(true);
    expect(isOAuthProvider("apple")).toBe(false);
  });
});

describe("findOrCreateOAuthUser", () => {
  it("returns the user of an existing link without touching accounts", async () => {
    mocks.accountFind.mockResolvedValue({ userId: 3 });

    expect(await findOrCreateOAuthUser("google", profile)).toBe(3);
    expect(mocks.userFind).not.toHaveBeenCalled();
  });

  it("refuses a new login when the provider email is not verified", async () => {
    const result = await findOrCreateOAuthUser("github", { ...profile, emailVerified: false });

    expect(result).toBeNull();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("creates a verified account with no password for a new email", async () => {
    mocks.userFind.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: 9 });

    expect(await findOrCreateOAuthUser("google", profile)).toBe(9);

    const { data } = mocks.userCreate.mock.calls[0][0];

    expect(data.emailVerified).toBeInstanceOf(Date);
    expect(data.passwordHash).toBeUndefined();
    expect(data.oauthAccounts.create).toEqual({ provider: "google", providerAccountId: "g-1" });
  });

  it("links to a verified existing account and keeps its password", async () => {
    mocks.userFind.mockResolvedValue({ id: 4, emailVerified: new Date() });

    expect(await findOrCreateOAuthUser("google", profile)).toBe(4);

    const { data } = mocks.userUpdate.mock.calls[0][0];

    expect(data).not.toHaveProperty("passwordHash");
    expect(mocks.accountCreate).toHaveBeenCalledWith({
      data: { userId: 4, provider: "google", providerAccountId: "g-1" },
    });
  });

  it("drops the password when taking over an unverified password account", async () => {
    mocks.userFind.mockResolvedValue({ id: 5, emailVerified: null });

    expect(await findOrCreateOAuthUser("google", profile)).toBe(5);

    const { data } = mocks.userUpdate.mock.calls[0][0];

    expect(data.passwordHash).toBeNull();
    expect(data.emailVerified).toBeInstanceOf(Date);
  });
});
