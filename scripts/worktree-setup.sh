#!/usr/bin/env bash
# One-shot setup for a fresh git worktree. Usage: scripts/worktree-setup.sh   (pnpm worktree:setup)
#   1. Copies .env.example.*local files to .env.*local (existing files are never overwritten).
#   2. Stops local DB containers started from other worktrees. docker-compose.yml pins the container
#      name and host port, so only one worktree's database can run at a time. Volumes are kept.
#   3. Runs `pnpm op:db:backup` (pulls a fresh production data dump into supabase/backups).
#   4. Runs `pnpm op:db:local:restore` (resets this worktree's database, loads the backup, and starts
#      its container).
# Set SKIP_STOP_OTHERS=1 to leave other worktrees' containers alone.
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

# Containers holding the pinned `ddal-postgres` name or running the `db` service from other
# compose projects (outside this worktree). Matching by container name catches containers whose
# image was rebuilt or retagged so `ancestor=ddal-postgres:18.7` no longer matches.
stop_other_worktree_dbs() {
  [ -z "${SKIP_STOP_OTHERS:-}" ] || { echo "SKIP_STOP_OTHERS is set. Leaving other databases running."; return 0; }
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
      echo "Removing conflicting container ddal-postgres ($id)"
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
    {
      docker ps -aq --filter "name=^/?ddal-postgres$" 2>/dev/null || true
      docker ps -aq --filter "label=com.docker.compose.service=db" --filter "ancestor=ddal-postgres:18.7" 2>/dev/null || true
    } | sort -u
  )
}

copy_env_files
stop_other_worktree_dbs
pnpm op:db:backup
pnpm op:db:local:restore
echo "Worktree ready. Run pnpm op:dev (or pnpm dev)."
