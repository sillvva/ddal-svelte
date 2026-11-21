#!/usr/bin/env bash
# Sourced by the db scripts. Ensures the Docker daemon is reachable (macOS: starts OrbStack).
DOCKER_START_TIMEOUT="${DOCKER_START_TIMEOUT:-120}"

ensure_docker() {
  command -v docker >/dev/null 2>&1 || { echo "Error: docker not found. On macOS install OrbStack (brew install orbstack); on Linux install Docker Engine." >&2; exit 1; }
  docker info >/dev/null 2>&1 && return 0

  if [ "$(uname -s)" != "Darwin" ] || [ -n "${CI:-}" ]; then
    echo "Error: the Docker daemon is not reachable. Start Docker and try again." >&2
    exit 1
  fi

  echo "Docker is not running. Starting OrbStack..."
  open -a OrbStack 2>/dev/null || { echo "Error: OrbStack not found. Install it with: brew install orbstack" >&2; exit 1; }
  local waited=0
  until docker info >/dev/null 2>&1; do
    if [ "$waited" -ge "$DOCKER_START_TIMEOUT" ]; then
      echo "Error: Docker did not become ready within ${DOCKER_START_TIMEOUT}s. Check OrbStack and try again." >&2
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo "Docker is ready (took ${waited}s)."
}
