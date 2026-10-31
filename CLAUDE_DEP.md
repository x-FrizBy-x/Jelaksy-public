# Open issues and what Claude needs

State as of PR #3 (`fix/review-5-7-8`), last updated 2026-10-31. REVIEW.md items #1–#10 are done, except the `@tailwindcss/vite` and `emailVerified` parts of #10 (see below).

## Done
- **#6 Lost updates:** `Project.version` column. `PATCH .../tasks` and the chat route write only if `version` is unchanged, bump it, and retry up to 3 times (tasks returns 409 if it still conflicts).
- **#9 Tests:** Vitest 4 (`npm test`, 28 tests). Covers roadmap logic, the tasks route, and the chat route (commit `5fbe6ba`). Vitest 5 conflicts with `@types/node` 20, hence v4.
- **#10 (partly):** `UserPlan` is `Basic/Pro/Ultra` only. Migrations were tried (baseline `0_init`) and then deleted on purpose while the schema is still changing; the workflow is `db push`. `prisma7.config.ts` renamed to `prisma.config.ts`. `dotenv` added. Revisit `prisma migrate` once the schema settles.
- **Chat usage on server errors (`5fbe6ba`):** `releaseChatUsage` in `lib/rate-limit.ts` is called in the chat route's 502 `catch`, so a failed model call no longer costs the user budget.
- **Live test against a real database (2026-10-30/31):** schema pushed to the Neon dev DB (`db push`), then tested with `curl` and two throwaway users with minted session cookies. All passed:
  - 401 without a cookie; create/list/get project; user B gets an empty list or 404 on A's project (projects, tasks and chat routes).
  - Tasks route: 400 bad body, 409 out-of-order, 409 out-of-range, complete/un-complete cascade, `version` +1 per write.
  - 8 parallel identical toggles: 6x 200, 2x 409, `version` +6 exactly (no lost updates).
  - Chat with Ollama `qwen3:8b`: 200 with a roadmap; checked-off tasks survived regeneration and a new task was added; `ChatUsage` settled to real token counts (2005, 2747), not the 4000 estimate.
  - Chat with Ollama stopped: 502 and no leftover `ChatUsage` row (the fix works live). Invalid message: 400, nothing reserved.
- All test data was deleted afterwards; the dev DB has 0 rows in `User`, `Project` and `ChatUsage`.

## Unresolved issues

### Decision needed
- **4xx and the usage limit.** The intent was that user mistakes (4xx) count toward the limit and server errors (5xx) don't. Today validation failures (400) and not-found/not-owned (404) are rejected *before* the reservation, so they cost nothing; only a 4xx after the model call (project deleted mid-call, 404) stays charged. To make bad requests count, move the reservation earlier or add a small charge on those paths. Trade-off: spamming invalid requests then burns the user's own budget. Not decided.

### From REVIEW.md #10
- **`@tailwindcss/vite`** is still installed in a Next.js project. Not removed (not requested).
- **`emailVerified`** on `User` is still unused. Not removed (not requested; schema change).

### Other
- **`maxDuration = 60`** on the chat route, but the local model took ~2 to 2.5 minutes per call. Fine in dev; a hosted deployment with a slow model could time out.
- **Behavior change.** `PATCH /api/projects/[id]` returns 400 if sent `taskCompletion`. Only `ProjectChat.tsx` used it, and it is updated.
- **PR #3 description is stale.** It says `tsc` reports a `LayoutProps` error (that was a missing `.next/types`; `npx next typegen` fixes it). It doesn't mention `version`, the usage release, or Vitest.
- **UI not exercised.** Only the API was tested with `curl`; the task checkboxes and chat UI have not been clicked through in a browser. Server actions (register/login) were bypassed with minted cookies, so they are untested live too.
- **`npm audit`** reports 11 vulnerabilities (1 moderate, 9 high, 1 critical). Not investigated. `npm audit fix --force` could change versions, so review first.
- **Blocked install scripts.** npm blocked install scripts for `prisma`, `@prisma/engines` and `unrs-resolver`. `prisma generate` and `db push` worked anyway. If `db push` fails, check this first (`npm install-scripts ls`).
- **Ownership checks are manual.** There is no middleware, so every route and page must filter by `ownerId`. `app/platform/projects/[id]/page.tsx` does its own `findFirst` instead of `getOwnedProject`.

## Environment
- **`.env`** (worktree, gitignored): `DATABASE_URL` (Neon `neondb`, pooled; the owner said its data is expendable but it is still their real account DB, so treat with care) and `SESSION_SECRET`. The Neon password was printed once in a session transcript on 2026-10-30; rotating it is advisable.
- **`.env.local`** (worktree, gitignored): `OPENAI_API_KEY`, `OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_MODEL=qwen3:8b`. Next loads it at runtime; the Prisma CLI reads only `.env`.
- **Ollama** is installed at `%LOCALAPPDATA%\Programs\Ollama\ollama.exe` with `qwen3:8b` and `llama3.1:latest` pulled. It is not a service here: start it with `ollama serve` before testing chat. Currently stopped.
- **`prisma db push`** needs explicit user consent each time (Prisma blocks it when run by an AI agent): rerun with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` set to the user's exact consenting message.
- The dev server is stopped and port 3000 is free. If one is left behind, find it with `Get-NetTCPConnection -LocalPort 3000`.

## How to repeat the live test
1. Start Ollama; `npm run dev` in the background.
2. Insert two users with SQL (`INSERT INTO "User" (email, name, "passwordHash", "updatedAt") ...`, e.g. via `npx prisma db execute --file`), read their ids, and sign a JWT `{ userId }` with `jose` (HS256, `SESSION_SECRET`, 3d). Send it as `Cookie: session=<jwt>`.
3. `curl` the routes; delete the test users (and their projects/usage rows) afterwards and stop the server.

## Suggested next steps
1. Decide the 4xx usage question above.
2. Update the PR #3 description.
3. Click through the UI (built-in browser or Chrome extension) including register/login.
4. Investigate `npm audit`.
5. Optional: remove `@tailwindcss/vite` / `emailVerified`; use `getOwnedProject` in the project page.

## Fresh checkout setup (gitignored build output)
1. `npm install`
2. `npx prisma generate` (creates `app/generated/prisma`)
3. `npx next typegen`, or run `npm run dev` once (creates `.next/types`, which defines `LayoutProps`)
