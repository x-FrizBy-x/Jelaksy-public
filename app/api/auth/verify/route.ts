import { redirect } from "next/navigation";

// Kept for links in emails sent before verification moved to a confirmation
// page. It must not consume the token: mail scanners and link prefetchers
// issue GETs, and only the POST on /authorization/verify may use it up.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  redirect(
    token
      ? `/authorization/verify?token=${encodeURIComponent(token)}`
      : "/authorization?error=verify_invalid"
  );
}
