#!/usr/bin/env bash
# meet-at-tiny-desk.sh — Move Mochi and Nova to a shared tiny desk
# Prereq: add tiny desk at (5,5) to objects[] in createSeedRoomSnapshot() in kernel.ts
set -euo pipefail
API="${API_URL:-http://localhost:3001}"

curl -sf -X POST "$API/rooms/main/reset" -H 'Content-Type: application/json' \
  -d '{"seed":"tiny-desk-demo"}' > /dev/null

curl -sf -X POST "$API/rooms/main/events" -H 'Content-Type: application/json' -d '{
  "summary": "A tiny desk appears between the couch and the build desk. Mochi and Nova head over to meet there.",
  "significance": "high"
}' > /dev/null

curl -sf -X POST "$API/tasks" -H 'Content-Type: application/json' -d '{
  "title": "Pair up at the tiny desk",
  "description": "Mochi and Nova meet at the tiny desk to review and build together.",
  "riskLevel": "low"
}' > /dev/null

echo "Task created. Ticking room until both pets arrive at (5,5)..."
for i in $(seq 1 20); do
  sleep 2
  curl -sf "$API/rooms/main" | jq '.pets[] | select(.name == "Mochi" or .name == "Nova") | "\(.name): (\(.position.x),\(.position.y))"'
done
