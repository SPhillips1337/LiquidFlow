#!/bin/bash
set -e

echo "→ Stopping liquidflow-web..."
pm2 stop liquidflow-web || true
pm2 delete liquidflow-web || true

echo "✅ liquidflow-web stopped"