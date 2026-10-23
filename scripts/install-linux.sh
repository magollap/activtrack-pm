#!/usr/bin/env bash
# Installs Workday on Linux: checks Node.js, builds the app and optionally sets up a systemd service.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
SERVICE_NAME="workday"

info() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

info "Checking Node.js"
command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node.js 22 or newer from https://nodejs.org and run this script again."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Node.js 22 or newer is required (found $(node -v))."
fi
command -v npm >/dev/null 2>&1 || fail "npm is not installed."
echo "Found Node.js $(node -v)"

cd "$APP_DIR"
info "Installing packages (npm ci)"
npm ci

info "Building Workday (npm run build)"
npm run build

ANSWER="${WORKDAY_SERVICE:-}"
if [ -z "$ANSWER" ]; then
  read -r -p "Create a systemd service so Workday starts on boot? [y/N] " ANSWER || ANSWER="n"
fi

case "$ANSWER" in
  [yY]|[yY][eE][sS])
    command -v systemctl >/dev/null 2>&1 || fail "systemctl was not found. This system does not use systemd."
    SUDO=""
    [ "$(id -u)" -ne 0 ] && SUDO="sudo"
    NODE_BIN="$(command -v node)"
    RUN_USER="${SUDO_USER:-$(id -un)}"
    UNIT="/etc/systemd/system/${SERVICE_NAME}.service"

    info "Writing $UNIT"
    $SUDO tee "$UNIT" >/dev/null <<EOF
[Unit]
Description=Workday task manager
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
Environment=HOST=${HOST}
Environment=DATA_DIR=${APP_DIR}/data
ExecStart=${NODE_BIN} ${APP_DIR}/server/server.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

    info "Enabling and starting the service"
    $SUDO systemctl daemon-reload
    $SUDO systemctl enable --now "$SERVICE_NAME"
    echo
    echo "Workday is running at http://localhost:${PORT}"
    echo "Data is stored in:  ${APP_DIR}/data (back up this folder)"
    echo "The first person to sign up becomes the admin."
    echo "Check status:  sudo systemctl status ${SERVICE_NAME}"
    echo "View logs:     sudo journalctl -u ${SERVICE_NAME} -f"
    ;;
  *)
    echo
    echo "Build complete. Start Workday with:"
    echo "  cd \"$APP_DIR\" && PORT=${PORT} npm start"
    echo "Then open http://localhost:${PORT}. The first person to sign up becomes the admin."
    ;;
esac
