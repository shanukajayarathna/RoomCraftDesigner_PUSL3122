#!/bin/bash
# ── RoomCraft Designer — Quick Start ──────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       RoomCraft Designer v1.0.0          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Start backend in a subshell so cd is isolated
echo "▶ Starting Spring Boot backend on port 8080..."
(cd "$ROOT_DIR/backend" && mvn spring-boot:run -q) &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend to start (up to 30s)..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8080/api/auth/login -o /dev/null 2>/dev/null; then
    echo "  ✅ Backend is up!"
    break
  fi
  sleep 1
done

# Start frontend in a subshell so cd is isolated
echo "▶ Starting React frontend on port 5173..."
(cd "$ROOT_DIR/frontend" && npm install --silent && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "✅ RoomCraft Designer is running!"
echo ""
echo "  🌐 App:    http://localhost:5173"
echo "  🔧 API:    http://localhost:8080/api"
echo "  🗄️  H2 DB:  http://localhost:8080/h2-console"
echo ""
echo "  👤 Demo:   demo  / demo123"
echo "  🔑 Admin:  admin / admin123"
echo ""
echo "Press Ctrl+C to stop."
echo ""

# Cleanup on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait $BACKEND_PID $FRONTEND_PID
