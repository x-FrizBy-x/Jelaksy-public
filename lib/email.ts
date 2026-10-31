import { getEnv } from "@/lib/env";

type Email = { to: string; subject: string; html: string; text: string };

// Sends through Resend's HTTP API. With no RESEND_API_KEY (local dev) the
// message is logged instead, so the verification flow works without an account.
export async function sendEmail({ to, subject, html, text }: Email) {
  const { RESEND_API_KEY, EMAIL_FROM } = getEnv();

  if (!RESEND_API_KEY) {
    console.log(`[email] To: ${to}\n[email] Subject: ${subject}\n${text}`);
    return;
  }

  if (!EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not set.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html, text }),
  });

  if (!response.ok) {
    throw new Error(`Resend responded ${response.status}: ${await response.text()}`);
  }
}
