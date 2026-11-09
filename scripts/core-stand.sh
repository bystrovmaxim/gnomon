#!/usr/bin/env bash
# scripts/core-stand.sh — Maxitor's core on this machine: its database, its backend and its application.
#
#   ./scripts/core-stand.sh up      PostgreSQL 16 in Docker on 55432, the role and schemas once, the migrations,
#                                   then the backend on 127.0.0.1:8020 and the application on http://localhost:3000
#                                   in the foreground; Ctrl+C stops both, the database keeps running
#   ./scripts/core-stand.sh down    stops the database
#   ./scripts/core-stand.sh reset   removes the database and everything in it
#
# Letters go to .core-stand/outbox/ as .eml files; the session secret is made once in .core-stand/secret.
# MAXITOR_GEOIP_DATABASE, if set, is passed to the backend; without it every address counts as Russia.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAND="$ROOT/.core-stand"
CONTAINER="maxitor-core-pg"
DB_PORT="${MAXITOR_STAND_DB_PORT:-55432}"
API_PORT="${MAXITOR_STAND_API_PORT:-8020}"
WEB_PORT="${MAXITOR_STAND_WEB_PORT:-3000}"
ADMIN_PASSWORD="admin-local"
CORE_PASSWORD="core-local"
WEB="$ROOT/packages/maxitor/maxitor-core/web"

say() { printf '\033[1m%s\033[0m\n' "$*"; }

database_up() {
  if [ -z "$(docker ps -aq -f "name=^${CONTAINER}$")" ]; then
    say "Starting PostgreSQL 16 on 127.0.0.1:$DB_PORT"
    docker run -d --name "$CONTAINER" -p "127.0.0.1:$DB_PORT:5432" \
      -e POSTGRES_PASSWORD="$ADMIN_PASSWORD" -e POSTGRES_DB=maxitor postgres:16 >/dev/null
  elif [ -z "$(docker ps -q -f "name=^${CONTAINER}$")" ]; then
    say "Starting the stopped database"
    docker start "$CONTAINER" >/dev/null
  fi
  for _ in $(seq 1 60); do
    docker exec "$CONTAINER" pg_isready -U postgres -d maxitor >/dev/null 2>&1 && break
    sleep 1
  done
  # The role, its schemas and the extensions, once, as the administrator (bootstrap.sql).
  if [ -z "$(docker exec "$CONTAINER" psql -U postgres -d maxitor -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'maxitor_core'")" ]; then
    say "Creating the role maxitor_core and its schemas"
    docker exec -i "$CONTAINER" psql -U postgres -d maxitor -v ON_ERROR_STOP=1 -v core_password="$CORE_PASSWORD" -q -f - \
      < "$ROOT/packages/maxitor/maxitor-core/maxitor/core/bootstrap.sql"
  fi
}

up() {
  mkdir -p "$STAND/outbox"
  [ -s "$STAND/secret" ] || { python3 -c 'import secrets; print(secrets.token_urlsafe(48))' > "$STAND/secret"; chmod 600 "$STAND/secret"; }
  database_up
  export MAXITOR_CORE_DSN="postgresql://maxitor_core:$CORE_PASSWORD@127.0.0.1:$DB_PORT/maxitor"
  export MAXITOR_SESSION_SECRET
  MAXITOR_SESSION_SECRET="$(cat "$STAND/secret")"
  export MAXITOR_MAIL_OUTBOX="$STAND/outbox"
  export MAXITOR_PUBLIC_URL="http://localhost:$WEB_PORT"
  say "Running the core's migrations as maxitor_core"
  (cd "$ROOT" && uv run --all-extras --all-packages maxitor-core migrate)
  [ -d "$WEB/node_modules" ] || (cd "$WEB" && npm ci --no-audit --no-fund)

  say "The backend on 127.0.0.1:$API_PORT, the application on http://localhost:$WEB_PORT — Ctrl+C stops both"
  (cd "$ROOT" && exec uv run --all-extras --all-packages maxitor-core serve --port "$API_PORT") &
  local api=$!
  (cd "$WEB" && MAXITOR_CORE_API="http://127.0.0.1:$API_PORT" exec npx next dev --port "$WEB_PORT") &
  local web=$!
  trap 'kill "$api" "$web" 2>/dev/null; wait "$api" "$web" 2>/dev/null; exit 0' INT TERM
  # Until either stops (bash 3.2 on macOS has no wait -n).
  while kill -0 "$api" 2>/dev/null && kill -0 "$web" 2>/dev/null; do sleep 1; done
  kill "$api" "$web" 2>/dev/null || true
  wait "$api" "$web" 2>/dev/null || true
}

case "${1:-}" in
  up) up ;;
  down) docker stop "$CONTAINER" >/dev/null 2>&1 && say "The database is stopped" || say "The database was not running" ;;
  reset) docker rm -f -v "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$STAND/outbox"; say "The database is removed" ;;
  *) echo "usage: $0 up|down|reset" >&2; exit 2 ;;
esac
