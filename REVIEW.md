# Code Review

Findings sorted by impact. Client components (`ProjectChat.tsx`, `ProjectsDashboard.tsx`) and page files were not reviewed.

Suggested order: #1, then #2 and #3, then extract pure logic (#5) and add tests (#9), since #4 and #6 depend on them.

- [x] **1. Unauthenticated `/api/users` leaks and writes credentials** — High, ~10 min
  - Where: `app/api/users/route.ts`
  - Problem: `GET` returns every user row (including `passwordHash` and email) to anyone. `POST` creates a user from raw JSON with no auth or validation and stores `body.password` unhashed in `passwordHash`.
  - Why it matters: anyone can dump all accounts or create rows with plaintext passwords (which also can't log in, since `bcrypt.compare` fails).
  - Fix: delete the file (registration already uses the server action). If an endpoint is needed, require auth and use `select` to omit `passwordHash`.

- [x] **2. AI endpoint has no cost or abuse limits** — High, ~2–3 hrs
  - Where: `app/api/projects/[id]/chat/route.ts`, `lib/project-planning.ts`, `app/api/projects/route.ts`
  - Problem: no per-user rate limit; `ProjectChatMessageSchema.content` is an unbounded `z.string()` (only the single `message` is capped); project `name`/`description` have no max length and the description is injected into the system prompt on every call; history comes from the client so assistant turns can be forged; no `maxDuration`.
  - Why it matters: a signed-in user can run up large token bills with big payloads or request loops.
  - Fix:
    - [x] Cap lengths in Zod (`content`, `name`, `description`)
    - [x] Rate-limit the route per user (Postgres counter, Upstash, etc.) — done: 200k tokens per rolling 6h per user (reserve-then-settle in `ChatUsage`), `lib/rate-limit.ts`
    - [x] Load history from `project.chatMessages` instead of trusting the client
    - [x] Export `maxDuration`

- [x] **3. Auth action errors and edge cases** — Medium, ~2 hrs
  - Where: `app/authorization/actions.ts`
  - Problem: errors are surfaced with `throw new Error(...)` in server actions, which Next.js masks in production (users see a generic failure). Register checks for an existing user before validating fields, and concurrent signups with the same email can hit an unhandled unique-constraint error. No minimum password length or email format check. Login is faster for unknown emails than for wrong passwords (email enumeration). No login throttling.
  - Fix:
    - [x] Return `{ error }` results via `useActionState` instead of throwing — `AuthForm.tsx` client component
    - [x] Validate with Zod first (email format, 8–72 char password); catch Prisma `P2002`
    - [x] Run a dummy `bcrypt.compare` when the user isn't found
    - [x] Add basic login throttling — 5 failures/15 min per email, 20 per IP, `LoginAttempt` table, `lib/login-throttle.ts`

- [x] **4. Progress is lost whenever the AI rewords a task** — Medium, ~half a day
  - Where: chat route merge logic, `lib/project-planning.ts`
  - Problem: the model regenerates the whole roadmap each turn; progress is restored by exact phase title and exact task text, so any rewording resets checkboxes. `completed: existingPhase?.completed ?? false` is redundant because `normalizeRoadmapTaskProgress` recomputes it.
  - Why it matters: users lose checked-off work while refining the plan, the app's main flow.
  - Fix: give phases and tasks stable IDs, pass the existing roadmap and IDs to the model and ask it to preserve IDs for unchanged items (or have it return edits instead of a full rewrite).

- [ ] **5. `PATCH` handler is a 200-line, hard-to-follow function** — Medium, ~3 hrs
  - Where: `app/api/projects/[id]/route.ts`
  - Problem: one handler covers task toggles, rename/description edits, and shared auth/ownership steps. The toggle block re-implements the "previous tasks must be complete" rule with counters and nested ternaries, duplicating `normalizeRoadmapTaskProgress`. The 401 block and `findFirst` ownership check repeat in every handler; cookie options are copy-pasted between register and login.
  - Why it matters: progress-rule changes must be made in two places, and each new route copies more boilerplate.
  - Fix:
    - [ ] Extract a pure `setTaskCompleted(roadmap, phaseIndex, taskIndex, completed)` into `lib/project-planning.ts`
    - [ ] Add `requireUser()` and `getOwnedProject(id, userId)` helpers
    - [ ] Add `setSessionCookie()` for the shared cookie options
    - [ ] Split task toggling into its own route (e.g. `PATCH .../tasks`)

- [ ] **6. Lost updates from read-modify-write on JSON columns** — Medium, ~2 hrs
  - Where: PATCH task-toggle path and the chat route
  - Problem: both read the roadmap, modify it in memory, and write the whole JSON back. Two quick checkbox clicks, or a click during a slow AI call, can overwrite each other.
  - Fix: optimistic concurrency with a `version` column (update fails on conflict), or a transaction with `SELECT ... FOR UPDATE`.

- [ ] **7. List endpoint over-fetches; every request re-queries the user** — Medium, ~1 hr
  - Where: `app/api/projects/route.ts` GET, `lib/session.ts`
  - Problem: the list returns full rows including `roadmap` and `chatMessages` JSON for every project. `getCurrentUser()` runs `findUnique` (loading `passwordHash`) on every call, from both pages and API routes.
  - Fix:
    - [ ] `select` only the fields the list needs; fetch details per project
    - [ ] Add `select` to `getCurrentUser` and wrap it in React `cache()`

- [ ] **8. `SESSION_SECRET` checked at import time; `DATABASE_URL` never checked** — Low–Medium, ~30 min
  - Where: `lib/session.ts`, `lib/prisma.ts`
  - Problem: `session.ts` throws on import if the secret is missing, which can break `next build` in CI without secrets and surfaces in unrelated places. `prisma.ts` uses `DATABASE_URL!` with no check.
  - Fix: validate env lazily in one `lib/env.ts` with Zod and a clear message.

- [ ] **9. No tests for the logic that matters** — Medium, ~half a day
  - Where: none exist
  - Missing:
    - [ ] Unit tests for `normalizeRoadmapTaskProgress` and the toggle/uncheck cascade
    - [ ] Tests for the chat route's progress-restoration merge (LLM mocked)
    - [ ] Tests that routes return 401/404 for other users' projects
  - Fix: add Vitest; start with the pure functions in `lib/project-planning.ts` after the extraction in #5. This also makes #4 safe to change.

- [ ] **10. Schema and tooling inconsistencies** — Low, ~1 hr
  - Where: `prisma/schema.prisma`, `prisma7.config.ts`, `package.json`
  - Problem: `UserPlan` mixes two naming schemes (`Basic/Pro/Ultra` and `Small/Medium/Large`); `emailVerified` is unused; no migrations (only `db push`); the Prisma config isn't named `prisma.config.ts` so Prisma may not load it, and the `dotenv` it imports isn't in `package.json`; `@tailwindcss/vite` is installed in a Next.js project.
  - Fix:
    - [ ] Decide on plan names
    - [ ] Rename the config file and add `dotenv`
    - [ ] Move to `prisma migrate` before there is real user data
    - [ ] Remove unused dependencies
