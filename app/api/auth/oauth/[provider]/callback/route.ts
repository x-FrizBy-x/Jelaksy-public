import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/session";
import { fetchOAuthProfile, findOrCreateOAuthUser, isOAuthProvider } from "@/lib/oauth";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;

  if (!isOAuthProvider(provider)) {
    redirect("/authorization?error=oauth_unavailable");
  }

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get(`oauth_state_${provider}`)?.value;
  const codeVerifier = cookieStore.get(`oauth_verifier_${provider}`)?.value;

  cookieStore.delete(`oauth_state_${provider}`);
  cookieStore.delete(`oauth_verifier_${provider}`);

  if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
    redirect("/authorization?error=oauth_failed");
  }

  let userId: number | null = null;
  let failed = false;
  let unavailable = false;

  try {
    const profile = await fetchOAuthProfile(provider, code, codeVerifier);

    if (profile) {
      userId = await findOrCreateOAuthUser(provider, profile);
    } else {
      unavailable = true;
    }
  } catch (error) {
    console.error(`OAuth callback failed for ${provider}`, error);
    failed = true;
  }

  // redirect() throws, so it stays outside the try block.
  if (failed) {
    redirect("/authorization?error=oauth_failed");
  }

  if (unavailable) {
    redirect("/authorization?error=oauth_unavailable");
  }

  if (userId === null) {
    redirect("/authorization?error=oauth_email_unverified");
  }

  await setSessionCookie(userId);

  redirect("/platform");
}
