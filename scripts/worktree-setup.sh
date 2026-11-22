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

# Containers of the `db` service from compose projects whose working directory is not this one.
stop_other_worktree_dbs() {
  [ -z "${SKIP_STOP_OTHERS:-}" ] || { echo "SKIP_STOP_OTHERS is set. Leaving other databases running."; return 0; }
  ensure_docker

  local id dir project
  while IFS= read -r id; do
    [ -n "$id" ] || continue
    dir=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$id")
    [ -n "$dir" ] && [ "$(cd "$dir" 2>/dev/null && pwd -P || echo "$dir")" != "$ROOT" ] || continue
    project=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$id")
    echo "Stopping database of another worktree: $dir (compose project $project)"
    # The other worktree may be gone; fall back to removing the container (the volume is kept).
    docker compose --project-name "$project" --project-directory "$dir" down 2>/dev/null || docker rm -f "$id" >/dev/null
  done < <(docker ps -aq --filter "label=com.docker.compose.service=db" --filter "ancestor=ddal-postgres:18.7")
}

copy_env_files
stop_other_worktree_dbs
pnpm op:db:backup
pnpm op:db:local:restore
echo "Worktree ready. Run pnpm op:dev (or pnpm dev)."
