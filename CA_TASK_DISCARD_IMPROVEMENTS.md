# CA Task: 捨牌池改進（三大特性）

## 任務描述
根據 DISCARD_POOL_IMPROVED_SPEC.md 實現三項改進。

---

## Phase 1：中央海底設計 + 當下牌特顯（14-16 分鐘）

### Task 1.0：改 discardPool 數據結構以支持當下牌追蹤
**文件**：`src/gameState.ts`

改變：
```typescript
type DiscardedTile = {
  tile: string
  player: number
  timestamp: number
  isCurrentTile: boolean  // 新增：是否是當下牌
  claimedBy?: number
  claimType?: 'pong' | 'chow' | 'kong'
}
```

驗收標準：
- ✅ 每次有牌捨出時，只有最新的牌 isCurrentTile = true
- ✅ 其他牌 isCurrentTile = false
- ✅ 舊牌更新時自動改為 false

### Task 1.1：改 discardPool 數據結構
**文件**：`src/gameState.ts`

改變 discardPool 從：
```typescript
{
  east: string[]
  south: string[]
  west: string[]
  north: string[]
}
```

改成：
```typescript
type DiscardedTile = {
  tile: string
  player: number  // 0=東, 1=南, 2=西, 3=北
  timestamp: number
  claimedBy?: number
  claimType?: 'pong' | 'chow' | 'kong'
}

discardPool: DiscardedTile[]  // 按時間順序
```

驗收標準：
- ✅ 編譯無誤
- ✅ gameState 初始化時 discardPool = []
- ✅ 與出牌邏輯兼容

### Task 1.2：新建 DiscardTimeline 組件（含當下牌特顯）
**文件**：`src/components/DiscardTimeline.tsx`

實現：
- React 組件，接收 `discardPool` 作為 props
- 三區佈局：
  - **左區（上家/南家）**：由右往左排列（最新牌在左邊）
  - **中央**：分上下兩部分，各有特大區
    - 上：對家（西家）
      - 當下牌特大區（80×110px，如果當下牌來自對家）
      - 舊牌區（40×60px，由左往右）
    - 下：自己（東家）
      - 當下牌特大區（80×110px，如果當下牌來自自己）
      - 舊牌區（40×60px，由左往右）
  - **右區（下家/北家）**：由左往右排列（最新牌在右邊）
- 當下牌邏輯：
  - 找到 isCurrentTile = true 的牌
  - 如果來自自己/對家 → 在中央特大區顯示
  - 如果來自上/下家 → 在特大區顯示 0.5s，然後動畫滑至側邊
- 每張牌樣式：
  - 當下牌：80×110px，黃邊，脈衝動畫
  - 舊牌：40×60px，小箭頭，顏色對應

驗收標準：
- ✅ 當下牌在中央特大區顯示，黃邊+脈衝
- ✅ 當下牌來自上/下家時，0.5s 後滑動至側邊
- ✅ 左區牌由右往左，中央分上下，右區由左往右
- ✅ 超過 13 張時支援水平滾動或折行
- ✅ 箭頭顏色正確

### Task 1.3：DiscardTimeline 樣式（含當下牌特顯）
**文件**：`src/styles/discard-timeline.css`

實現：
- **主容器**：flexbox，三列佈局（左 | 中 | 右）
  - 左區：`flex-direction: row-reverse`（由右往左）
  - 中央：flexbox，垂直堆疊（上下）
    - 中上：分為特大區 + 舊牌區
      - 特大區：`discard-highlight-top`（80×110px）
      - 舊牌區：`discard-tiles-top`（40×60px，由左往右）
    - 中下：分為特大區 + 舊牌區
      - 特大區：`discard-highlight-bottom`（80×110px）
      - 舊牌區：`discard-tiles-bottom`（40×60px，由左往右）
  - 右區：`flex-direction: row`（由左往右）

