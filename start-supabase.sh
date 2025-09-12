#!/bin/bash
if pgrep -f "Docker Desktop" >/dev/null; then
  echo "Docker Desktop is already running."
else
  echo "Starting Docker Desktop..."
  open -a "Docker Desktop"
  echo "Waiting for Docker Desktop process to start..."
  while ! pgrep -f "Docker Desktop" >/dev/null; do
    sleep 1
  done
  echo "Waiting for Docker daemon to be ready..."
  while ! docker info >/dev/null 2>&1; do
    sleep 2
  done
  echo "Docker Desktop is fully started and ready."
  echo ""

  echo "It may take a few seconds for the supabase containers to be ready."
  CONTAINER_ID=""
  while [ -z "$CONTAINER_ID" ]; do
    CONTAINER_ID=$(docker ps --format '{{.ID}} {{.Names}}' | grep 'supabase_kong' | awk '{print $1}' | head -n1)
    sleep 2
  done

  HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_ID 2>/dev/null)
  if [ "$HEALTH_STATUS" != "" ]; then
    echo "Waiting for container ($CONTAINER_ID) to be healthy..."
    while [[ "$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_ID 2>/dev/null)" != "healthy" ]]; do
      sleep 2
    done
    echo "Container is healthy."
  else
    echo "No healthcheck found for container ($CONTAINER_ID)."
  fi
  echo ""
fi
supabase start