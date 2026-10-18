#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "[LuckyWheel] First-time setup: Installing dependencies..."
  npm install
fi

if [ ! -f "dist/index.html" ]; then
  echo "[LuckyWheel] Building production bundle..."
  npm run build
fi

echo "[LuckyWheel] Starting LuckyWheel Studio + Background Finder Engine..."
npx electron . &
exit 0
