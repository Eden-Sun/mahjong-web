# CA Task: 捨牌池改進（三大特性）

## 任務描述
根據 DISCARD_POOL_IMPROVED_SPEC.md 實現三項改進。

---

## Phase 1：中央海底設計（10-12 分鐘）

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

### Task 1.2：新建 DiscardTimeline 組件
**文件**：`src/components/DiscardTimeline.tsx`

實現：
- React 組件，接收 `discardPool` 作為 props
- 三區佈局：
  - **左區（上家/南家）**：由右往左排列（最新牌在左邊）
  - **中央**：分上下兩部分
    - 上：對家（西家）捨牌，由左往右
    - 下：自己（東家）捨牌，由左往右
  - **右區（下家/北家）**：由左往右排列（最新牌在右邊）
- 每張牌：
  - 40×60px 牌卡
  - 小箭頭（↑←↓→）指示座位，顏色對應
  - 可選：吃/碰標記

驗收標準：
- ✅ 左區牌由右往左（上家牌排在左邊）
- ✅ 中央分上下，都由左往右（最新在右）
- ✅ 右區牌由左往右（下家牌排在右邊）
- ✅ 箭頭顏色正確（東紅/南藍/西綠/北黃）
- ✅ 超過 13 張時支援水平滾動或折行

### Task 1.3：DiscardTimeline 樣式
**文件**：`src/styles/discard-timeline.css`

實現：
- **主容器**：flexbox，三列佈局（左 | 中 | 右）
  - 左區：`flex-direction: row-reverse`（由右往左）
  - 中央：flexbox，垂直堆疊（上下）
    - 中上：`flex-direction: row`（由左往右）
    - 中下：`flex-direction: row`（由左往右）
  - 右區：`flex-direction: row`（由左往右）
- 每張牌的樣式（40×60px）
- 箭頭樣式（SVG 或 CSS），顏色對應座位
- 響應式佈局，支援滾動

驗收標準：
- ✅ 左區牌由右往左排列
- ✅ 中央上下區分清晰，都由左往右
- ✅ 右區牌由左往右排列
- ✅ 牌卡清晰可見，箭頭清晰可見
- ✅ 沒有重疊或佈局問題

### Task 1.4：集成到棋盤
**文件**：修改 `src/main.ts`

實現：
- 移除舊的 DiscardPool（4 區域佈局）
- 嵌入新的 DiscardTimeline（中央）
- 更新 showGameBoard()，傳入新的 discardPool

驗收標準：
- ✅ 海底顯示在棋盤中央
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

### Case 2：統一海底（新布局）
1. 東家(自己)打 5m → 中央下方 [5m↑]
2. 南家(上家)打 2p → 左邊 [2p←]
3. 西家(對家)打 E → 中央上方 [E↓]
4. 北家(下家)打 3s → 右邊 [3s→]
5. 期望：
   ```
                [E↓]
       [2p←] | [5m↑] | [3s→]
   ```
   - 左區牌由右往左排列
   - 中央上下分開，都由左往右
   - 右區牌由左往右排列

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

- Phase 1：10-12 分鐘
- Phase 2：8-10 分鐘
- Phase 3：5-8 分鐘
- **總計**：25-30 分鐘
