#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "→ Building LiquidFlow web..."
npm run build

echo "→ Starting with PM2 (liquidflow-web)..."
pm2 start npm --name "liquidflow-web" -- start -- -p 3000

pm2 save
echo "✅ liquidflow-web running on :3000 (use nginx to proxy)"