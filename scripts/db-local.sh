#!/usr/bin/env bash
# Local Postgres helper. Usage: scripts/db-local.sh <up|down|reset|migrate|restore|psql|nuke|diff [-f name]>
# Overrides: POSTGRES_PASSWORD (default postgres), POSTGRES_PORT (default 5433).
set -euo pipefail

cd "$(dirname "$0")/.."

PASSWORD="${POSTGRES_PASSWORD:-postgres}"
export POSTGRES_PASSWORD="$PASSWORD"
export POSTGRES_PORT="${POSTGRES_PORT:-5433}"
DB_URL="postgresql://postgres:${PASSWORD}@127.0.0.1:${POSTGRES_PORT}/postgres"

# shellcheck source=docker-ready.sh
source "$(dirname "$0")/docker-ready.sh"

ensure_docker

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

# Schemas that exist only on Supabase. A seed that touches them is an old Supabase-era dump and
# cannot load into plain Postgres.
SUPABASE_ONLY_SCHEMAS='auth|storage|realtime|_realtime|graphql|graphql_public|vault|pgsodium|pgsodium_masks|supabase_functions|supabase_migrations|extensions|net|pgbouncer'

seed() {
  [ -f supabase/seed.sql ] || return 0
  if [ -n "${SKIP_SEED:-}" ]; then
    echo "SKIP_SEED is set. Skipping supabase/seed.sql."
    return 0
  fi
  local hits
  hits=$(grep -nE "\"(${SUPABASE_ONLY_SCHEMAS})\"\.|^[[:space:]]*(COPY|INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE( ONLY)?|CREATE (TABLE|SEQUENCE|SCHEMA)( IF NOT EXISTS)?) +(${SUPABASE_ONLY_SCHEMAS})(\.| *;)|setval\('(${SUPABASE_ONLY_SCHEMAS})\." supabase/seed.sql | head -n 5 || true)
  if [ -n "$hits" ]; then
    echo "Error: supabase/seed.sql references Supabase-only schemas, so it is an old Supabase-era dump:" >&2
    echo "$hits" | cut -c1-160 >&2
    echo "Regenerate it from production with: pnpm op:db:dump   (or delete it, or run with SKIP_SEED=1)." >&2
    echo "The database and migrations are fine; only the seed was not loaded." >&2
    exit 1
  fi
  echo "Seeding from supabase/seed.sql"
  psql_in -q --single-transaction <supabase/seed.sql
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

# Diff the migrations against the local database, using a throwaway Postgres built from the same
# image (not Supabase's shadow DB, whose extensions and grants differ from production). The output is
# the SQL that brings the migrations up to the local schema. migra runs in a small cached image.
cleanup_shadow() {
  docker rm -f "$SHADOW" >/dev/null 2>&1 || true
  docker network disconnect "$SHADOW_NET" "$LOCAL_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$SHADOW_NET" >/dev/null 2>&1 || true
}

diff_local() {
  local name=""
  if [ "${1:-}" = "-f" ]; then
    name="${2:-}"
    [ -n "$name" ] || { echo "Usage: $0 diff [-f name]" >&2; exit 2; }
  elif [ $# -gt 0 ]; then
    echo "Usage: $0 diff [-f name]" >&2
    exit 2
  fi

  SHADOW="ddal-postgres-shadow-$$"
  SHADOW_NET="ddal-shadow-net-$$"
  LOCAL_CONTAINER=$(compose ps -q db)
  [ -n "$LOCAL_CONTAINER" ] || { echo "Error: the local database is not running. Run pnpm db:local:up first." >&2; exit 1; }
  local local_name
  local_name=$(docker inspect -f '{{.Name}}' "$LOCAL_CONTAINER")
  local_name=${local_name#/}

  trap cleanup_shadow EXIT

  compose build db >&2
  docker build -q -t ddal-migra docker/migra >/dev/null
  docker network create "$SHADOW_NET" >/dev/null
  docker network connect "$SHADOW_NET" "$LOCAL_CONTAINER"

  docker run -d --name "$SHADOW" --network "$SHADOW_NET" \
    -e POSTGRES_PASSWORD=shadow \
    --health-cmd "pg_isready -U postgres -d postgres" --health-interval 1s --health-retries 60 \
    ddal-postgres:18.7 >/dev/null
  until [ "$(docker inspect -f '{{.State.Health.Status}}' "$SHADOW")" = "healthy" ]; do sleep 1; done

  docker exec -i "$SHADOW" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 <docker/postgres/roles.sql
  local f
  for f in supabase/migrations/*.sql; do
    docker exec -i "$SHADOW" psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 >/dev/null <"$f" \
      || { echo "Error: migration failed on the shadow database: $f" >&2; exit 1; }
  done

  local out status=0
  out=$(docker run --rm --network "$SHADOW_NET" -e PYTHONWARNINGS=ignore ddal-migra \
    --unsafe --with-privileges --schema public \
    "postgresql://postgres:shadow@${SHADOW}:5432/postgres" \
    "postgresql://postgres:${PASSWORD}@${local_name}:5432/postgres") || status=$?
  # migra exits 2 when differences were found.
  if [ "$status" -ne 0 ] && [ "$status" -ne 2 ]; then
    echo "Error: migra failed (exit $status)." >&2
    exit 1
  fi

  if [ -z "$out" ]; then
    echo "No differences: the migrations match the local database." >&2
    return 0
  fi
  if [ -n "$name" ]; then
    local file
    file="supabase/migrations/$(date -u +%Y%m%d%H%M%S)_${name}.sql"
    printf '%s\n' "$out" >"$file"
    echo "Wrote $file. Review it before applying." >&2
  else
    printf '%s\n' "$out"
  fi
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
  diff)
    shift
    diff_local "$@"
    ;;
  psql) compose exec db psql -U postgres -d postgres ;;
  nuke) compose down -v ;;
  *)
    echo "Usage: $0 <up|down|reset|migrate|restore|psql|nuke|diff [-f name]>" >&2
    exit 2
    ;;
esac
