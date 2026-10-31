import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { generateCodeVerifier, generateState } from "arctic";
import { createAuthorizationUrl, isOAuthProvider } from "@/lib/oauth";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;

  if (!isOAuthProvider(provider)) {
    redirect("/authorization?error=oauth_unavailable");
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = createAuthorizationUrl(provider, state, codeVerifier);

  if (!url) {
    redirect("/authorization?error=oauth_unavailable");
  }

  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };

  cookieStore.set(`oauth_state_${provider}`, state, options);
  cookieStore.set(`oauth_verifier_${provider}`, codeVerifier, options);

  redirect(url.toString());
}
