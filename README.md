# ddal-svelte

A SvelteKit 5 application for managing D&D Adventurers League campaigns, with a plain Postgres database (the same image as production) and modern Svelte tooling.

## Features

- **Log drafts & sharing.** Drafts are rows in `log_draft`. Each one has a shareable `/draft/<uuid>` link, and the drafts you own are listed at `/drafts`. A DM can create a player draft and share it with the link or a QR code. A player can copy a log as a draft, or start a new log from a stored draft. A draft expires 14 days after its last edit (saving again keeps the same link and restarts the window). Drafts refuse new image uploads. Copying a log may keep note image links that were already saved on that log.
- **Images.** Character portraits, user avatars, and log note images are stored in Cloudflare R2 under the owning user. The browser uploads them under `tmp/` first, and saving promotes the object to a permanent key. Saved portraits and note images count against that owner's storage quota. Avatars, unsaved `tmp/` objects, and admin accounts do not.
- **Sign-in.** [better-auth](https://www.better-auth.com/) with a passkey, Google, and Discord.
- **pg_cron cleanup.** Daily jobs in the database, all UTC: `delete-expired-log-drafts` at 04:00 (drafts 14 days after the last edit), `delete-expired-applogs` at 04:30 (app logs kept 14 days), and `delete-expired-sessions` at 05:00 (sessions 30 days past `expires`).

## Prerequisites

- **Node.js** v26 or later
- **[pnpm](https://pnpm.io/) 11.8.0**, the version pinned in `packageManager`
- [1Password CLI](https://developer.1password.com/docs/cli/) 2.41.0 or newer, for the `op:*` scripts
- [Supabase CLI](https://supabase.com/docs/guides/cli) 3.x (applies the migrations; the Supabase stack is not used)
- [OrbStack](https://orbstack.dev/) on macOS (`brew install orbstack`), or Docker Engine with Compose on Linux. Runs the local Postgres. On macOS the scripts start OrbStack if it isn't running.
- Optional: `psql` (`brew install libpq`). The scripts use the `psql` inside the container, so the host copy is only for your own queries.

Bun and npm can install the dependencies, but the scripts call `pnpm`. Use pnpm.

## Setup

1. **Clone the repository:**

```bash
git clone <your-repo-url>
cd ddal-svelte
```

2. **Copy the environment templates:**

```bash
cp .env.example.local .env.local
cp .env.example.development.local .env.development.local
cp .env.example.production.local .env.production.local
```

`.env.local` is auth, R2, and `LOG_LEVEL`. `.env.development.local` is what `pnpm dev` reads for `DATABASE_URL` and `PUBLIC_URL` (port 5173). `.env.production.local` is what `pnpm build` and `pnpm preview` read (the same local database, with `PUBLIC_URL` on port 4173). Those three files are the list of variables to fill in. The comment at the top of `.env.example.local` describes the 1Password alternative.

Secrets can stay in 1Password instead of on disk. Every `op:*` script wraps its command in `op run` and loads a 1Password environment. The environment id is the `--environment` value on those scripts in `package.json` (`4iuxdmr3wcxhjj7m7gd4qen46u`). If you use your own environment, replace that id, as the comment in `.env.example.local` says. `pnpm op:dev` is the usual way to start the app.

3. **Install dependencies:**

```bash
pnpm install
```

## Environment variables

The example files are the authoritative list. These are the ones that matter locally:

- `DATABASE_URL` — Postgres connection string. The local database is `postgresql://postgres:postgres@127.0.0.1:5433/postgres`, which is already set in the development and production example files.
- `PUBLIC_URL` — public origin of the app, and the base URL better-auth uses. The development example is `http://localhost:5173`. The production example is `http://localhost:4173` (Vite preview).
- `REMOTE_DB_URL` — remote Postgres URL used by the `op:db:*` scripts. End-to-end guards also require this string to differ from the local `DATABASE_URL`. It is not in the example files; the 1Password environment supplies it.
- `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — Cloudflare R2, for portraits, avatars, and note images.
- `AUTH_SECRET` — secret better-auth uses to sign tokens.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — Google sign-in.
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` — Discord sign-in.
- `LOG_LEVEL` — optional. One of `none`, `debug`, `info`, or `error`. The example sets `debug`. When the variable is unset, the app uses `error`.

## Local database

Production is plain Postgres 18 with pg_cron, built from `docker/postgres/Dockerfile`. `docker-compose.yml` builds that same file, so local matches production. The Supabase CLI is used only to apply and create migrations. `supabase start` is no longer used.

From a fresh clone:

```bash
pnpm install
pnpm db:local:reset   # build + start Postgres, create roles, apply every migration, seed if supabase/seed.sql exists
pnpm dev              # starts the database if needed, then vite
```

The database listens on `127.0.0.1:5433` (override with `POSTGRES_PORT`). The password is `postgres` (override with `POSTGRES_PASSWORD`; then update `DATABASE_URL` to match). Data lives in the `ddal-svelte_ddal-pgdata` volume, mounted at `/var/lib/postgresql`.

| Script | What it does |
| --- | --- |
| `pnpm db:local:up` / `db:local:down` | Start (building if needed, waits until healthy) or stop the container. Data is kept. |
| `pnpm db:local:reset` | Drop the `public` and `supabase_migrations` schemas and pg_cron, create roles, re-apply all migrations, then seed. |
| `pnpm db:local:migrate` | Apply new migrations only. |
| `pnpm db:local:restore` | Reset, then load `data.sql` from the newest `supabase/backups/<timestamp>/` (see `pnpm op:db:backup`). |
| `pnpm db:local:psql` | `psql` shell in the container. |
| `pnpm db:local:nuke` | Stop and delete the volume. The next `reset` starts empty. |
| `pnpm db:migration:new <name>` | `supabase migration new`: create an empty migration file in `supabase/migrations`. |
| `pnpm db:local:diff` | `supabase db diff` against the local database. Needs the Supabase CLI's shadow-database containers. |

Migrations were written for Supabase, so `docker/postgres/roles.sql` creates the `anon`, `authenticated`, and `service_role` roles they grant to (NOLOGIN, no other use). Run it before the migrations on any new database, including production. The migrations use no other Supabase-only roles or schemas.

To work on a new migration: `pnpm db:migration:new add_thing`, edit the file, then `pnpm db:local:migrate`.

### Connect Dataflare

Add a PostgreSQL connection: host `127.0.0.1`, port `5433`, database `postgres`, user `postgres`, password `postgres`, SSL off. Or use the URL `postgresql://postgres:postgres@127.0.0.1:5433/postgres`.

## Development

Start the app with secrets from 1Password:

```bash
pnpm op:dev
```

Or, with the env files filled in:

```bash
pnpm dev
```

The app is at [http://localhost:5173](http://localhost:5173), unless `PUBLIC_URL` says otherwise.

## Scripts

- `pnpm op:dev` — start the local Postgres, then `vite dev` under `op run`.
- `pnpm dev` — the same servers, reading the env files instead of 1Password.
- `pnpm build` — print the Node, pnpm, and Vite versions, then `vite build`.
- `pnpm preview` — serve that production build.
- `pnpm check` — `svelte-kit sync` and `svelte-check`.
- `pnpm lint` — ESLint on `src/**/*.{ts,svelte}`, with no warnings allowed.
- `pnpm format` — Prettier across the repo.
- `pnpm test` — `test:unit`, then Playwright (`test:e2e`).
- `pnpm test:unit` — Vitest once (`vitest run`).
- `pnpm op:test` — unit tests, then `op:test:e2e`.
- `pnpm op:test:e2e` — Playwright through `op run`, with `E2E_ALLOW_LOCAL=1`. Details are in the next section.
- `pnpm op:test:e2e:cleanup` — delete leftover `e2e-` users through `op run`.
- `pnpm test:e2e:guard` — run the e2e environment guard without touching the database.
- `pnpm db:local:*` — local database scripts, listed in [Local database](#local-database).
- `pnpm op:db:diff` — `supabase db diff` against `REMOTE_DB_URL`, via `op run`.
- `pnpm op:db:push` — `supabase db push` against `REMOTE_DB_URL`, via `op run`.
- `pnpm op:db:dump` — data-only dump of `REMOTE_DB_URL` written to `supabase/seed.sql`.
- `pnpm op:db:backup` — roles, schema, and data dumps of `REMOTE_DB_URL` under `supabase/backups/<timestamp>/`.

`pnpm test:e2e` and `pnpm test:e2e:cleanup` are the same Playwright commands without `op run`, for CI where the variables are already in the environment. Other scripts are in `package.json`.

## End-to-end tests

Playwright signs up a disposable passkey user (`e2e-<timestamp>`), walks through characters, logs, magic items, and DMs, then deletes the account. Each run uses the local database only. It does not reset the database and it never reads `REMOTE_DB_URL`.

### Safeguards

The suite stops before it creates anything unless all of these are true:

- `E2E_ALLOW_LOCAL=1` (or `true`)
- `PUBLIC_URL` is `http://localhost`, `http://127.0.0.1`, or another local host
- `DATABASE_URL` uses that same kind of host (the local database is `127.0.0.1:5433`)
- `DATABASE_URL` is not the same string as `REMOTE_DB_URL`

Staging is rejected because it shares production's database. A local `op run` environment also sets `REMOTE_DB_URL`; that is fine as long as `DATABASE_URL` is the local database and the two strings differ. A global setup step and `pnpm op:test:e2e:cleanup` delete leftover `e2e-` users, their rows, and their stored images if a run crashes. Account deletion removes permanent avatars and portraits immediately. Unsaved `tmp/` uploads are left for the bucket lifecycle rule (about a day); the cleanup script still deletes those objects for `e2e-` users so a crashed run does not leave files in the test bucket.

### Setup

1. Start the local database and apply migrations:

```bash
pnpm db:local:reset
```

2. Local runs take `DATABASE_URL`, `PUBLIC_URL`, `REMOTE_DB_URL`, and the `R2_*` variables from the same 1Password environment as `pnpm op:dev`. `DATABASE_URL` must be the local database. The image bucket must allow `PUT` from `http://localhost:5173`.

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

A GitHub Actions workflow (`.github/workflows/e2e.yml`) runs the same suite with the local Postgres and a local MinIO bucket on pull requests to `main`, and on demand through `workflow_dispatch`. It skips pull requests that only change Markdown, and it does not need repository secrets. A separate `ci.yml` workflow runs unit tests, lint, and type checks on every pull request and on pushes to `main` and `development`. The MinIO root user, bucket, and CORS origin exist only for that job. Browser uploads use path-style URLs on `http://127.0.0.1:9000`, and `MINIO_API_CORS_ALLOW_ORIGIN` allows `PUT` from `http://localhost:5173`.

## Notes

- Database access goes through [Drizzle ORM](https://orm.drizzle.team/) to Postgres. Schema and migrations are in `supabase/`.
- Sign-in is [better-auth](https://www.better-auth.com/) with a passkey, Google, and Discord.
- Payloads are checked with [Valibot](https://valibot.dev/).
- Unit tests are [Vitest](https://vitest.dev/), via `pnpm test:unit`.
