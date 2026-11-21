#!/usr/bin/env bash
# Local Postgres helper. Usage: scripts/db-local.sh <up|down|reset|migrate|restore|psql|nuke|diff [-f name]|diff-remote>
# diff-remote diffs against REMOTE_DB_URL (production), read-only; run it through op run (pnpm op:db:diff).
# Overrides: POSTGRES_PASSWORD (default postgres), POSTGRES_PORT (default 5433), REMOTE_DB_HOST_IP and
# DIFF_DOCKER_ARGS (diff-remote only: see the README).
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

# Diff the migrations against a database, using a throwaway Postgres built from the same image (not
# Supabase's shadow DB, whose extensions and grants differ from production). The output is the SQL that
# brings the migrations up to the target's schema (public, with grants; migra is unaware of the
# supabase_migrations and cron schemas). migra runs in a small cached image.
#   diff_schema local        target = the local database. `-f name` writes a migration file.
#   diff_schema remote       target = REMOTE_DB_URL (production): drift detection. Read-only; prints only.
SHADOW=""
SHADOW_NET=""
LOCAL_CONTAINER=""

cleanup_shadow() {
  [ -z "$SHADOW" ] || docker rm -f "$SHADOW" >/dev/null 2>&1 || true
  if [ -n "$SHADOW_NET" ]; then
    [ -z "$LOCAL_CONTAINER" ] || docker network disconnect "$SHADOW_NET" "$LOCAL_CONTAINER" >/dev/null 2>&1 || true
    docker network rm "$SHADOW_NET" >/dev/null 2>&1 || true
  fi
}

# Print an IPv4 address for $1, resolved on the host (the host's resolver knows tailnet names; a
# container's may not). Prints nothing if it cannot be resolved.
resolve_host() {
  local host=$1
  if [[ $host =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "$host"
  elif command -v dscacheutil >/dev/null 2>&1; then
    dscacheutil -q host -a name "$host" | awk '/^ip_address:/ { print $2; exit }'
  elif command -v getent >/dev/null 2>&1; then
    getent ahostsv4 "$host" | awk '{ print $1; exit }'
  fi
}

diff_schema() {
  local mode=$1
  shift
  local name=""
  if [ "$mode" = local ] && [ "${1:-}" = "-f" ]; then
    name="${2:-}"
    [ -n "$name" ] || { echo "Usage: $0 diff [-f name]" >&2; exit 2; }
  elif [ $# -gt 0 ]; then
    if [ "$mode" = local ]; then echo "Usage: $0 diff [-f name]" >&2; else echo "Usage: $0 diff-remote" >&2; fi
    exit 2
  fi

  # Extra `docker run` arguments for the migra container (e.g. --dns, --add-host) go in DIFF_DOCKER_ARGS.
  SHADOW="ddal-postgres-shadow-$$"
  SHADOW_NET="ddal-shadow-net-$$"
  local -a migra_args=(--rm --network "$SHADOW_NET" -e PYTHONWARNINGS=ignore -e SHADOW_URL -e TARGET_URL)
  local target_url target_desc

  trap cleanup_shadow EXIT

  if [ "$mode" = local ]; then
    LOCAL_CONTAINER=$(compose ps -q db)
    [ -n "$LOCAL_CONTAINER" ] || { echo "Error: the local database is not running. Run pnpm db:local:up first." >&2; exit 1; }
    local local_name
    local_name=$(docker inspect -f '{{.Name}}' "$LOCAL_CONTAINER")
    local_name=${local_name#/}
    target_url="postgresql://postgres:${PASSWORD}@${local_name}:5432/postgres"
    target_desc="the local database"
  else
    # shellcheck source=remote-db.sh
    source "$(dirname "$0")/remote-db.sh"
    parse_remote_url || exit 1
    target_url=$REMOTE_URL_SQLALCHEMY
    target_desc="production"
    # Never write to the target, even if migra changed: every session it opens is read-only.
    migra_args+=(-e "PGOPTIONS=-c default_transaction_read_only=on")
    # The container may not resolve or route tailnet names, so resolve on the host and pin the name.
    # The container reaches the address through the host's network stack (and so its Tailscale routes).
    local ip="${REMOTE_DB_HOST_IP:-}"
    [ -n "$ip" ] || ip=$(resolve_host "$REMOTE_HOST")
    if [ -z "$ip" ]; then
      echo "Error: cannot resolve '$REMOTE_HOST' on this machine. Is Tailscale connected? To skip name resolution, set REMOTE_DB_HOST_IP." >&2
      exit 1
    fi
    if [[ $ip == 127.* ]]; then
      migra_args+=(--add-host "${REMOTE_HOST}:host-gateway") # an SSH tunnel or port-forward on the host
    elif ! [[ $REMOTE_HOST =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      migra_args+=(--add-host "${REMOTE_HOST}:${ip}")
    fi
  fi
  # shellcheck disable=SC2206
  migra_args+=(${DIFF_DOCKER_ARGS:-})

  compose build db >&2
  docker build -q -t ddal-migra docker/migra >/dev/null
  docker network create "$SHADOW_NET" >/dev/null
  [ -z "$LOCAL_CONTAINER" ] || docker network connect "$SHADOW_NET" "$LOCAL_CONTAINER"

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

  # The URLs travel in the environment of the container, not in the command line, so the password
  # never shows in `ps` or `docker ps`.
  export SHADOW_URL="postgresql://postgres:shadow@${SHADOW}:5432/postgres"
  export TARGET_URL="$target_url"

  if [ "$mode" = remote ]; then
    # Fail early and clearly if production is unreachable, and prove the session is read-only.
    docker run "${migra_args[@]}" --entrypoint python ddal-migra -c '
import os, sys, psycopg2
c = psycopg2.connect(os.environ["TARGET_URL"], connect_timeout=15)
cur = c.cursor()
cur.execute("show default_transaction_read_only")
sys.exit(0 if cur.fetchone()[0] == "on" else 3)' \
      || {
        echo "Error: cannot open a read-only session to production from a container. Check that Tailscale is" >&2
        echo "connected and that ${REMOTE_HOST}:${REMOTE_PORT} is reachable. See DIFF_DOCKER_ARGS in the README." >&2
        exit 1
      }
  fi

  local out status=0
  out=$(docker run "${migra_args[@]}" --entrypoint sh ddal-migra -c \
    'exec migra --unsafe --with-privileges --schema public "$SHADOW_URL" "$TARGET_URL"') || status=$?
  # migra exits 2 when differences were found.
  if [ "$status" -ne 0 ] && [ "$status" -ne 2 ]; then
    echo "Error: migra failed (exit $status)." >&2
    exit 1
  fi

  if [ -z "$out" ]; then
    echo "No differences: the migrations match ${target_desc}." >&2
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
    diff_schema local "$@"
    ;;
  diff-remote)
    shift
    diff_schema remote "$@"
    ;;
  psql) compose exec db psql -U postgres -d postgres ;;
  nuke) compose down -v ;;
  *)
    echo "Usage: $0 <up|down|reset|migrate|restore|psql|nuke|diff [-f name]|diff-remote>" >&2
    exit 2
    ;;
esac
