# ddal-svelte

A SvelteKit 5 application for managing D&D Adventurers League campaigns, with local development powered by Supabase and modern Svelte tooling.

## Prerequisites

- **Node.js** v22 or later
- **Bun** v1.2.19+ (recommended), or [pnpm](https://pnpm.io/) / [npm](https://www.npmjs.com/)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local database)
- [Docker](https://www.docker.com/) (optional, for running Supabase locally)

## Setup

1. **Clone the repository:**

```bash
git clone <your-repo-url>
cd ddal-svelte
```

2. **Copy and configure your environment variables:**

```bash
cp .env.example.local .env.local
cp .env.example.development.local .env.development.local
cp .env.example.production.local .env.production.local
# Edit .env to match your local setup (database credentials, API keys, etc.)
```

> The `.env` file is required for local development. See `.env.example` for required variables.

3. **Install dependencies:**

```bash
pnpm install
bun install
npm install
```

## Running Supabase Locally

By default, the dev script will start Supabase and the SvelteKit dev server.

- **With Supabase CLI (recommended):**

```bash
supabase start
```

This will spin up the local database and Supabase services using Docker.

- **With Docker Compose (alternative):**
  If you want to run Supabase manually, follow the [Supabase Docker quickstart](https://supabase.com/docs/guides/self-hosting/docker) and ensure your `.env` and `supabase/config.toml` are configured.

## Development

Start the local dev server (and Supabase):

```bash
pnpm dev
# or
bun run dev
# or
npm run dev
```

- The app will be available at [http://localhost:5173](http://localhost:5173) (or as configured by Vite).
- Supabase Studio will be available at [http://localhost:54323](http://localhost:54323) by default.

## Building for Production

To create a production build:

```bash
pnpm build
# or
bun run build
# or
npm run build
```

Preview the production build:

```bash
pnpm preview
# or
bun run preview
# or
npm run preview
```

## End-to-end tests

Playwright signs up a disposable passkey user (`e2e-<timestamp>`), walks through characters, logs, magic items, and DMs, then deletes the account. Each run uses the local database only. It does not reset the database and it never reads `REMOTE_DB_URL`.

### Safeguards

The suite stops before it creates anything unless all of these are true:

- `E2E_ALLOW_LOCAL=1` (or `true`)
- `PUBLIC_URL` is `http://localhost`, `http://127.0.0.1`, or another local host
- `DATABASE_URL` uses that same kind of host (local Supabase is `127.0.0.1:54322`)
- `DATABASE_URL` is not the same string as `REMOTE_DB_URL`

Staging is rejected because it shares production's database. A local `op run` environment also sets `REMOTE_DB_URL`; that is fine as long as `DATABASE_URL` is the local database and the two strings differ. A global setup step and `pnpm op:test:e2e:cleanup` delete leftover `e2e-` users, their rows, and their stored images if a run crashes. Account deletion removes permanent avatars and portraits immediately. Unsaved `tmp/` uploads are left for the bucket lifecycle rule (about a day); the cleanup script still deletes those objects for `e2e-` users so a crashed run does not leave files in the test bucket.

### Setup

1. Start local Supabase and apply migrations:

```bash
supabase start
pnpm db:push:local
```

2. Local runs take `DATABASE_URL`, `PUBLIC_URL`, `REMOTE_DB_URL`, and the `R2_*` variables from the same 1Password environment as `pnpm op:dev`. `DATABASE_URL` must be the local Supabase database. The image bucket must allow `PUT` from `http://localhost:5173`.

3. Install browsers once:

```bash
pnpm exec playwright install chromium
```

### Run

```bash
pnpm op:test:e2e
```

`pnpm op:test:e2e` sets `E2E_ALLOW_LOCAL=1`, loads that 1Password environment, and starts the Vite dev server with the same variables when one is not already running. Set `E2E_SKIP_WEBSERVER=1` to use a server you started yourself with `pnpm op:dev`. The app origin has to match `PUBLIC_URL` so the virtual passkey is issued for the local relying party.

Clean up users left behind by a crashed run:

```bash
pnpm op:test:e2e:cleanup
```

`pnpm test:e2e` and `pnpm test:e2e:cleanup` stay available for CI, where the variables are already exported. `pnpm test:e2e:guard` checks the environment guard without touching the database.

A manual GitHub Actions workflow (`.github/workflows/e2e.yml`, `workflow_dispatch` only) can run the same suite with local Supabase. It does not run on pull requests. Image uploads need the `E2E_R2_*` repository secrets.

## Linting & Formatting

```bash
pnpm lint
pnpm format
```

## Notes

- The project uses [Drizzle ORM](https://orm.drizzle.team/) for database access.
- See `supabase/` for database schema and migrations.
- For more details, check the scripts in `package.json`.
