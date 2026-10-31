import { redirect } from "next/navigation";
import { consumeVerificationToken } from "@/lib/email-verification";
import { setSessionCookie } from "@/lib/session";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const userId = token ? await consumeVerificationToken(token) : null;

  if (userId === null) {
    redirect("/authorization?error=verify_invalid");
  }

  await setSessionCookie(userId);

  redirect("/platform");
}
