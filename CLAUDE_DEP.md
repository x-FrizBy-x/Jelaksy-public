# Open issues and what Claude needs

State after the email verification + OAuth work (branch `feat/email-verification-oauth`, not yet merged), last updated 2026-10-31. REVIEW.md items #1–#10 are done except the `@tailwindcss/vite` part of #10. The `emailVerified` column is now used.

## Done
- **#6 Lost updates:** `Project.version` column. `PATCH .../tasks` and the chat route write only if `version` is unchanged, bump it, and retry up to 3 times (tasks returns 409 if it still conflicts).
- **#9 Tests:** Vitest 4 (`npm test`, 39 tests). Covers roadmap logic, the tasks and chat routes, verification tokens and OAuth account linking. Vitest 5 conflicts with `@types/node` 20, hence v4.
- **#10 (partly):** `UserPlan` is `Basic/Pro/Ultra` only. Migrations were tried (baseline `0_init`) and then deleted on purpose while the schema is still changing; the workflow is `db push`. `prisma7.config.ts` renamed to `prisma.config.ts`. `dotenv` added. Revisit `prisma migrate` once the schema settles.
- **Chat usage on server errors (`5fbe6ba`):** `releaseChatUsage` in `lib/rate-limit.ts` is called in the chat route's 502 `catch`, so a failed model call no longer costs the user budget.
- **Email verification (2026-10-31):**
  - Register creates the user and emails a 24-hour single-use link (`lib/email-verification.ts`; only the SHA-256 of the token is stored in `EmailVerificationToken`). No session is issued until the link is used.
  - `GET /api/auth/verify` sets `User.emailVerified` and signs the user in. `/authorization/check-email` shows "check your inbox" with a resend button (`resendVerification` action: 1-minute cooldown, throttled through `LoginAttempt` keys `resend:<email>`, same answer for every address).
  - Password login for an unverified user redirects to the check-inbox page. `getCurrentUser()` returns null for unverified users, so pages and API routes reject them (this also covers sessions issued before the feature).
  - Mail goes through Resend (`lib/email.ts`, plain `fetch`). With no `RESEND_API_KEY` the email is logged to the server console instead.
- **OAuth sign-in (2026-10-31):** Google and GitHub through `arctic` (`lib/oauth.ts`, `app/api/auth/oauth/[provider]` and `.../callback`). State and PKCE in 10-minute httpOnly cookies; accounts stored in `OAuthAccount`. A provider login links to an existing user only when the provider reports a verified email (GitHub: the primary address). Linking to a never-verified password account clears its password (prevents pre-registration takeover). New OAuth users are created verified with `passwordHash = null` (column is now nullable). Apple was removed (button, `components/constants.tsx` entry, `public/icons/apple.svg`).
- **Live test of the auth work (2026-10-31):**
  - With `curl`: both OAuth start routes redirect to the right provider with the right callback URL; a bad `state` and a bad or reused verify token redirect to an error; an unverified user's session gets a redirect from `/platform` and 401 from `/api/projects`.
  - In a browser by the owner: register, emailed link (console output and a real Resend email), resend, verify and landing on `/platform`; GitHub sign-in; Google sign-in. Both OAuth logins linked to the existing user instead of creating a duplicate, and the password was kept.
- **Earlier live test (2026-10-30/31)** against the Neon dev DB: projects, tasks and chat routes, ownership checks, version conflicts (8 parallel toggles, no lost updates), and Ollama chat usage settling to real token counts, plus no leftover reservation on a 502.

## Unresolved issues

### Before real users (production)
- **Resend sender.** `.env` uses `EMAIL_FROM="Jelaksy <onboarding@resend.dev>"`, which only delivers to the address the Resend account was created with. Verify a domain in Resend and change `EMAIL_FROM` to an address on it.
- **`APP_URL` and provider redirect URIs.** Set `APP_URL` to the production origin (no trailing slash). GitHub OAuth apps allow one callback URL, so create a separate production app; add the production redirect URI to the Google client too.
- **Google consent screen.** The app is in Testing mode (only listed test users can sign in, "unverified app" warning). Publishing to production needs a public domain, privacy-policy and terms pages; the logo only appears after Google's branding review.
- **Existing users.** After `db push`, any `User` row created before this feature has `emailVerified = null` and is locked out. The dev DB was empty before testing; if a database with real users ever gets this change, backfill deliberately (for example `UPDATE "User" SET "emailVerified" = now() WHERE "emailVerified" IS NULL`) only if those emails are trusted.

### Decision needed
- **4xx and the usage limit.** The intent was that user mistakes (4xx) count toward the limit and server errors (5xx) don't. Today validation failures (400) and not-found/not-owned (404) are rejected *before* the reservation, so they cost nothing; only a 4xx after the model call (project deleted mid-call, 404) stays charged. To make bad requests count, move the reservation earlier or add a small charge on those paths. Trade-off: spamming invalid requests then burns the user's own budget. Not decided.

