#!/usr/bin/env bash
# One-shot setup for a fresh git worktree. Usage: pnpm op:worktree:setup
#   1. Copies .env.example.*local files to .env.*local (existing files are never overwritten).
#   2. Assigns a dedicated POSTGRES_PORT in .env.local and updates DATABASE_URL in
#      .env.development.local and .env.production.local for worktrees (main checkout keeps 5433).
#   3. Optionally stops local DB containers started from other worktrees (STOP_OTHERS=1).
#   4. Runs `pnpm op:db:backup` (pulls a fresh production data dump into supabase/backups).
#   5. Runs `pnpm op:db:local:restore` (resets this worktree's database, loads the backup, and starts
#      its container).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT=$(pwd -P)

# shellcheck source=docker-ready.sh
source "$(dirname "$0")/docker-ready.sh"

copy_env_files() {
  local example target
  shopt -s nullglob
  for example in .env.example.*local; do
    target=".env.${example#.env.example.}"
    if [ -e "$target" ]; then
      echo "Keeping existing $target"
    else
      cp "$example" "$target"
      echo "Created $target from $example"
    fi
  done
  shopt -u nullglob
}

is_main_git_checkout() {
  local common dir
  common=$(git rev-parse --path-format=absolute --git-common-dir)
  dir=$(git rev-parse --path-format=absolute --git-dir)
  [ "$common" = "$dir" ]
}

# Append one line to an env file. If the file is non-empty and does not end with a newline, insert one
# before the new line so the last existing variable is not concatenated with the append.
append_env_line() {
  local file=$1 line=$2 last_byte
  if [ -s "$file" ]; then
    # Do not use $(tail -c 1): command substitution strips a trailing newline byte.
    last_byte=$(tail -c 1 "$file" | od -An -tu1)
    last_byte=${last_byte//[[:space:]]/}
    if [ "$last_byte" != "10" ]; then
      printf '\n' >>"$file"
    fi
  fi
  printf '%s\n' "$line" >>"$file"
}

update_local_database_url_port() {
  local file=$1 port=$2 tmp
  [ -f "$file" ] || return 0
  grep -q '127\.0\.0\.1:5433/' "$file" 2>/dev/null || return 0
  tmp=$(mktemp)
  sed "s|127\.0\.0\.1:5433/|127.0.0.1:${port}/|g" "$file" >"$tmp"
  mv "$tmp" "$file"
  echo "Updated DATABASE_URL port to ${port} in ${file}"
}

assign_port() {
  if is_main_git_checkout; then
    echo "Main git checkout: using default POSTGRES_PORT 5433 (not written to .env.local)."
    return 0
  fi

  local port line hash
  line=$(grep -m1 '^POSTGRES_PORT=' .env.local 2>/dev/null || true)
  if [ -n "$line" ]; then
    port=${line#POSTGRES_PORT=}
    port=${port#\"}
    port=${port%\"}
    port=${port#\'}
    port=${port%\'}
  else
    hash=$(printf '%s' "$ROOT" | cksum | cut -d' ' -f1)
    port=$((5440 + hash % 100))
    append_env_line .env.local "POSTGRES_PORT=${port}"
    echo "Assigned POSTGRES_PORT=${port} in .env.local"
  fi

  update_local_database_url_port .env.development.local "$port"
  update_local_database_url_port .env.production.local "$port"
}

# Containers running the `db` service from other compose projects (outside this worktree).
stop_other_worktree_dbs() {
  [ "${STOP_OTHERS:-}" = "1" ] || { echo "STOP_OTHERS is not set. Leaving other databases running."; return 0; }
  ensure_docker

  local current_project id dir project resolved_dir
  current_project=$(docker compose config | awk '$1 == "name:" { print $2; exit }')

  while IFS= read -r id; do
    [ -n "$id" ] || continue
    dir=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$id" 2>/dev/null || true)
    project=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$id" 2>/dev/null || true)
    if [ -n "$dir" ] && resolved_dir=$(cd "$dir" 2>/dev/null && pwd -P); then
      :
    else
      resolved_dir="$dir"
    fi

    if [ -n "$project" ] && [ "$project" = "$current_project" ] && [ "$resolved_dir" = "$ROOT" ]; then
      continue
    fi

    if [ -n "$dir" ] || [ -n "$project" ]; then
      echo "Stopping database of another worktree: ${dir:-<unknown>} (compose project ${project:-<none>})"
    else
      echo "Stopping conflicting database container ($id)"
    fi

    # Bring the other compose project down cleanly when possible (keeping its volume),
    # then fall back to removing the container directly if it is still present.
    if [ -n "$project" ] && [ -n "$dir" ] && [ -d "$dir" ]; then
      docker compose --project-name "$project" --project-directory "$dir" down </dev/null 2>/dev/null || true
    elif [ -n "$project" ]; then
      docker compose --project-name "$project" down </dev/null 2>/dev/null || true
    fi
    if docker container inspect "$id" >/dev/null 2>&1; then
      docker rm -f "$id" >/dev/null
    fi
  done < <(
    docker ps -aq --filter "label=com.docker.compose.service=db" --filter "ancestor=ddal-postgres:18.7" 2>/dev/null || true
  )
}

copy_env_files
assign_port
stop_other_worktree_dbs
pnpm op:db:backup
pnpm op:db:local:restore
echo "Worktree ready. Run pnpm op:dev (or pnpm dev)."