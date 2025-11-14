#!/bin/bash
if pgrep -f "Docker" >/dev/null; then
  echo "Docker is already running."
else
  echo "Starting Docker..."
  START_TIME=$(date +%s)
  if ! open -a "Docker" 2>/dev/null; then
    echo "Error: Docker app not found. Please install Docker Desktop." >&2
    exit 1
  fi
  echo "Waiting for Docker process to start..."
  while ! pgrep -f "Docker" >/dev/null; do
    sleep 1
  done
  echo "Waiting for Docker daemon to be ready..."
  while ! docker info >/dev/null 2>&1; do
    sleep 2
  done
  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))
  echo "Docker is fully started and ready. (took ${ELAPSED}s)"
  echo ""

  echo "It may take a few seconds for the supabase containers to be ready."
  CONTAINER_ID=""
  while [ -z "$CONTAINER_ID" ]; do
    CONTAINER_ID=$(docker ps --format '{{.ID}} {{.Names}}' | grep 'supabase_kong' | awk '{print $1}' | head -n1)
    sleep 2
  done

  HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_ID 2>/dev/null)
  if [ "$HEALTH_STATUS" != "" ]; then
    echo "Waiting for container (${CONTAINER_ID}) to be healthy..."
    while [[ "$(docker inspect --format='{{.State.Health.Status}}' $CONTAINER_ID 2>/dev/null)" != "healthy" ]]; do
      sleep 2
    done
    echo "Container is healthy."
  else
    echo "No healthcheck found for container (${CONTAINER_ID})."
  fi
  echo ""
fi
supabase start