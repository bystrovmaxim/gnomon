#!/usr/bin/env bash
# scripts/core-stand.sh — Maxitor's core on this machine: its database, its backend, its plugin installer, its plugin
# runner and its application with the gateway.
#
#   ./scripts/core-stand.sh up      PostgreSQL 16 in Docker on 55432, the roles and schemas once, the migrations,
#                                   the marketplace filled with the plugin template's wheel once, then the backend on
#                                   127.0.0.1:8020, the installer, the runner and the application on
#                                   http://localhost:3000 in the foreground; Ctrl+C stops them, the database keeps running
#   ./scripts/core-stand.sh down    stops the database
#   ./scripts/core-stand.sh reset   removes the database and everything in it
#
# Letters go to .core-stand/outbox/ as .eml files; with MAXITOR_STAND_MAIL=postbox they are sent for real through
# Yandex Cloud Postbox with the key .private/postbox/postbox-key.json of the main checkout.
# The session secret is made once in .core-stand/secret.
# MAXITOR_GEOIP_DATABASE, if set, is passed to the backend; else .private/geoip/country.mmdb of the main checkout is used
# when it exists; without a country database every address counts as Russia.
# Plugin wheels are kept in .core-stand/wheels, each deployed version's environment file in .core-stand/plugins.
# The gateway's Ed25519 key is made once in .core-stand/gateway-key.pem. The wheels a plugin needs that are not on
# PyPI yet — AOA's and the plugin SDK's — are built once into .core-stand/find-links. Each enabled plugin version runs
# in Docker containers of its own; they reach the database as maxitor-db on their version's network and the gateway
# as host.docker.internal.
# MAXITOR_STAND_CONTAINER, MAXITOR_STAND_DB_PORT, MAXITOR_STAND_API_PORT and MAXITOR_STAND_WEB_PORT run a second stand
# beside a first one; its plugin runner takes the container's name, so each stand starts and removes only its own
# plugin containers and networks.
# The plugin template's wheel carries its built frontend: npm builds it before the wheel is made.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAND="$ROOT/.core-stand"
CONTAINER="${MAXITOR_STAND_CONTAINER:-maxitor-core-pg}"
DB_PORT="${MAXITOR_STAND_DB_PORT:-55432}"
API_PORT="${MAXITOR_STAND_API_PORT:-8020}"
WEB_PORT="${MAXITOR_STAND_WEB_PORT:-3000}"
if [ "$CONTAINER" = "maxitor-core-pg" ]; then RUNNER="maxitor"; else RUNNER="$CONTAINER"; fi
ADMIN_PASSWORD="admin-local"
CORE_PASSWORD="core-local"
INSTALLER_PASSWORD="installer-local"
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
    say "Creating the roles maxitor_core and maxitor_installer and the core's schemas"
    docker exec -i "$CONTAINER" psql -U postgres -d maxitor -v ON_ERROR_STOP=1 -v core_password="$CORE_PASSWORD" \
      -v installer_password="$INSTALLER_PASSWORD" -q -f - \
      < "$ROOT/packages/maxitor/maxitor-core/maxitor/core/bootstrap.sql"
  fi
}

