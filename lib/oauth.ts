import { GitHub, Google, decodeIdToken, type OAuth2Tokens } from "arctic";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

export const OAUTH_PROVIDERS = ["google", "github"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const isOAuthProvider = (value: string): value is OAuthProvider =>
  (OAUTH_PROVIDERS as readonly string[]).includes(value);

export type OAuthProfile = {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

const redirectUri = (provider: OAuthProvider) =>
  `${getEnv().APP_URL}/api/auth/oauth/${provider}/callback`;

// Null when the provider's credentials aren't configured.
function getClient(provider: OAuthProvider) {
  const env = getEnv();

  if (provider === "google") {
    return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri(provider))
      : null;
  }

  return env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? new GitHub(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, redirectUri(provider))
    : null;
}

export function createAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  codeVerifier: string
) {
  const client = getClient(provider);

  if (!client) {
    return null;
  }

  return client instanceof Google
    ? client.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"])
    : client.createAuthorizationURL(state, ["user:email"]);
}

// Exchanges the callback code for the user's profile. Returns null when the
// provider isn't configured; throws if the provider rejects the exchange.
export async function fetchOAuthProfile(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string
): Promise<OAuthProfile | null> {
  const client = getClient(provider);

  if (!client) {
    return null;
  }

  return client instanceof Google
    ? googleProfile(await client.validateAuthorizationCode(code, codeVerifier))
    : githubProfile(await client.validateAuthorizationCode(code));
}

function googleProfile(tokens: OAuth2Tokens): OAuthProfile {
  const claims = decodeIdToken(tokens.idToken()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  const email = (claims.email ?? "").toLowerCase();

  return {
    providerAccountId: claims.sub,
    email,
    emailVerified: claims.email_verified === true,
    name: claims.name || email.split("@")[0],
  };
}

async function githubProfile(tokens: OAuth2Tokens): Promise<OAuthProfile> {
  const headers = {
    Authorization: `Bearer ${tokens.accessToken()}`,
    Accept: "application/vnd.github+json",
  };
  const [userResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);

  if (!userResponse.ok || !emailsResponse.ok) {
    throw new Error("GitHub profile request failed.");
  }

  const user = (await userResponse.json()) as {
    id: number;
    login: string;
    name: string | null;
  };
  const emails = (await emailsResponse.json()) as {
    email: string;
    primary: boolean;
    verified: boolean;
  }[];
  // Only the primary address counts, and only if GitHub verified it.
  const primary = emails.find((entry) => entry.primary);

  return {
    providerAccountId: String(user.id),
    email: (primary?.email ?? "").toLowerCase(),
    emailVerified: primary?.verified === true,
    name: user.name || user.login,
  };
}

// Resolves the profile to a local user id: an existing link, else an account
// with the same (provider-verified) email, else a new account. Null when the
// provider gives no verified email to match on.
export async function findOrCreateOAuthUser(provider: OAuthProvider, profile: OAuthProfile) {
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId },
    },
    select: { userId: true },
  });

  if (linked) {
    return linked.userId;
  }

  if (!profile.email || !profile.emailVerified) {
    return null;
  }

  const link = { provider, providerAccountId: profile.providerAccountId };
  const existing = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, emailVerified: true },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.oAuthAccount.create({ data: { userId: existing.id, ...link } }),
      prisma.user.update({
        where: { id: existing.id },
        data: {
          emailVerified: existing.emailVerified ?? new Date(),
          // An unverified password account may have been registered by
          // someone else using this address; drop their password on takeover.
          ...(existing.emailVerified ? {} : { passwordHash: null }),
        },
      }),
    ]);

    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      emailVerified: new Date(),
      oauthAccounts: { create: link },
    },
    select: { id: true },
  });

  return created.id;
}
