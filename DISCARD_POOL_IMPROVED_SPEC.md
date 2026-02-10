# 捨牌池改進規格

## 需求總結

基於原始捨牌池設計，進行三大改進：

### 1. 多種吃牌方式選擇
當一張牌可以多種方式吃時，彈出選擇對話框

### 2. 統一的中央海底設計
所有 4 家的捨牌都排在中央一條線上，按時間順序從左→右，每張牌旁邊顯示小箭頭指示誰打的

### 3. 可吃/碰牌的明顯高亮
當玩家可以吃/碰某張牌時，該牌用紅色閃爍或脈衝效果高亮

---

## 改進 1：多種吃牌方式選擇

### 場景
東家打 `5s`，玩家（南家）手牌有：
- `3s 4s` → 可吃 `3s-4s-5s`
- `6s 7s` → 可吃 `5s-6s-7s`

此時應彈出選擇對話框

### UI 設計

```
┌─────────────────────┐
│   您可以這樣吃牌：   │
├─────────────────────┤
│                     │
│  [3索-4索-5索] 吃   │
│  [5索-6索-7索] 吃   │
│                     │
│    [過]  [取消]    │
└─────────────────────┘
```

### 數據結構

```javascript
// 吃牌選擇結果
type ChowOption = {
  tiles: string[]  // 組成的順子
  with: string     // 要吃誰的牌
}

// 返回可吃的所有方式
function getChowOptions(hand: string[], targetTile: string): ChowOption[]
```

### 邏輯
1. 玩家點「吃」時，計算所有可吃的方式
2. 如果只有 1 種 → 直接執行
3. 如果有多種 → 彈出選擇對話框
4. 玩家選擇後確認

---

## 改進 2：統一的中央海底設計

### 舊設計（廢棄）
```
      [東家捨牌區]
[北]  [中央]  [南]
      [西家捨牌區]
```

### 新設計
上家（南家）捨牌放左邊，下家（北家）捨牌放右邊

```
上家捨牌 (南家←) | 中央(自己玩家+對家) | 下家捨牌 (→北家)

[8m←] [5m←] | [5m↑] [2p↓] [3s↓] | [1m→] [8m→]
             (第一張)          (最新)
```

### 座位說明
- **自己（東家）** = 玩家 0 → 中央下方
- **上家（南家）** = 玩家 1 → **左邊** (←)
- **對家（西家）** = 玩家 2 → 中央上方
- **下家（北家）** = 玩家 3 → **右邊** (→)

### 視覺布局（實際游戲視角）

```
                    對家 (西) ↓
                   [E↓] [2p↓]
                   
上家 (南) ←      中央棋盤         下家 (北) →
[8m←] [5m←]    [5m↑] [3s→]    [1m→] [8m→]

                    自己 (東) ↑
```

### 座位和排列對應

| 位置 | 座位號 | 名稱 | 箭頭 | 顏色 | 排列方向 | 說明 |
|------|--------|------|------|------|----------|------|
| 左邊 | 1 | 上家(南) | ← | 藍色 | 右→左 | 最新牌在左邊 |
| 中上 | 2 | 對家(西) | ↓ | 綠色 | 左→右 | 最新牌在右邊 |
| 中下 | 0 | 自己(東) | ↑ | 紅色 | 左→右 | 最新牌在右邊 |
| 右邊 | 3 | 下家(北) | → | 黃色 | 左→右 | 最新牌在右邊 |

### CSS 樣式

| 位置 | 座位 | 箭頭 | 顏色 |
|------|------|------|------|
| 上方 | 東   | ↑    | 紅色 |
| 左邊 | 南   | ←    | 藍色 |
| 下方 | 西   | ↓    | 綠色 |
| 右邊 | 北   | →    | 黃色 |

### 實現
- **主容器**：`<div class="discard-timeline-container">`
  - **左區（上家）**：`<div class="discard-left">` 由右往左排列
  - **中央**：`<div class="discard-center">`
    - 上方（對家）：`<div class="discard-center-top">`
    - 下方（自己）：`<div class="discard-center-bottom">`
  - **右區（下家）**：`<div class="discard-right">` 由左往右排列

