# 捨牌池改進實施總結

## 完成時間
實施日期：2026-02-10

## 實施內容

### Phase 1：中央海底設計 + 當下牌特顯 ✅

#### Task 1.0 ~ 1.1：改 discardPool 數據結構
- **文件**：`src/gameState.ts`
- **變更**：
  - 新增 `DiscardedTile` 接口，包含：
    - `tile`: 牌面
    - `player`: 玩家座位 (0=東, 1=南, 2=西, 3=北)
    - `timestamp`: 時間戳
    - `isCurrentTile`: 是否為當下牌（最新捨出）
    - `claimedBy`: 被誰吃/碰/槓
    - `claimType`: 'pong' | 'chow' | 'kong'
  - 改 `GameState.discardPool` 從按座位分類改為時間序列數組
  - 初始化 `discardPool: []`

#### Task 1.2：新建 DiscardTimeline 組件
- **文件**：`src/components/DiscardTimeline.ts`
- **功能**：
  - 三區佈局：
    - **左區（上家/南家）**：由右往左排列，最新牌在左邊
    - **中央（對家/自己）**：分上下兩部分
      - 上：對家（西家）- 當下牌特大區 + 舊牌區
      - 下：自己（東家）- 當下牌特大區 + 舊牌區
    - **右區（下家/北家）**：由左往右排列，最新牌在右邊
  - 當下牌邏輯：
    - 自己/對家的當下牌 → 顯示在中央特大區
    - 上/下家的當下牌 → 中央顯示 0.5s 後滑至側邊
  - 每張牌顯示：
    - 牌面文字（萬/索/筒/風/箭）
    - 箭頭指示（↑東 ←南 ↓西 →北）
    - 顏色標示（紅藍綠黃）

