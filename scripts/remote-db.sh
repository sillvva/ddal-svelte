#!/usr/bin/env bash
# Sourced by the op:db:* scripts. Splits REMOTE_DB_URL (supplied by `op run`) into its parts so the
# password can travel in the environment instead of on a command line, where `ps` would show it.
#
# Sets: REMOTE_HOST, REMOTE_PORT, REMOTE_PASSWORD (percent-decoded, may be empty),
#       REMOTE_URL_NO_PASSWORD (postgresql://user@host:port/db?params), REMOTE_URL_SQLALCHEMY
#       (the full URL with the postgresql:// scheme, which is the only one SQLAlchemy/migra accepts).

parse_remote_url() {
  : "${REMOTE_DB_URL:?REMOTE_DB_URL is not set. Run this through op run (pnpm op:db:*).}"
  case "$REMOTE_DB_URL" in
    postgres://* | postgresql://*) ;;
    *)
      echo "Error: REMOTE_DB_URL must start with postgres:// or postgresql://." >&2
      return 1
      ;;
  esac

  local rest=${REMOTE_DB_URL#*://}
  local authority=${rest%%[/?]*}
  local tail=${rest#"$authority"}
  local userinfo="" hostport=$authority
  if [[ $authority == *@* ]]; then
    userinfo=${authority%@*}
    hostport=${authority##*@}
  fi

  REMOTE_HOST=${hostport%%:*}
  REMOTE_PORT=5432
  if [[ $hostport == *:* ]]; then REMOTE_PORT=${hostport##*:}; fi
  if [ -z "$REMOTE_HOST" ]; then
    echo "Error: REMOTE_DB_URL has no host." >&2
    return 1
  fi

  local user=${userinfo%%:*} raw_password=""
  if [[ $userinfo == *:* ]]; then raw_password=${userinfo#*:}; fi
  # Percent-decode: escape backslashes first so printf %b only expands our own \xHH sequences.
  raw_password=${raw_password//\\/\\\\}
  REMOTE_PASSWORD=$(printf '%b' "${raw_password//%/\\x}")

  if [ -n "$user" ]; then
    REMOTE_URL_NO_PASSWORD="postgresql://${user}@${hostport}${tail}"
  else
    REMOTE_URL_NO_PASSWORD="postgresql://${hostport}${tail}"
  fi
  REMOTE_URL_SQLALCHEMY="postgresql://${REMOTE_DB_URL#*://}"
}
