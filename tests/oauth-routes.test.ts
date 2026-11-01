import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  createAuthorizationUrl: vi.fn(),
  fetchOAuthProfile: vi.fn(),
  findOrCreateOAuthUser: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  }),
}));
vi.mock("arctic", () => ({
  generateState: () => "state-1",
  generateCodeVerifier: () => "verifier-1",
}));
vi.mock("@/lib/session", () => ({ setSessionCookie: mocks.setSessionCookie }));
vi.mock("@/lib/oauth", () => ({
  isOAuthProvider: (value: string) => value === "google" || value === "github",
  createAuthorizationUrl: mocks.createAuthorizationUrl,
  fetchOAuthProfile: mocks.fetchOAuthProfile,
  findOrCreateOAuthUser: mocks.findOrCreateOAuthUser,
}));

import { GET as start } from "@/app/api/auth/oauth/[provider]/route";
import { GET as callback } from "@/app/api/auth/oauth/[provider]/callback/route";

const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) });
const callbackRequest = (query: string) =>
  new Request(`http://app.test/api/auth/oauth/google/callback?${query}`);

function storedCookies(state: string | undefined, verifier: string | undefined) {
  mocks.cookieGet.mockImplementation((name: string) => {
    const value = name.startsWith("oauth_state_") ? state : verifier;
    return value === undefined ? undefined : { value };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("OAuth start route", () => {
  it("rejects an unknown provider", async () => {
    await expect(start(new Request("http://app.test"), ctx("apple"))).rejects.toThrow(
      "REDIRECT:/authorization?error=oauth_unavailable"
    );
  });

  it("reports unavailable when credentials aren't configured", async () => {
    mocks.createAuthorizationUrl.mockReturnValue(null);

    await expect(start(new Request("http://app.test"), ctx("google"))).rejects.toThrow(
      "REDIRECT:/authorization?error=oauth_unavailable"
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("stores state and verifier in httpOnly cookies and redirects to the provider", async () => {
    mocks.createAuthorizationUrl.mockReturnValue(new URL("https://accounts.google.com/auth"));

    await expect(start(new Request("http://app.test"), ctx("google"))).rejects.toThrow(
      "REDIRECT:https://accounts.google.com/auth"
    );
    expect(mocks.createAuthorizationUrl).toHaveBeenCalledWith("google", "state-1", "verifier-1");
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "oauth_state_google",
      "state-1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 600 })
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "oauth_verifier_google",
      "verifier-1",
      expect.objectContaining({ httpOnly: true })
    );
  });
});

describe("OAuth callback route", () => {
  const failed = "REDIRECT:/authorization?error=oauth_failed";

  it("rejects an unknown provider", async () => {
    await expect(callback(callbackRequest("code=c&state=s"), ctx("apple"))).rejects.toThrow(
      "REDIRECT:/authorization?error=oauth_unavailable"
    );
  });

  it.each([
    ["a state that doesn't match the cookie", "code=c&state=other", "state-1", "v"],
    ["a missing code", "state=state-1", "state-1", "v"],
    ["a missing state cookie", "code=c&state=state-1", undefined, "v"],
    ["a missing verifier cookie", "code=c&state=state-1", "state-1", undefined],
  ])("fails on %s and never calls the provider", async (_name, query, state, verifier) => {
    storedCookies(state, verifier);

    await expect(callback(callbackRequest(query), ctx("google"))).rejects.toThrow(failed);
    expect(mocks.fetchOAuthProfile).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("clears the one-time cookies on every attempt", async () => {
    storedCookies("state-1", "v");

    await expect(callback(callbackRequest("code=c&state=bad"), ctx("google"))).rejects.toThrow(failed);
    expect(mocks.cookieDelete).toHaveBeenCalledWith("oauth_state_google");
    expect(mocks.cookieDelete).toHaveBeenCalledWith("oauth_verifier_google");
  });

  it("fails when the provider exchange throws", async () => {
    storedCookies("state-1", "v");
    mocks.fetchOAuthProfile.mockRejectedValue(new Error("bad code"));

    await expect(callback(callbackRequest("code=c&state=state-1"), ctx("google"))).rejects.toThrow(failed);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("reports unavailable when the provider isn't configured", async () => {
    storedCookies("state-1", "v");
    mocks.fetchOAuthProfile.mockResolvedValue(null);

    await expect(callback(callbackRequest("code=c&state=state-1"), ctx("google"))).rejects.toThrow(
      "REDIRECT:/authorization?error=oauth_unavailable"
    );
  });

  it("reports an unverified provider email without signing in", async () => {
    storedCookies("state-1", "v");
    mocks.fetchOAuthProfile.mockResolvedValue({ providerAccountId: "1" });
    mocks.findOrCreateOAuthUser.mockResolvedValue(null);

    await expect(callback(callbackRequest("code=c&state=state-1"), ctx("google"))).rejects.toThrow(
      "REDIRECT:/authorization?error=oauth_email_unverified"
    );
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("signs the user in on success", async () => {
    storedCookies("state-1", "verifier-1");
    mocks.fetchOAuthProfile.mockResolvedValue({ providerAccountId: "1" });
    mocks.findOrCreateOAuthUser.mockResolvedValue(9);

    await expect(callback(callbackRequest("code=c&state=state-1"), ctx("google"))).rejects.toThrow(
      "REDIRECT:/platform"
    );
    expect(mocks.fetchOAuthProfile).toHaveBeenCalledWith("google", "c", "verifier-1");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(9);
  });
});
