#!/usr/bin/env bash
# Apply the pending migrations in supabase/migrations to the remote (production) database.
# Usage: scripts/db-push.sh [--dry-run] [--include-all]   (needs REMOTE_DB_URL, e.g. through `op run`)
#   --dry-run      list the migrations that would be applied, change nothing
#   --include-all  also apply migrations older than the newest one already recorded on the remote
# Without --dry-run the CLI lists the pending migrations and asks for confirmation before applying.
#
# `supabase db push --remote=<url>` is the Supabase CLI 3.x replacement for the removed `--db-url`.
# It records each migration in supabase_migrations.schema_migrations, like `migration up`.
# --skip-vault: plain Postgres has no vault schema, and the CLI would otherwise try to sync secrets.
# The password is passed as PGPASSWORD, not in the URL, so it does not appear in `ps`.
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=remote-db.sh
source "$(dirname "$0")/remote-db.sh"

for arg in "$@"; do
  case "$arg" in
    --dry-run | --include-all | --yes) ;;
    *)
      echo "Usage: $0 [--dry-run] [--include-all] [--yes]" >&2
      exit 2
      ;;
  esac
done

parse_remote_url
if [ -n "$REMOTE_PASSWORD" ]; then export PGPASSWORD="$REMOTE_PASSWORD"; fi

exec supabase db push --remote="$REMOTE_URL_NO_PASSWORD" --skip-vault "$@"
