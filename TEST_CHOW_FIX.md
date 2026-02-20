# 吃牌功能測試指南

## 已完成的修復

✅ 添加完整的錯誤處理（try-catch）
✅ 添加詳細的調試日誌
✅ 確認 ChowSelector 初始化日誌

## 測試步驟

### 1. 訪問遊戲
打開瀏覽器，訪問: http://localhost:5173

### 2. 開啟 Console
按 F12 打開開發者工具，切換到 Console 標籤

### 3. 開始遊戲
點擊「開始新遊戲」

### 4. 等待吃牌機會
遊戲會自動進行，等待出現「➡️ 吃」按鈕

### 5. 點擊吃牌
點擊「➡️ 吃」按鈕，觀察：

#### 預期看到的 Console 輸出（正常流程）:
```
🎮 playerResponse 被調用: {action: "chow", ...}
🍴 吃牌選項: {手牌: [...], 目標牌: "...", 選項數量: N, 選項: [...]}
```

**如果只有一種吃法:**
```
✅ 只有一種吃法，直接執行: ["1m", "2m", "3m"]
🎯 gameController.playerResponse 被調用: {action: "chow", tiles: [...]}
🍴 開始執行吃牌: ...
🍴 executeChow 結果: {success: true, ...}
```

**如果有多種吃法:**
```
🔄 顯示吃牌選擇器（多個選項）
🔄 showChowSelector 被調用，選項: [...]
✅ ChowSelector 已插入 DOM
```

**點擊選項後:**
```
🎯 selectChowOption 被調用: {index: 0, options: [...]}
📋 選中的選項: {tiles: [...], with: "..."}
✅ 調用回調，傳入 tiles: [...]
🎯 Promise resolve 被調用，tiles: [...]
📋 用戶選擇: [...]
✅ 執行吃牌: [...]
🎯 gameController.playerResponse 被調用: {action: "chow", tiles: [...]}
```

### 6. 檢查錯誤
如果出現錯誤，Console 會顯示：
```
❌ playerResponse 錯誤: ...
```
或彈出 alert 顯示錯誤信息。

## 常見問題檢查

### 問題 A: 點擊按鈕沒反應
**檢查:**
- Console 是否有 `🎮 playerResponse 被調用`？
  - 沒有 → 按鈕 onclick 沒有綁定
  - 有 → 繼續下一步

### 問題 B: 顯示「無法吃牌」
**檢查:**
- Console 中的 `🍴 吃牌選項` 的 `選項數量` 是否為 0？
  - 是 → 手牌不符合吃牌條件（需要連續序數牌）
  - 否 → 檢查其他錯誤

### 問題 C: ChowSelector 對話框不出現
**檢查:**
- Console 是否有 `🔄 showChowSelector 被調用`？
  - 沒有 → options.length <= 1，直接執行
  - 有但沒有 `✅ ChowSelector 已插入 DOM` → DOM 插入失敗

### 問題 D: 點擊選項後沒反應
**檢查:**
- Console 是否有 `🎯 selectChowOption 被調用`？
  - 沒有 → onclick 沒有綁定到全局函數
  - 有但沒有 `✅ 調用回調` → callback 為 null

### 問題 E: 吃牌執行失敗
**檢查:**
- Console 中的 `🍴 executeChow 結果` 的 `success` 是否為 false？
  - 是 → 手牌不符合要求，檢查 tiles 格式

## 下一步

將 Console 的完整輸出（包括錯誤）複製發送，我會根據日誌進一步診斷。
