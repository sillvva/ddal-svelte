#!/usr/bin/env bash
# Dump the remote (production) database with pg_dump 18, run from the same Postgres image as
# production. The Supabase CLI can't do this: it ships pg_dump 17 at most, which refuses a server 18.
# Usage: scripts/db-dump.sh <seed|backup>   (needs REMOTE_DB_URL, e.g. through `op run`)
# Extra `docker run` arguments can be passed in DUMP_DOCKER_ARGS.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=docker-ready.sh
source "$(dirname "$0")/docker-ready.sh"

: "${REMOTE_DB_URL:?REMOTE_DB_URL is not set. Run this through op run (pnpm op:db:dump).}"
ensure_docker

IMAGE="postgres:18.7-trixie"

pg() {
  # shellcheck disable=SC2086
  docker run --rm -e REMOTE_DB_URL ${DUMP_DOCKER_ARGS:-} "$IMAGE" "$@"
}

# Data only, public schema only: no Supabase-owned schemas, no schema_migrations rows (the
# migrations table is rebuilt by the migrations), no owners or grants. Replica mode lets the
# rows load in any order.
dump_data() {
  {
    echo "SET session_replication_role = replica;"
    pg sh -c 'pg_dump "$REMOTE_DB_URL" --data-only --schema=public --no-owner --no-privileges'
  } >"$1"
}

case "${1:-}" in
  seed)
    dump_data supabase/seed.sql
    echo "Wrote supabase/seed.sql"
    ;;
  backup)
    dir="supabase/backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$dir"
    pg sh -c 'pg_dumpall --dbname="$REMOTE_DB_URL" --roles-only' >"$dir/roles.sql"
    pg sh -c 'pg_dump "$REMOTE_DB_URL" --schema-only --schema=public' >"$dir/schema.sql"
    dump_data "$dir/data.sql"
    echo "Wrote $dir"
    ;;
  *)
    echo "Usage: $0 <seed|backup>" >&2
    exit 2
    ;;
esac
