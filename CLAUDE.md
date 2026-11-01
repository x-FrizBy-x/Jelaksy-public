# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```powershell
npm run dev          # prisma generate && next dev (http://localhost:3000)
npm run build        # prisma generate && next build
npm run start        # serve the production build
npm run lint         # eslint
npx tsc --noEmit     # type check (no separate script)
npx prisma db push   # init schema on an EMPTY database; there are no migration files
npm test             # vitest run (tests/)
```

Tests live in `tests/` (Vitest; route tests mock `@/lib/prisma` and `@/lib/session`). The Prisma client is generated into `app/generated/prisma` (import from `@/app/generated/prisma/client`), so run `npx prisma generate` after editing `prisma/schema.prisma`. Prisma CLI reads `DATABASE_URL` from `.env` (not `.env.local`) via `dotenv/config`; the config file is `prisma.config.ts`. Setup details and env vars (`DATABASE_URL`, `SESSION_SECRET`, `OPENAI_API_KEY`, optional `OPENAI_MODEL`/`OPENAI_BASE_URL`) are in `README.md`.

Next.js is v16 with breaking changes — see `AGENTS.md` and read `node_modules/next/dist/docs/` before writing Next-specific code (e.g. `params` is a `Promise` in route handlers).

## Architecture

"Jelaksy": a project-planning app. Users create projects with a description, then chat with an AI assistant that returns a phased roadmap which the user checks off.

- **Auth** (`lib/session.ts`, `app/authorization/`): custom JWT (`jose`, HS256, 3-day) stored in a `session` cookie; passwords hashed with `bcryptjs`. Register/login/resend are server actions in `app/authorization/actions.ts`. Registering creates the account and emails a verification link (`lib/email-verification.ts`, `lib/email.ts` via Resend; with no `RESEND_API_KEY` the link is logged to the server console) but sets no session; the link opens a confirmation page (`/authorization/verify`) whose POST (`confirmEmailVerification`) consumes the single-use token (`GET /api/auth/verify` only redirects there) (SHA-256 stored in `EmailVerificationToken`), sets `User.emailVerified` and signs in. Password login redirects unverified users to `/authorization/check-email`, and `getCurrentUser()` returns null for unverified users. Google/GitHub sign-in uses `arctic` (`lib/oauth.ts`, routes under `app/api/auth/oauth/[provider]`): state/PKCE in short-lived cookies, accounts stored in `OAuthAccount`, linked to an existing user only by a provider-verified email (linking to an unverified password account clears its password). `User.passwordHash` is nullable for OAuth-only users. There is no middleware/proxy — every page and API route must call `getCurrentUser()` itself and scope queries by `ownerId`. `lib/session.ts` throws at import time if `SESSION_SECRET` is unset.
- **Data** (`prisma/schema.prisma`, `lib/prisma.ts`): PostgreSQL via Prisma 7 with the `PrismaNeon` driver adapter. Models: `User`, `Project`, `ChatUsage`, `OAuthAccount`, `EmailVerificationToken`, `LoginAttempt`; a project's `roadmap` and `chatMessages` are untyped `Json` columns, so their shape is enforced only by Zod on read/write.
- **Roadmap domain** (`lib/project-planning.ts`): Zod schemas for roadmaps, phases and chat messages, plus progress helpers. Task completion is sequential: `normalizeRoadmapTaskProgress` un-completes any task after an incomplete one, and a phase's `completed` flag is derived from its tasks (legacy phase-level `completed` is still honored as a fallback).
- **AI chat** (`app/api/projects/[id]/chat/route.ts`): LangChain `ChatOpenAI(...).withStructuredOutput(ProjectChatResponseSchema)` returning `{ reply, roadmap }`; the system prompt is built inline from the project name/description. Works with any OpenAI-compatible endpoint (e.g. Ollama) through `OPENAI_BASE_URL`. The model regenerates the full roadmap each turn; the route then restores completion state by matching phase title and task text against the saved roadmap, so renamed phases/tasks lose their progress. History is loaded server-side from `project.chatMessages` (the client sends only `message`) and capped at the last 20. Each call first reserves an estimated token cost in `ChatUsage` (`lib/rate-limit.ts`: 200k tokens per rolling 6 hours, plus a 100-request backstop; 429 when exceeded), then replaces the estimate with the real `usage_metadata` total after the call (`includeRaw: true`); if the provider reports no usage, the estimate stands. Server-side failures (the 502 path) release the reservation via `releaseChatUsage`; 4xx outcomes after the reservation keep it charged. Length limits for project name/description/messages are constants in `lib/project-planning.ts`.
- **API routes** (`app/api/projects`, `app/api/projects/[id]`): JSON endpoints used by the client components; `[id]/route.ts` has GET/PATCH (roadmap progress updates)/DELETE.
- **UI**: `app/platform/` is the authenticated area — `ProjectsDashboard.tsx` (list) and `projects/[id]/` (`page.tsx` server component plus `ProjectChat.tsx` client component). Shared UI data/components live in `components/` (`constants.tsx`, `objects.tsx`); the marketing pages (`about`, `contact`, `partners`, `pricing`) sit at the top level of `app/`. Styling mixes Tailwind 4 with CSS modules.
- Path alias `@/*` maps to the repo root.
