# Jelaksy

Jelaksy is a project-planning app that turns a project idea into a practical roadmap. Users can create projects, collaborate with an AI planning assistant, and track completed roadmap phases.

## Features

- Account registration, sign-in, and persistent user sessions
- Project creation with a required description
- AI-assisted project roadmaps with phases and actionable tasks
- Per-project conversation history and saved roadmap completion state
- Project and deadline views

## Tech stack

- Next.js 16, React 19, and TypeScript
- PostgreSQL with Prisma ORM 7 and the Neon serverless driver
- LangChain's OpenAI-compatible chat integration
- Zod for request and AI response validation

## Requirements

- Node.js 20 or later and npm
- A PostgreSQL database reachable by the app (Neon is used by the Prisma adapter)
- An OpenAI API key, or an OpenAI-compatible model server such as Ollama

## Run locally

1. Clone the repository and install its dependencies:

   ```powershell
   git clone https://github.com/x-FrizBy-x/my-ai-app.git
   cd my-ai-app
   npm ci
   ```

2. Create your local environment file from the tracked template:

   ```powershell
   Copy-Item .env.example .env
   ```

   Fill in `DATABASE_URL`, `SESSION_SECRET`, and the AI settings described below. Use `.env` for local development because Prisma CLI loads it via `dotenv/config`; Next.js also reads it. `.env` and `.env.local` are intentionally excluded from Git because they may contain credentials.

3. Set up the database schema. For a **new, empty database**, run:

   ```powershell
   npx prisma db push
   ```

   This project currently has no checked-in Prisma migration files. `db push` applies the Prisma schema directly to the configured database. Do not point it at a database containing important data without first inspecting the schema changes and creating a backup.

4. Start the development server:

   ```powershell
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000).

## Environment variables

Use `.env` for local development. For a deployment, set these values in the hosting provider's server-side environment-variable settings.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret used to sign session tokens; use a long random value |
| `OPENAI_API_KEY` | For AI chat | OpenAI API key, or a non-empty placeholder for an Ollama OpenAI-compatible endpoint |
| `OPENAI_MODEL` | No | Model name; defaults to `gpt-4o-mini` |
| `OPENAI_BASE_URL` | No | OpenAI-compatible API base URL; leave unset for OpenAI |

Generate a session secret in PowerShell with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### OpenAI

```env
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
```

### Local Ollama

Install Ollama and download a tool-calling-capable model, for example:

```powershell
ollama pull qwen3:8b
```

Then use:

```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=qwen3:8b
```

The OpenAI-compatible client requires a non-empty API key, but Ollama ignores this placeholder. The Ollama service must be running and reachable from the Next.js server. In a deployed app, `localhost` means the deployment server, not your computer: use a securely hosted, network-accessible inference endpoint or keep the app local for the demo. Never expose Ollama or your database by opening them to the public internet without appropriate access controls.

Keep all secrets server-side. Do not prefix them with `NEXT_PUBLIC_`, commit real `.env` files, or paste credentials into issue trackers or screenshots.

## Database notes

The Prisma schema is in [`prisma/schema.prisma`](./prisma/schema.prisma). It defines users and projects; each project's roadmap and chat history are stored as JSON in PostgreSQL.

Prisma Client is generated automatically by `npm run dev` and `npm run build`. For a fresh database, create the schema with `npx prisma db push` before using the app. For ongoing production schema changes, add and review proper migrations rather than relying on an unreviewed schema push.

## Checks and production build

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

To run the production build locally:

```powershell
npm run start
```

## Deploying for an interview

The app can be deployed to a Node.js-compatible host such as Vercel. A deployment needs its **own** PostgreSQL database and server-side environment variables; GitHub does not store or transfer your local `.env.local` file.

1. Create a PostgreSQL database for the deployment and add its connection string as `DATABASE_URL` in the host's project settings.
2. Set a newly generated `SESSION_SECRET` and the AI variables in those settings. For OpenAI, add `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. A local Ollama URL such as `http://localhost:11434/v1` will not work from Vercel.
3. Initialize the empty deployment database from your machine using the deployment database URL, or use a reviewed migration workflow. Since this repository currently has no migration files, `npx prisma db push` can initialize an **empty** database. In PowerShell, you can set the deployment URL for only that command:

   ```powershell
   $env:DATABASE_URL = "your-deployment-database-url"
   npx prisma db push
   Remove-Item Env:DATABASE_URL
   ```

   Take care not to point it at a database with data you need to preserve.
4. Push the source code to GitHub and import the repository into the hosting provider. Add the environment variables in the provider before deploying; the existing build script generates Prisma Client.
5. Open the deployed URL, create a test account, and verify sign-in, project creation, roadmap generation, phase completion, and reload persistence.

Do not commit `.env.local` or production secrets to make a hosted deployment work. Configure the secrets in the hosting dashboard. If an environment file was ever committed, removing it in a later commit is not enough: rotate the exposed credentials.

## Presenting Jelaksy

For a short interview demo:

1. Start with the user problem: turning an idea into organized, actionable project steps.
2. Create a project with a meaningful description and show that it becomes a phased roadmap.
3. Ask the assistant to refine a phase, then mark a phase complete and refresh to show persistence.
4. Briefly explain the design: the browser calls authenticated Next.js API routes; the server validates requests, scopes project access to the signed-in user, calls the configured model, and persists roadmaps and conversation in PostgreSQL.
5. Be transparent about the current deployment requirement: the app needs a reachable database and server-side AI configuration. Explain whether your demo uses OpenAI or a hosted Ollama endpoint.

Keep a safe demo account and sample project ready, but do not include real credentials or personal data in the repository.
