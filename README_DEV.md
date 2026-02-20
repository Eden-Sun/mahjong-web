# MJ Web - Dev Server 快速管理

## 🚀 啟動（Bun）

```bash
# 方法 1: 直接啟動（前台）
bash /home/r7/mj-web/start-dev.sh

# 方法 2: tmux 背景啟動（推薦）
tmux kill-session -t mj-web 2>/dev/null
tmux new-session -d -s mj-web
tmux send-keys -t mj-web "bash /home/r7/mj-web/start-dev.sh" Enter
```

## 📊 檢查狀態

```bash
# 快速檢查
curl -s http://localhost:5173 && echo "✅ Running" || echo "❌ Down"

# 查看日誌
tmux attach -t mj-web
# 按 Ctrl+B 再按 D 離開
```

## 🔄 重啟

```bash
tmux kill-session -t mj-web 2>/dev/null
tmux new-session -d -s mj-web
tmux send-keys -t mj-web "bash /home/r7/mj-web/start-dev.sh" Enter
```

## 🤖 Claude Code Task

在 `/home/r7/mj-web` 執行：

```
重啟 dev server
```

Claude Code 會讀取 `.clinerules` 並執行對應指令。

---

**當前狀態：**
- ✅ Dev server 已用 bun 啟動
- ✅ 運行在 http://localhost:5173
- ✅ tmux session: `mj-web`