### Auth follow-ups (known gaps)
- **Verify link is a GET with a side effect.** A mail scanner or link prefetcher that opens the link consumes the token, and the user then sees "invalid or expired". A confirmation page with a POST button would avoid that.
- **Registering an existing unverified email** says "An account with this email already exists." (same as before, and it reveals that the account exists). Better: resend the link for an unverified account instead of an error.
- **No password reset, no "set a password" for OAuth-only users, no way to unlink a provider.**
- **Server actions and OAuth routes have no automated tests.** Tests cover `lib/email-verification.ts` and `findOrCreateOAuthUser` with a mocked Prisma; `registerUser`, `loginUser`, `resendVerification` and the route handlers were only tested live.
- **`LoginAttempt` rows** are only purged on a successful login for that email (and the resend throttle writes to the same table), so they can accumulate. A periodic cleanup would help.

### From REVIEW.md #10
- **`@tailwindcss/vite`** is still installed in a Next.js project. Not removed (not requested).

### Other
- **`maxDuration = 60`** on the chat route, but the local model took ~2 to 2.5 minutes per call. Fine in dev; a hosted deployment with a slow model could time out.
- **Behavior change.** `PATCH /api/projects/[id]` returns 400 if sent `taskCompletion`. Only `ProjectChat.tsx` used it, and it is updated.
- **UI partly exercised.** The auth pages were clicked through by the owner. The project task checkboxes and the chat UI have still not been clicked through in a browser.
- **`npm audit`** reports vulnerabilities (11 as of the last check: 1 moderate, 9 high, 1 critical), not re-run after adding `arctic`. Not investigated. `npm audit fix --force` could change versions, so review first.
- **Blocked install scripts.** npm blocked install scripts for `prisma`, `@prisma/engines` and `unrs-resolver`. `prisma generate` and `db push` worked anyway. If `db push` fails, check this first (`npm install-scripts ls`).
- **Ownership checks are manual.** There is no middleware, so every route and page must filter by `ownerId`. `app/platform/projects/[id]/page.tsx` does its own `findFirst` instead of `getOwnedProject`.

## Environment
- **`.env`** (gitignored): `DATABASE_URL` (Neon `neondb`, pooled; the owner said its data is expendable but it is still their real account DB, so treat with care), `SESSION_SECRET`, `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `RESEND_API_KEY` (sending-only key) and `EMAIL_FROM`. `APP_URL` is unset and defaults to `http://localhost:3000`. The Neon password was printed once in a session transcript on 2026-10-30; rotating it is advisable.
- **`.env.local`** (gitignored): `OPENAI_API_KEY`, `OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_MODEL=qwen3:8b`. Next loads it at runtime; the Prisma CLI reads only `.env`.
- **Dev DB contents:** one user, the owner's own account created through the register form (verified, with a password, no OAuth links). Everything else was removed after testing.
- **Ollama** is installed at `%LOCALAPPDATA%\Programs\Ollama\ollama.exe` with `qwen3:8b` and `llama3.1:latest` pulled. It is not a service here: start it with `ollama serve` before testing chat.
- **`prisma db push`** needs explicit user consent each time (Prisma blocks it when run by an AI agent): rerun with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` set to the user's exact consenting message, or have the user run it with `!`.
- A dev server may still be running on port 3000. Find it with `Get-NetTCPConnection -LocalPort 3000`. Env files are read only at startup, so restart after editing `.env`.

## How to repeat the live tests
- **API routes:** insert users with SQL (`INSERT INTO "User" (email, name, "passwordHash", "emailVerified", "updatedAt") ...`, e.g. via `npx prisma db execute --file`; sessions need `emailVerified` set), read their ids, and sign a JWT `{ userId }` with `jose` (HS256, `SESSION_SECRET`). Send it as `Cookie: session=<jwt>`. Delete the test rows afterwards.
- **Verify route:** insert a user with `emailVerified` null plus an `EmailVerificationToken` whose `tokenHash` is the SHA-256 hex of a random token, then `curl "localhost:3000/api/auth/verify?token=<raw>"`.
- **Email:** with `RESEND_API_KEY` set, Resend's `delivered@resend.dev` address accepts a test send without mailing anyone. Without the key, the link is printed in the dev server output.

## Suggested next steps
1. Merge `feat/email-verification-oauth` (open a PR) and update or close the stale PR #3.
2. Rotate the Neon password (still advisable).
3. Fix the small auth gaps that affect real users: resend instead of "already exists" for unverified emails, and a POST confirmation page for the verify link.
4. Add tests for `registerUser`, `loginUser`, `resendVerification` and the OAuth route handlers.
5. Click through the task checkboxes and the chat UI in a browser.
6. Investigate `npm audit` and decide the 4xx usage question.
7. Production readiness: verified Resend domain, `APP_URL`, production OAuth apps, Google consent-screen publishing, and the existing-user backfill decision.
8. Optional: remove `@tailwindcss/vite`; use `getOwnedProject` in the project page; add password reset.

## Fresh checkout setup (gitignored build output)
1. `npm install`
2. `npx prisma generate` (creates `app/generated/prisma`)
3. `npx next typegen`, or run `npm run dev` once (creates `.next/types`, which defines `LayoutProps`)
