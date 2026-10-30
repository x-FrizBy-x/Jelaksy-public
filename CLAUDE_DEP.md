# Open issues and what Claude needs

State as of PR #3 (`fix/review-5-7-8`). REVIEW.md items #1–#10 are done, except the `@tailwindcss/vite` and `emailVerified` parts of #10 (see below).

## Done since the last update
- **#6 Lost updates:** `Project.version` column. `PATCH .../tasks` and the chat route write only if `version` is unchanged, bump it, and retry up to 3 times (tasks returns 409 if it still conflicts).
- **#9 Tests:** Vitest 4 (`npm test`). Covers `normalizeRoadmapTaskProgress`, `setTaskCompleted`, `mergeGeneratedRoadmap`, and the tasks route (401, 404 for another user's project, 400, version check, retry/409). Vitest 5 conflicts with `@types/node` 20, hence v4.
- **#10 (partly):** `UserPlan` is `Basic/Pro/Ultra` only. Migrations were tried (baseline `0_init`) and then deleted on purpose while the schema is still changing; the workflow is `db push` again. `prisma7.config.ts` renamed to `prisma.config.ts`. `dotenv` added to `package.json`. Revisit `prisma migrate` once the schema settles.

## Unresolved issues

### From REVIEW.md #10
- **`@tailwindcss/vite`** is still installed in a Next.js project. Not removed (not requested).
- **`emailVerified`** on `User` is still unused. Not removed (not requested; schema change).

### Found during this work
- **Nothing has been run live.** Only `tsc`, `eslint` and the Vitest suite (mocked Prisma) have run. Not exercised against a real DB: `PATCH /api/projects/[id]/tasks`, the chat route's version-checked write, the trimmed project list, the cached `getCurrentUser`, and the lazy Prisma client.
- **Existing databases.** `db push` on a DB with `User` rows on plan Small/Medium/Large will fail or ask to reset when the enum shrinks. `Project.version` is added by `db push`.
- **No chat route test.** Only the tasks route has route tests.
- **Behavior change.** `PATCH /api/projects/[id]` returns 400 if sent `taskCompletion`. Only `ProjectChat.tsx` used it, and it is updated.
- **PR #3 description is stale.** It says `tsc` reports a `LayoutProps` error (that was a missing `.next/types`; `npx next typegen` fixes it). It also doesn't mention `version`, the migration baseline, or Vitest.
- **`npm audit`** reports 11 vulnerabilities (1 moderate, 9 high, 1 critical). Not investigated. `npm audit fix --force` could change versions, so review first.
- **Blocked install scripts.** npm blocked install scripts for `prisma`, `@prisma/engines` and `unrs-resolver`. `prisma generate` worked anyway. If `prisma db push` fails, check this first (`npm install-scripts ls`).
- **Ownership checks are manual.** There is no middleware, so every route and page must filter by `ownerId`. `app/platform/projects/[id]/page.tsx` does its own `findFirst` instead of `getOwnedProject`.

## Dependencies Claude needs to continue

### To run the app and test routes live
1. **`.env` in the worktree** (copy from `.env.example`; gitignored):
   - `DATABASE_URL`: a dedicated, disposable dev PostgreSQL database. Never production.
   - `SESSION_SECRET`: a long random string.
   - `OPENAI_API_KEY`: optional. Only needed to test the chat route, which spends tokens. `OPENAI_MODEL` and `OPENAI_BASE_URL` are optional too.
2. **Approval to run `npx prisma db push`** against that empty database (no migration files exist).
3. **Approval to run `npm run dev`** in the background and `curl` against `localhost:3000`.
4. Optional: the built-in browser or Chrome extension enabled, to click through the task checkboxes in the UI.
5. Optional: allow `npm run dev`, `npx prisma db push` and `curl localhost:3000/*` in `.claude/settings.json` to avoid repeated prompts.

### Per task
- **Remove `@tailwindcss/vite` / `emailVerified`:** say so and I'll do it (schema change, applied with `db push`).
- **Chat route test:** no new approval needed.

### Fresh checkout setup (gitignored build output)
1. `npm install`
2. `npx prisma generate` (creates `app/generated/prisma`)
3. `npx next typegen`, or run `npm run dev` once (creates `.next/types`, which defines `LayoutProps`)
