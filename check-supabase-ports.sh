#!/bin/bash
# Fails when anything other than Docker listens on a local Supabase port. A port forward (for example
# from a Cursor agent running its own Supabase) binds 127.0.0.1 and takes precedence over Docker's
# wildcard listener, so the app and the Supabase CLI silently connect to the other database.

PORTS="54321,54322,54323,54324"

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof not found. Skipping the Supabase port check." >&2
  exit 0
fi

CONFLICTS=$(lsof -nP -iTCP:"$PORTS" -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 && $1 !~ /^(com\.docke|docker|vpnkit|OrbStack)/ { print "  " $1 " (PID " $2 ") on " $9 }' | sort -u)

if [ -n "$CONFLICTS" ]; then
  echo "Error: another process is listening on a local Supabase port:" >&2
  echo "$CONFLICTS" >&2
  echo "" >&2
  echo "Connections to these ports would go to that process instead of the Supabase containers in Docker." >&2
  echo "Stop the port forward (for example, close the Cursor agent session that runs Supabase) and try again." >&2
  exit 1
fi
