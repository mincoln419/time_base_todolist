#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT/.dev.pids"

start() {
  if [ -f "$PID_FILE" ]; then
    echo "Already running. Run '$0 stop' first."
    exit 1
  fi

  echo "Installing server dependencies..."
  cd "$ROOT/server" && npm install --silent

  echo "Installing client dependencies..."
  cd "$ROOT/client" && npm install --silent

  echo "Starting server (port 3001)..."
  cd "$ROOT/server" && node index.js &
  SERVER_PID=$!

  echo "Starting client (port 5173)..."
  cd "$ROOT/client" && npm run dev &
  CLIENT_PID=$!

  echo "$SERVER_PID $CLIENT_PID" > "$PID_FILE"
  echo "Started — server PID $SERVER_PID, client PID $CLIENT_PID"
  echo "Run '$0 stop' to shut down."

  wait
}

stop() {
  if [ ! -f "$PID_FILE" ]; then
    echo "No running processes found."
    exit 0
  fi

  read -r SERVER_PID CLIENT_PID < "$PID_FILE"
  echo "Stopping server (PID $SERVER_PID) and client (PID $CLIENT_PID)..."

  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Stopped."
}

case "${1:-start}" in
  start) start ;;
  stop)  stop  ;;
  *) echo "Usage: $0 [start|stop]" ;;
esac