up() {
  mkdir -p "$STAND/outbox" "$STAND/wheels" "$STAND/plugins"
  [ -s "$STAND/secret" ] || { python3 -c 'import secrets; print(secrets.token_urlsafe(48))' > "$STAND/secret"; chmod 600 "$STAND/secret"; }
  if [ ! -s "$STAND/gateway-key.pem" ]; then
    (cd "$ROOT" && uv run --all-extras --all-packages python -c '
import sys
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
pem = Ed25519PrivateKey.generate().private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
open(sys.argv[1], "wb").write(pem)
' "$STAND/gateway-key.pem")
    chmod 600 "$STAND/gateway-key.pem"
  fi
  if [ -z "$(ls "$STAND/find-links"/*.whl 2>/dev/null)" ]; then
    say "Building the wheels plugins need that PyPI does not have yet"
    for package in external/aoa/packages/aoa-action-machine external/aoa/packages/aoa-fastapi-adapter packages/maxitor-plugin-sdk; do
      (cd "$ROOT" && uv build --wheel -q -o "$STAND/find-links" "$package")
    done
  fi
  database_up
  export MAXITOR_CORE_DSN="postgresql://maxitor_core:$CORE_PASSWORD@127.0.0.1:$DB_PORT/maxitor"
  export MAXITOR_SESSION_SECRET
  MAXITOR_SESSION_SECRET="$(cat "$STAND/secret")"
  export MAXITOR_PUBLIC_URL="http://localhost:$WEB_PORT"
  # A page that does not render the shell of @maxitor/panel is marked by a red strip on the stand.
  export NEXT_PUBLIC_MAXITOR_MARK_UNFRAMED=1
  export MAXITOR_WHEEL_STORE="$STAND/wheels" MAXITOR_PLUGIN_RUNTIME="$STAND/plugins"
  export MAXITOR_GATEWAY_KEY_FILE="$STAND/gateway-key.pem"
  local installer_dsn="postgresql://maxitor_installer:$INSTALLER_PASSWORD@127.0.0.1:$DB_PORT/maxitor"
  # The country database and the Postbox key live outside git, in .private of the main checkout.
  local main_checkout
  main_checkout="$(cd "$(git -C "$ROOT" rev-parse --git-common-dir)/.." && pwd)"
  if [ "${MAXITOR_STAND_MAIL:-outbox}" = "postbox" ]; then
    export MAXITOR_POSTBOX_KEY_FILE="${MAXITOR_POSTBOX_KEY_FILE:-$main_checkout/.private/postbox/postbox-key.json}"
    [ -f "$MAXITOR_POSTBOX_KEY_FILE" ] || { echo "no Postbox key at $MAXITOR_POSTBOX_KEY_FILE" >&2; exit 1; }
    unset MAXITOR_MAIL_OUTBOX
    say "Letters: sent through Yandex Cloud Postbox"
  else
    export MAXITOR_MAIL_OUTBOX="$STAND/outbox"
    say "Letters: written to $MAXITOR_MAIL_OUTBOX"
  fi
  if [ -z "${MAXITOR_GEOIP_DATABASE:-}" ] && [ -f "$main_checkout/.private/geoip/country.mmdb" ]; then
    export MAXITOR_GEOIP_DATABASE="$main_checkout/.private/geoip/country.mmdb"
  fi
  say "Country database: ${MAXITOR_GEOIP_DATABASE:-none, every address counts as Russia}"
  say "Running the core's migrations as maxitor_core"
  (cd "$ROOT" && uv run --all-extras --all-packages maxitor-core migrate)
  [ -d "$WEB/node_modules" ] || (cd "$WEB" && npm ci --no-audit --no-fund)
  if [ "$(docker exec "$CONTAINER" psql -U postgres -d maxitor -tAc "SELECT count(*) FROM plugins.plugin")" = "0" ]; then
    say "Filling the marketplace with the plugin template's wheel"
    rm -rf "$STAND/dist"
    (cd "$ROOT/packages/maxitor-plugin-template/web" && npm ci --no-audit --no-fund && npm run build)
    (cd "$ROOT" && uv build --wheel -q -o "$STAND/dist" packages/maxitor-plugin-template)
    (cd "$ROOT" && MAXITOR_INSTALLER_DSN="$installer_dsn" uv run --all-extras --all-packages maxitor-plugin-installer add-wheel "$STAND"/dist/*.whl)
  fi

  say "The backend on 127.0.0.1:$API_PORT, the installer, the runner, the application on http://localhost:$WEB_PORT — Ctrl+C stops them"
  (cd "$ROOT" && exec uv run --all-extras --all-packages maxitor-core serve --port "$API_PORT") &
  local api=$!
  (cd "$ROOT" && MAXITOR_CORE_DSN="" MAXITOR_INSTALLER_DSN="$installer_dsn" MAXITOR_INSTALLER_PERIOD_SECONDS=5 \
    exec uv run --all-extras --all-packages maxitor-plugin-installer run) &
  local installer=$!
  (cd "$ROOT" && MAXITOR_PLUGIN_FIND_LINKS="$STAND/find-links" MAXITOR_PLUGIN_DB_ADDRESS="maxitor-db:5432" \
    MAXITOR_PLUGIN_DB_CONTAINER="$CONTAINER" MAXITOR_PLUGIN_GATEWAY_URL="http://host.docker.internal:$WEB_PORT" \
    MAXITOR_RUNNER_PERIOD_SECONDS=5 MAXITOR_RUNNER_NAME="$RUNNER" \
    exec uv run --all-extras --all-packages maxitor-plugin-runner run) &
  local runner=$!
  (cd "$WEB" && MAXITOR_CORE_API="http://127.0.0.1:$API_PORT" exec npx next dev --port "$WEB_PORT") &
  local web=$!
  trap 'kill "$api" "$installer" "$runner" "$web" 2>/dev/null; wait "$api" "$installer" "$runner" "$web" 2>/dev/null; exit 0' INT TERM
  # Until one stops (bash 3.2 on macOS has no wait -n).
  while kill -0 "$api" 2>/dev/null && kill -0 "$installer" 2>/dev/null && kill -0 "$runner" 2>/dev/null \
    && kill -0 "$web" 2>/dev/null; do sleep 1; done
  kill "$api" "$installer" "$runner" "$web" 2>/dev/null || true
  wait "$api" "$installer" "$runner" "$web" 2>/dev/null || true
}

case "${1:-}" in
  up) up ;;
  down) docker stop "$CONTAINER" >/dev/null 2>&1 && say "The database is stopped" || say "The database was not running" ;;
  reset)
    docker ps -aq --filter label=maxitor.plugin.version --filter "label=maxitor.plugin.runner=$RUNNER" | xargs docker rm -f >/dev/null 2>&1 || true
    docker rm -f -v "$CONTAINER" >/dev/null 2>&1 || true
    rm -rf "$STAND/outbox" "$STAND/wheels" "$STAND/plugins" "$STAND/dist" "$STAND/find-links"
    say "The database and the plugin containers are removed" ;;
  *) echo "usage: $0 up|down|reset" >&2; exit 2 ;;
esac