- **當下牌樣式**（`.discard-tile.current-tile`）：
  - 尺寸：80×110px
  - 邊框：4px 黃色 (#FFD700)
  - 發光效果：`box-shadow: 0 0 16px #FFD700`
  - 脈衝動畫：scale(1) → scale(1.05) → scale(1)，週期 0.6s

- **舊牌樣式**（`.discard-tile.historic-tile`）：
  - 尺寸：40×60px
  - 邊框：2px 深灰色
  - 透明度：0.8

- **滑動動畫**（`.animate-to-side`）：
  - 0.5s 後滑動至側邊，從特大縮小至小，淡出

驗收標準：
- ✅ 當下牌 80×110px，黃邊，脈衝明顯
- ✅ 當下牌來自上/下家時滑動至側邊
- ✅ 舊牌 40×60px，透明度 0.8
- ✅ 左區由右往左，中央上下各有特大區，右區由左往右
- ✅ 沒有重疊或佈局問題

### Task 1.4：集成到棋盤（含當下牌邏輯）
**文件**：修改 `src/main.ts` 和 `src/gameController.ts`

實現：
- 移除舊的 DiscardPool（4 區域佈局）
- 嵌入新的 DiscardTimeline（中央 + 特顯）
- 更新 showGameBoard()，傳入新的 discardPool
- 當出牌時，更新 discardPool：
  - 找到舊的 isCurrentTile = true 的牌，改為 false
  - 新牌加入，設 isCurrentTile = true
  - 如果新牌來自上/下家，設置 0.5s 延遲後變為側邊牌

驗收標準：
- ✅ 當下牌明顯顯示在中央特大區
- ✅ 當下牌黃邊+脈衝+浮起
- ✅ 當下牌來自上/下家時，0.5s 後滑至側邊
- ✅ 舊牌透明度 0.8，小牌卡
- ✅ 出牌後自動更新
- ✅ 不影響既有 UI

---

## Phase 2：吃牌選擇對話框（8-10 分鐘）

### Task 2.1：改 canChow 邏輯
**文件**：`src/actionChecker.ts`

新增函數：
```typescript
export interface ChowOption {
  tiles: string[]
  with: string  // 目標牌
}

export function getChowOptions(
  hand: string[],
  targetTile: string
): ChowOption[]  // 所有可吃的方式
```

邏輯：
- 計算所有可能的順子組合
- 每個組合包含目標牌（第一、中間或最後）
- 返回所有選項

驗收標準：
- ✅ 正確計算所有吃牌方式
- ✅ 返回的 tiles 順序正確
- ✅ 邊界情況正確（如 7s-8s-9s）

### Task 2.2：新建 ChowSelector 對話框
**文件**：`src/components/ChowSelector.tsx`

實現：
- React 對話框組件
- 顯示所有可吃的方式
- 按鈕：[選項 1 吃] [選項 2 吃] ... [過]
- 可選：取消

驗收標準：
- ✅ UI 清晰易用
- ✅ 點擊後返回選中的選項
- ✅ 響應式設計

### Task 2.3：集成到遊戲流程
**文件**：修改 `src/gameController.ts` 和 `src/main.ts`

實現：
- playerResponse('chow') 時，檢查可吃的方式
- 如果只有 1 種 → 直接執行
- 如果多種 → 彈出 ChowSelector
- 玩家選擇後執行 executeChow()

驗收標準：
- ✅ 單一吃法時直接執行
- ✅ 多種吃法時彈出對話框
- ✅ 玩家可以切換選擇和取消

---

## Phase 3：高亮效果（5-8 分鐘）

### Task 3.1：高亮邏輯
**文件**：修改 `src/gameController.ts`

實現：
- 當 `gamePhase === 'response'` 時，計算可吃/碰的牌
- 更新 gameState 或傳遞標記給 UI：`canChowTile`, `canPongTile`

驗收標準：
- ✅ 正確識別可吃/碰的牌
- ✅ 切換到其他玩家時清除高亮

### Task 3.2：DiscardTimeline 高亮效果
**文件**：修改 `src/components/DiscardTimeline.tsx` 和 CSS

實現：
- 接收 `canChowTile` 和 `canPongTile` 作為 props
- 對應的牌卡添加 `can-chow` 或 `can-pong` class
- CSS 提供脈衝動畫 + 邊框 + 浮動標籤

驗收標準：
- ✅ 可吃的牌呈紅色脈衝，上面浮動 "吃"
- ✅ 可碰的牌呈黃色脈衝，上面浮動 "碰"
- ✅ 効果明顯，容易被注意到

### Task 3.3：CSS 動畫
**文件**：修改 `src/styles/discard-timeline.css`

實現：
```css
.discard-tile.can-chow {
  border: 3px solid #ff0000;
  animation: pulse-chow 0.8s ease-in-out infinite;
}

.discard-tile.can-pong {
  border: 3px solid #ffa500;
  animation: pulse-pong 0.8s ease-in-out infinite;
}

@keyframes pulse-chow {
  0%, 100% { box-shadow: 0 0 8px #ff0000; }
  50% { box-shadow: 0 0 16px #ff0000; }
}

@keyframes pulse-pong {
  0%, 100% { box-shadow: 0 0 8px #ffa500; }
  50% { box-shadow: 0 0 16px #ffa500; }
}
```

驗收標準：
- ✅ 動畫流暢
- ✅ 效果明顯不刺眼

---

## 測試用例

### Case 1：多種吃牌方式
1. 東家打 5s
2. 玩家有 3s 4s 6s 7s
3. 點「吃」
4. 期望：彈出對話框
   - [ ] 3索-4索-5索 吃
   - [ ] 5索-6索-7索 吃

### Case 2：統一海底 + 當下牌特顯
1. 東家(自己)打 5m 
   - 期望：5m 在中央下方特大區，黃邊+脈衝

2. 南家(上家)打 2p
   - 期望：2p 在中央特大區，顯示 0.5s
   - 0.5s 後動畫滑至左邊，變成小牌卡
   - 5m 變為小牌卡，透明度 0.8

3. 西家(對家)打 E
   - 期望：E 在中央上方特大區，黃邊+脈衝
   - 2p 的滑動動畫完成，顯示在左邊

4. 北家(下家)打 3s
   - 期望：3s 在中央特大區，顯示 0.5s 後滑至右邊

5. 最終效果：
   ```
                 [E↓特大]
       [2p←小] | (黃邊+脈衝) | [3s→小]
       
       [5m↑小] (透明度0.8) [舊牌...]
   ```

### Case 3：高亮吃/碰
1. 東家打 5m，玩家可吃或碰
2. 期望：海底中的 5m 呈紅色脈衝

---

## Git 提交規范

```
feat(discard-improvements): Phase N - [任務名稱]

- [實現細節]
- [驗收標準]
```

---

## 預期完成時間

- Phase 1：14-16 分鐘（加入當下牌特顯邏輯）
- Phase 2：8-10 分鐘
- Phase 3：5-8 分鐘
- **總計**：27-34 分鐘
