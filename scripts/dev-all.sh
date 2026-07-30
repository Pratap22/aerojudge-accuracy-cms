#!/usr/bin/env bash
# Start all NPHA Accuracy CMS development services (run from repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           NPHA Accuracy CMS – Development Ports              ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Admin portal        http://localhost:3000                   ║"
echo "║  Judge terminal      http://localhost:3001                   ║"
echo "║  Display board       http://localhost:3002                   ║"
echo "║  Public results      http://localhost:3003                   ║"
echo "║  Announcer console   http://localhost:3004                   ║"
echo "║  Broadcast overlay   http://localhost:3005                   ║"
echo "║  API + Swagger       http://localhost:4000/api/v1            ║"
echo "║                      http://localhost:4000/api/docs          ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Default admin: admin@npha.org.np / NphaAdmin@2024!          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Starting turbo dev (all workspaces)…"
echo "Press Ctrl+C to stop."
echo ""

npm run dev
