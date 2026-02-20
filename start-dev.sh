#!/bin/bash
# MJ Web Dev Server - Bun 啟動腳本

cd /home/r7/mj-web

# 殺掉舊進程
pkill -f "vite.*5173" 2>/dev/null
pkill -f "bun.*dev" 2>/dev/null

echo "🚀 啟動 mj-web dev server (Bun)..."

# 用 bun 啟動（更快更穩定）
bun run dev --host 0.0.0.0
