#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_PORT=${BACKEND_PORT:-5001}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
FRONTEND_HOST=${FRONTEND_HOST:-127.0.0.1}
BACKEND_HOST=${BACKEND_HOST:-127.0.0.1}

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found" >&2
  exit 1
fi

echo "==> Backend setup"
if [ ! -d "$BACKEND_DIR/.venv" ]; then
  python3 -m venv "$BACKEND_DIR/.venv"
fi

"$BACKEND_DIR/.venv/bin/python" -m pip install --quiet -r "$BACKEND_DIR/requirements.txt"

if ! lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "==> Starting backend on port $BACKEND_PORT"
  HOST="$BACKEND_HOST" PORT="$BACKEND_PORT" "$BACKEND_DIR/.venv/bin/python" "$BACKEND_DIR/app.py" > "$BACKEND_DIR/backend.log" 2>&1 &
else
  echo "==> Backend already running on port $BACKEND_PORT"
fi

echo "==> Frontend setup"
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  npm install --prefix "$FRONTEND_DIR" --cache "$FRONTEND_DIR/.npm-cache"
fi

if ! lsof -nP -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "==> Starting frontend on port $FRONTEND_PORT"
  npm run --prefix "$FRONTEND_DIR" dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" > "$FRONTEND_DIR/frontend.log" 2>&1 &
else
  echo "==> Frontend already running on port $FRONTEND_PORT"
fi

echo "==> Done"

FRONTEND_URL_HOST="$FRONTEND_HOST"
BACKEND_URL_HOST="$BACKEND_HOST"

if [ "$FRONTEND_HOST" = "0.0.0.0" ] || [ "$FRONTEND_HOST" = "::" ]; then
  FRONTEND_URL_HOST="127.0.0.1"
fi

if [ "$BACKEND_HOST" = "0.0.0.0" ] || [ "$BACKEND_HOST" = "::" ]; then
  BACKEND_URL_HOST="127.0.0.1"
fi

FRONTEND_URL="http://${FRONTEND_URL_HOST}:${FRONTEND_PORT}"
BACKEND_URL="http://${BACKEND_URL_HOST}:${BACKEND_PORT}"

echo "Frontend: ${FRONTEND_URL}"
echo "Backend:  ${BACKEND_URL}"

if command -v curl >/dev/null 2>&1; then
  if ! curl --silent --fail "${FRONTEND_URL}" >/dev/null 2>&1; then
    echo "Frontend did not respond yet. Check ${FRONTEND_DIR}/frontend.log"
  fi
  if ! curl --silent --fail "${BACKEND_URL}/api/health" >/dev/null 2>&1; then
    echo "Backend did not respond yet. Check ${BACKEND_DIR}/backend.log"
  fi
fi
