import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  tokenDelete: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_URL: "http://app.test" }) }));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    emailVerificationToken: {
      findUnique: mocks.findUnique,
      delete: mocks.tokenDelete,
      deleteMany: mocks.deleteMany,
      create: mocks.create,
    },
    user: { update: mocks.userUpdate },
  },
}));

import {
  consumeVerificationToken,
  sendVerificationEmail,
} from "@/lib/email-verification";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockResolvedValue([]);
});

describe("sendVerificationEmail", () => {
  it("stores only the token hash and emails a link containing the raw token", async () => {
    await sendVerificationEmail({ id: 7, email: "a@b.co", name: "Ann" });

    const { data } = mocks.create.mock.calls[0][0];
    const { text, to } = mocks.sendEmail.mock.calls[0][0];
    const token = /token=([0-9a-f]+)/.exec(text)?.[1];

    expect(to).toBe("a@b.co");
    expect(token).toHaveLength(64);
    expect(data.tokenHash).toBe(sha256(token!));
    expect(data.tokenHash).not.toBe(token);
    expect(text).toContain("http://app.test/api/auth/verify?token=");
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("invalidates earlier links for the user", async () => {
    await sendVerificationEmail({ id: 7, email: "a@b.co", name: "Ann" });

    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
  });
});

describe("consumeVerificationToken", () => {
  it("returns null for an unknown token", async () => {
    mocks.findUnique.mockResolvedValue(null);

    expect(await consumeVerificationToken("nope")).toBeNull();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects and removes an expired token", async () => {
    mocks.findUnique.mockResolvedValue({
      id: 1,
      userId: 7,
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await consumeVerificationToken("old")).toBeNull();
    expect(mocks.tokenDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("looks the token up by hash, verifies the user and clears their tokens", async () => {
    mocks.findUnique.mockResolvedValue({
      id: 1,
      userId: 7,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await consumeVerificationToken("good")).toBe(7);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256("good") },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { emailVerified: expect.any(Date) },
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
  });
});
