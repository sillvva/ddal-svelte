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
cp .env.example .env
# Edit .env to match your local setup (database credentials, API keys, etc.)
```

> The `.env` file is required for local development. See `.env.example` for required variables.

3. **Install dependencies:**

```bash
corepack pnpm install
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
corepack pnpm build
# or
bun run build
# or
npm run build
```

Preview the production build:

```bash
corepack pnpm preview
# or
bun run preview
# or
npm run preview
```

## Linting & Formatting

```bash
corepack pnpm lint
corepack pnpm format
```

## Notes

- The project uses [Drizzle ORM](https://orm.drizzle.team/) for database access.
- See `supabase/` for database schema and migrations.
- For more details, check the scripts in `package.json`.