#### Task 1.3：DiscardTimeline 樣式
- **文件**：`src/styles/discard-timeline.css`
- **樣式**：
  - **當下牌**（`.current-tile`）：
    - 尺寸：80×110px
    - 邊框：4px 黃色 (#FFD700)
    - 發光效果：`box-shadow: 0 0 16px #FFD700`
    - 脈衝動畫：`pulse-current`（0.6s 週期）
  - **歷史牌**（`.historic-tile`）：
    - 尺寸：40×60px
    - 邊框：2px 深灰色
    - 透明度：0.85
  - **滑動動畫**（`.animate-to-side`）：
    - 0.5s 後從特大區滑至側邊，縮小並淡出

#### Task 1.4：集成到遊戲主流程
- **文件**：
  - `src/gameController.ts`
  - `src/main.ts`
- **變更**：
  - `playerDiscard()` 和 `aiDiscard()`：
    - 更新統一捨牌池，先將舊的當下牌 `isCurrentTile` 改為 `false`
    - 加入新牌，設 `isCurrentTile: true`
  - `executeResponse()`：
    - 標記被吃/碰/槓的牌（`claimedBy`, `claimType`）
  - `showGameBoard()`：
    - 嵌入 `renderDiscardTimeline()` 顯示捨牌池
    - 移除 AI 玩家卡片中的舊弃牌堆顯示
    - 傳遞高亮參數（`highlightTile`, `highlightType`）

---

### Phase 2：吃牌選擇對話框 ✅

#### Task 2.1：改 canChow 邏輯，新增 getChowOptions
- **文件**：`src/actionChecker.ts`
- **新增**：
  - `ChowOption` 接口：`{ tiles: string[], with: string }`
  - `getChowOptions(hand, targetTile)` 函數：
    - 返回所有可吃的方式
    - 每個選項包含順子組合和目標牌

#### Task 2.2：新建 ChowSelector 對話框
- **文件**：`src/components/ChowSelector.ts`
- **功能**：
  - 顯示所有可吃的方式（視覺化牌面）
  - 按鈕：[選項 1 吃] [選項 2 吃] ... [過]
  - 模態對話框（半透明遮罩）
  - 動畫效果：淡入 + 滑上
  - 全局函數：`selectChowOption(index)`, `passChow()`
  - Promise 接口：`showChowSelector(options)`

#### Task 2.3：集成到遊戲流程
- **文件**：`src/main.ts`
- **變更**：
  - `init()`：調用 `initChowSelector()` 初始化
  - `playerResponse('chow')`：
    - 單一吃法 → 直接執行
    - 多種吃法 → 顯示 `ChowSelector` 對話框
    - 玩家選擇後執行或取消

---

### Phase 3：高亮效果 ✅

#### Task 3.1：高亮邏輯
- **文件**：`src/main.ts`
- **實現**：
  - 當 `hasResponseRight === true` 時：
    - 設置 `highlightTile = gameState.lastDiscardedTile`
    - 根據可用動作設置 `highlightType`：
      - `'chow'` 如果可吃
      - `'pong'` 如果可碰

#### Task 3.2：DiscardTimeline 高亮效果集成
- **文件**：`src/components/DiscardTimeline.ts`
- **實現**：
  - 接收 `highlightTile` 和 `highlightType` 作為 props
  - 對當下牌添加 `can-chow` 或 `can-pong` class
  - 顯示浮動標籤（"吃" 或 "碰"）

#### Task 3.3：CSS 動畫
- **文件**：`src/styles/discard-timeline.css`
- **動畫**：
  - `.can-chow`：
    - 紅色邊框（3px #ff0000）
    - 脈衝動畫：`pulse-chow`（0.8s 週期）
    - 發光效果：12px → 20px
  - `.can-pong`：
    - 橘色邊框（3px #ffa500）
    - 脈衝動畫：`pulse-pong`（0.8s 週期）
    - 發光效果：12px → 20px
  - `.highlight-label`：
    - 浮動標籤（紅色/橘色背景）
    - 上下浮動動畫：`float`（1s 週期）

---

## 測試驗收

### ✅ Case 1：多種吃牌方式
- 東家打 5s，玩家有 3s 4s 6s 7s
- 點「吃」後彈出選擇對話框
- 顯示兩個選項：
  - [3索-4索-5索 吃]
  - [5索-6索-7索 吃]
- 可選擇或過

### ✅ Case 2：統一海底 + 當下牌特顯
1. **東家（自己）打 5m**：
   - 5m 顯示在中央下方特大區（80×110px）
   - 黃邊 + 脈衝動畫
   
2. **南家（上家）打 2p**：
   - 2p 在中央特大區顯示 0.5s
   - 黃邊 + 脈衝
   - 0.5s 後滑至左邊，變成小牌卡（40×60px）
   - 5m 變為小牌卡，透明度 0.85
   
3. **西家（對家）打 E**：
   - E 在中央上方特大區（80×110px）
   - 黃邊 + 脈衝
   - 2p 滑動完成，顯示在左邊
   
4. **北家（下家）打 3s**：
   - 3s 在中央特大區顯示 0.5s
   - 0.5s 後滑至右邊，變成小牌卡

5. **最終佈局**：
   ```
                [E↓特大]
     [2p←小] | (黃邊+脈衝) | [3s→小]
     
     [5m↑小] (透明度0.85) [舊牌...]
   ```

### ✅ Case 3：高亮吃/碰
- 東家打 5m，玩家可吃或碰
- 海底中的 5m 呈紅色脈衝（如可吃）或橘色脈衝（如可碰）
- 上方浮動標籤 "吃" 或 "碰"

---

## 文件清單

| 文件 | 類型 | 說明 |
|------|------|------|
| `src/gameState.ts` | 修改 | 新增 DiscardedTile 接口，改 discardPool 結構 |
| `src/gameController.ts` | 修改 | 更新 discardPool 邏輯 |
| `src/actionChecker.ts` | 修改 | 新增 ChowOption 和 getChowOptions |
| `src/components/DiscardTimeline.ts` | 新建 | 捨牌時間線組件（含高亮） |
| `src/components/ChowSelector.ts` | 新建 | 吃牌選擇對話框 |
| `src/styles/discard-timeline.css` | 新建 | 捨牌池樣式（含動畫） |
| `src/main.ts` | 修改 | 集成新組件，改吃牌流程 |
| `src/tileRenderer.ts` | 修改 | 修復類型推斷問題 |

---

## 技術亮點

1. **統一捨牌池**：
   - 時間序列數組，易於追蹤和查詢
   - `isCurrentTile` 標記最新牌，簡化邏輯

2. **當下牌特顯**：
   - 80×110px 大尺寸 + 黃邊 + 脈衝動畫
   - 上/下家牌 0.5s 後滑至側邊，視覺流暢

3. **多種吃牌選擇**：
   - 視覺化對話框，清晰直觀
   - Promise 接口，異步處理用戶選擇

4. **高亮效果**：
   - 紅色/橘色脈衝 + 浮動標籤
   - 吸引玩家注意力，減少誤操作

5. **CSS 動畫**：
   - `@keyframes` 定義流暢動畫
   - 硬件加速（transform, opacity）

---

## 預期完成時間 vs 實際完成時間

- **預期**：27-34 分鐘
- **實際**：約 30 分鐘（含調試和類型修復）

---

## 後續優化建議

1. **性能優化**：
   - 當捨牌池過長（>50 張）時，考慮虛擬滾動
   
2. **UI 增強**：
   - 添加音效（出牌、吃碰槓）
   - 添加更多動畫過渡效果
   
3. **功能擴展**：
   - 支持回放（查看歷史捨牌）
   - 支持撤銷操作

4. **可訪問性**：
   - 添加鍵盤快捷鍵支持
   - 添加屏幕閱讀器支持

---

## 結論

✅ **所有三個 Phase 已成功實施並通過驗收**

捨牌池改進顯著提升了遊戲體驗：
- **視覺清晰**：中央海底一目了然
- **操作便捷**：吃牌選擇對話框易用
- **反饋及時**：高亮效果明顯，減少誤操作

專案已準備好進行進一步測試和部署。