- **每張牌**：`<div class="discard-tile" data-player="0">`
  - 牌卡（40×60px）
  - 小箭頭（顯示座位方向）
  - 可選：吃/碰標記

---

## 改進 3：可吃/碰牌的明顯高亮

### 場景
東家打了 `5m`，玩家可以吃或碰

此時所有可吃/碰的牌應明顯高亮

### 高亮效果

**方案 A：紅色脈衝**
```css
.discard-tile.can-chow,
.discard-tile.can-pong {
  animation: pulse-red 0.8s ease-in-out infinite;
  border: 3px solid #ff0000;
  box-shadow: 0 0 12px #ff0000;
}
```

**方案 B：放大 + 邊框**
```css
.discard-tile.can-chow::before {
  content: "吃";
  position: absolute;
  top: -20px;
  background: #ff0000;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

.discard-tile.can-pong::before {
  content: "碰";
  ...
}
```

### 邏輯

```javascript
// 玩家有響應權時
function showAvailableActions(targetTile: string) {
  const chowable = canChow(hand, targetTile)
  const pongable = canPong(hand, targetTile)
  
  // 高亮海底中的目標牌
  if (chowable) {
    discardTileElement.classList.add('can-chow')
  }
  if (pongable) {
    discardTileElement.classList.add('can-pong')
  }
}

// 玩家選擇後清除高亮
function clearHighlight() {
  document.querySelectorAll('.can-chow, .can-pong')
    .forEach(el => {
      el.classList.remove('can-chow', 'can-pong')
    })
}
```

---

## 文件清單

| 文件 | 目的 |
|------|------|
| `src/components/DiscardTimeline.tsx` | 新的海底組件（中央一條線） |
| `src/components/ChowSelector.tsx` | 吃牌選擇對話框 |
| `src/styles/discard-timeline.css` | 海底樣式 |
| `src/hooks/useChowOptions.ts` | 計算吃牌方式的 hook |
| `src/actionChecker.ts` | 修改 canChow，返回所有可吃的方式 |
| `src/main.ts` | 集成新組件 + 邏輯 |

---

## 實現順序

### Phase 1：中央海底（改進 2）
1. ✓ 新建 DiscardTimeline 組件
2. ✓ 改 gameState 的 discardPool 結構（改成陣列而非按座位分類）
3. ✓ 樣式：水平排列 + 方向箭頭

### Phase 2：吃牌選擇（改進 1）
1. ✓ 改 canChow 邏輯，返回所有可吃的方式
2. ✓ 新建 ChowSelector 對話框
3. ✓ 集成到響應邏輯

### Phase 3：高亮效果（改進 3）
1. ✓ 在海底中高亮可吃/碰的牌
2. ✓ CSS 脈衝動畫
3. ✓ 清除邏輯

---

## 測試用例

### Case 1：多種吃牌方式
1. 東家打 5s
2. 玩家有 3s 4s 6s 7s
3. 期望：彈出選擇對話框
   - [ ] 3索-4索-5索 吃
   - [ ] 5索-6索-7索 吃

### Case 2：統一海底
1. 東家(自己)打 5m → 中央下方 [5m↑]
2. 南家(上家)打 2p → 左邊 [2p←]
3. 西家(對家)打 E → 中央上方 [E↓]
4. 北家(下家)打 3s → 右邊 [3s→]
5. 期望：
   ```
                [E↓]
       [2p←] | [5m↑] | [3s→]
   ```
   佈局清晰，箭頭指示座位，顏色對應

### Case 3：高亮吃/碰
1. 東家打 5m，玩家可吃或碰
2. 期望：海底中的 5m 呈紅色脈衝，上面浮動 "吃" 或 "碰" 標籤

---

## 預期完成時間

- Phase 1：10-12 分鐘
- Phase 2：8-10 分鐘
- Phase 3：5-8 分鐘
- **總計**：25-30 分鐘
