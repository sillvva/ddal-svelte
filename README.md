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
| `pnpm db:local:reset` | Drop the `public` and `supabase_migrations` schemas and pg_cron, create roles, re-apply all migrations, then load `supabase/seed.sql` if it exists. A seed that touches Supabase-only schemas (`auth`, `storage`, ...) is refused with a message; regenerate it with `pnpm op:db:dump`, delete it, or run `SKIP_SEED=1 pnpm db:local:reset`. |
| `pnpm op:db:local:reset` | `db:local:reset`, then empty the dev R2 bucket (see below). |
| `pnpm db:local:migrate` | Apply new migrations only. |
| `pnpm db:local:restore` | Reset, then load `data.sql` from the newest `supabase/backups/<timestamp>/` (see `pnpm op:db:backup`). |
| `pnpm op:db:local:restore` | `db:local:restore`, then empty the dev R2 bucket (see below). |
| `pnpm db:local:psql` | `psql` shell in the container. |
| `pnpm db:local:nuke` | Stop and delete the volume. The next `reset` starts empty. |
| `pnpm db:migration:new <name>` | `supabase migration new`: create an empty migration file in `supabase/migrations`. |
| `pnpm db:local:diff [-f name]` | SQL that brings `supabase/migrations` up to the local schema. It applies the roles and migrations to a throwaway container built from the same image, then diffs it against the local database with [migra](https://github.com/djrobstep/migra) (a small pinned image, `docker/migra`, built on first use). Prints to stdout, or with `-f name` writes `supabase/migrations/<timestamp>_name.sql` and records that version in the local database's `supabase_migrations.schema_migrations` (like `supabase db pull`), so `pnpm db:local:migrate` will not try to re-apply it. Right after a reset it reports no differences. Review the output before applying it. |
| `pnpm db:local:pull` | Same as `pnpm db:local:diff -f remote_schema`: diff the **local** database against the migrations (not production) and write `supabase/migrations/<timestamp>_remote_schema.sql`. This is the local equivalent of `supabase db pull` for capturing schema drift into a migration file. |

**Cleaning the dev R2 bucket.** A reset recreates every table (including `pending_object_deletion` and `image_uploads`), so images uploaded under the old database would be orphans in the bucket. `pnpm op:db:local:reset` (or `pnpm op:db:local:restore`) runs the reset (or restore) and, once it succeeds, `pnpm op:r2:clean:dev` (`scripts/r2-clean-dev.ts`) deletes every object in `R2_BUCKET` with the `R2_*` variables from 1Password. It only runs when `R2_BUCKET` is exactly `ddal-uploads-dev`; any other bucket makes it exit with an error, and the production bucket `ddal-uploads` is refused always. Another developer can name their own dev bucket with `R2_DEV_BUCKET` (it must match `R2_BUCKET` and can never be `ddal-uploads`). Set `SKIP_R2_CLEAN=1` to skip it. If `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, or `R2_SECRET_ACCESS_KEY` is missing (CI, or a run without `op run`), it prints a message and skips, exiting 0. Plain `pnpm db:local:reset` and `db:local:restore` never touch the bucket.

Migrations were written for Supabase, so `docker/postgres/roles.sql` creates the `anon`, `authenticated`, and `service_role` roles they grant to (NOLOGIN, no other use). Run it before the migrations on any new database, including production. The migrations use no other Supabase-only roles or schemas.

To work on a new migration, either write it by hand (`pnpm db:migration:new add_thing`, edit, `pnpm db:local:migrate`), or change the local schema and capture it with `pnpm db:local:diff -f add_thing` (or `pnpm db:local:pull` for the default `remote_schema` filename). With `-f`, the script also marks the new file as already applied in local migration history. Don't use `supabase db diff`: its shadow database is Supabase's Postgres image, so the diff is full of Supabase extension and grant noise. To check whether production has drifted from the migrations, use `pnpm op:db:diff` (see [Scripts](#scripts)).

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
- `pnpm op:db:local:reset` / `pnpm op:db:local:restore` — reset or restore the local database, then empty the dev R2 bucket; `pnpm op:r2:clean:dev` runs just the bucket cleanup. See [Local database](#local-database).
- `pnpm op:db:diff` — drift detection: the SQL that would make `supabase/migrations` match the **production** schema (`REMOTE_DB_URL`, via `op run`). It is the same machinery as `db:local:diff` (`scripts/db-local.sh diff-remote`): a throwaway container from our image gets the roles and every migration, then migra diffs it against production (`public` schema including grants; `supabase_migrations`, the `cron` schema, and pg_cron objects are out of scope). Empty output means the migrations match production. It only prints, never writes a migration file, and is read-only against production: migra only reads catalogs, and its sessions are forced to `default_transaction_read_only=on`, which the script checks before diffing. The password is passed to the container through its environment, not on a command line. Needs Docker and, for the default production host, Tailscale. A container may not resolve or route tailnet names, so the script resolves the host name on your machine and maps it into the migra container with `--add-host` (the container then reaches the tailnet address through your machine's network, including its Tailscale routes). If that doesn't work, set `REMOTE_DB_HOST_IP` to the address, or pass extra `docker run` arguments in `DIFF_DOCKER_ARGS` (host networking is not an option: migra must also reach the shadow container by name).
- `pnpm op:db:push` — apply pending `supabase/migrations` to `REMOTE_DB_URL` via `op run`, using `supabase db push --remote=<url> --skip-vault` (`scripts/db-push.sh`). It lists the pending migrations and asks for confirmation. Each applied migration is recorded in `supabase_migrations.schema_migrations`. Pass `--include-all` to also apply migrations older than the newest one recorded on production (`pnpm op:db:push --include-all`). The password goes to the CLI as `PGPASSWORD`, not in the URL.
- `pnpm op:db:push:dry` — the same, with `--dry-run`: prints the migrations that would be applied and changes nothing.
- `pnpm op:db:dump` — data-only dump of the `public` schema of `REMOTE_DB_URL` written to `supabase/seed.sql`, using `pg_dump` 18 from the `postgres:18.7-trixie` image (the Supabase CLI's `pg_dump` can't read a Postgres 18 server). `db:local:reset` loads it.
- `pnpm op:db:backup` — roles, schema, and data dumps of `REMOTE_DB_URL` under `supabase/backups/<timestamp>/`, with the same `pg_dump`.

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
