#!/usr/bin/env bash
# Local Postgres helper. Usage: scripts/db-local.sh <up|down|reset|migrate|restore|psql|nuke>
# Overrides: POSTGRES_PASSWORD (default postgres), POSTGRES_PORT (default 5433).
set -euo pipefail

cd "$(dirname "$0")/.."

PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_PASSWORD="$PASSWORD"
export POSTGRES_PORT="${POSTGRES_PORT:-5433}"
DB_URL="postgresql://postgres:${PASSWORD}@127.0.0.1:${POSTGRES_PORT}/postgres"

compose() { docker compose "$@"; }
psql_in() { compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

up() {
  compose up -d --build --wait
}

roles() {
  psql_in -q <docker/postgres/roles.sql
}

migrate() {
  supabase migration up --remote "$DB_URL" --include-all --yes
}

seed() {
  if [ -f supabase/seed.sql ]; then
    echo "Seeding from supabase/seed.sql"
    psql_in -q --single-transaction <supabase/seed.sql
  fi
}

# Dropping the schemas (and pg_cron, which owns the jobs) instead of the database: pg_cron's
# launcher stays connected to `postgres` (cron.database_name), so that database can't be dropped.
wipe() {
  psql_in -q <<'SQL'
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP SCHEMA IF EXISTS public, supabase_migrations CASCADE;
CREATE SCHEMA public AUTHORIZATION pg_database_owner;
COMMENT ON SCHEMA public IS 'standard public schema';
GRANT USAGE ON SCHEMA public TO PUBLIC;
SQL
}

reset_schema() {
  up
  wipe
  roles
  migrate
}

latest_backup() {
  local dir
  dir=$(find supabase/backups -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | tail -n 1)
  [ -n "$dir" ] && [ -f "$dir/data.sql" ] || { echo "No supabase/backups/*/data.sql found. Run pnpm op:db:backup first." >&2; exit 1; }
  echo "$dir"
}

case "${1:-}" in
  up) up ;;
  down) compose down ;;
  reset)
    reset_schema
    seed
    ;;
  migrate)
    up
    roles
    migrate
    ;;
  restore)
    dir=$(latest_backup)
    reset_schema
    echo "Restoring $dir/data.sql"
    psql_in --single-transaction <"$dir/data.sql"
    ;;
  psql) compose exec db psql -U postgres -d postgres ;;
  nuke) compose down -v ;;
  *)
    echo "Usage: $0 <up|down|reset|migrate|restore|psql|nuke>" >&2
    exit 2
    ;;
esac
