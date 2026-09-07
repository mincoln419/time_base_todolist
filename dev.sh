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
  (cd "$ROOT/server" && exec node index.js) &
  SERVER_PID=$!

  echo "Starting client (port 5173)..."
  (cd "$ROOT/client" && exec npm run dev) &
  CLIENT_PID=$!

  echo "$SERVER_PID $CLIENT_PID" > "$PID_FILE"
  echo "Started — server PID $SERVER_PID, client PID $CLIENT_PID"
  echo "Run '$0 stop' to shut down."

  wait
}

stop() {
  if [ -f "$PID_FILE" ]; then
    read -r SERVER_PID CLIENT_PID < "$PID_FILE"
    echo "Stopping server (PID $SERVER_PID) and client (PID $CLIENT_PID)..."
    kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
  else
    echo "No PID file found — cleaning up by port instead."
  fi

  # npm run dev가 vite를 별도 자식 프로세스로 띄우는 경우 등, 기록된 PID만으로는 못 잡는
  # 프로세스가 남을 수 있어 포트(3001/5173) 기준으로도 확실히 정리한다.
  # -sTCP:LISTEN 필수 — 이게 없으면 그 포트에 붙어있는 브라우저 탭 등 무관한 클라이언트
  # 프로세스까지 잡혀 죽일 위험이 있다(실제로 겪음: Chrome 헬퍼 프로세스가 함께 걸림).
  for port in 3001 5173; do
    pids=$(lsof -ti ":$port" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "Killing leftover process(es) on port $port: $pids"
      kill -9 $pids 2>/dev/null || true
    fi
  done
  echo "Stopped."
}

case "${1:-start}" in
  start) start ;;
  stop)  stop  ;;
  *) echo "Usage: $0 [start|stop]" ;;
esac
