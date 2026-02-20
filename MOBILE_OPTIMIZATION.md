# 麻將遊戲手機優化總結

## 最新更新 (2026-02-13 16:20)

### 📱 進一步修復 (2026-02-13 23:20)

**問題：** 截圖顯示手牌標題可見，但實際手牌被裁掉了。

**額外修復：**
1. ✅ **增加手牌區域高度**
   - `flex-basis`: 200px → 240px
   - `min-height`: 200px → 240px
   - `max-height`: 35vh → 45vh
2. ✅ **限制手牌標題高度**
   - 標題區域：30-40px 固定
   - 避免標題佔用過多空間
3. ✅ **強制手牌可見**
   - `.player-hand-tiles` 最小高度：120px
   - 確保至少一行手牌完全可見

**建議：**
- 先硬刷新瀏覽器（清除快取）
- 如果還是不行，再回報截圖

### 📱 iPhone 16 Pro + Chrome：手牌底部不可見

**問題：**
- iPhone 16 Pro 的 Chrome 會把 `100vh` 視為「最大視口」，底部被瀏覽器工具列遮住
- 導致手牌最後一行看不到、也無法點擊

**修復：**
1. ✅ **改用動態視口單位 (dvh)**
   - 新增 `--app-height`：`100vh` → 支援時切換 `100dvh`
   - `#game-container` 與 `.middle-area` 改用 `var(--app-height)` 計算高度
2. ✅ **加入安全區域內距**
   - `#game-container` 針對 `safe-area-inset-*` 增加 padding
   - 避免底部手牌被 Home Indicator 或瀏覽器 UI 遮擋
3. ✅ **強化手牌換行規則**
   - `.player-hand-tiles` 明確設定 `display: flex` + `flex-wrap: wrap`

**測試（桌面視口模擬 430×932）：**
- ✅ 13 張：兩行完整顯示，皆可點擊
- ✅ 14 張：兩行完整顯示，皆可點擊

**影響文件：**
- `src/styles/mobile-optimized.css`
- `index.html`

---

## 最新更新 (2026-02-11 10:05)

### 🚀 布局修復：三個 AI 在頂部 + 手牌可見可點

**問題：**
- 手牌區域被推出螢幕外，無法點擊
- 遊戲全螢幕後整體高度失控

**修復：**
1. ✅ **三個 AI 玩家在頂部一行**（原本 2 上 + 1 左）
   - 移除左側 `.left-player` 區域
   - 所有三個 AI 放入 `.top-players` 一行顯示
   - 節省橫向空間，更符合手機直立模式

2. ✅ **移除 `min-height: 100vh`**
   - `#game-container` 原本強制撐滿 100vh
   - 導致內容溢出，手牌被推出螢幕
   - 改為只設定 `height` 和 `max-height`

3. ✅ **手牌區域固定在底部**
   - `flex: 0 0 auto` 確保不會被擠壓
   - `min-height: 180px` 確保最小可見高度
   - `max-height: 35vh` 避免佔用過多空間
   - `z-index: 100` 確保在最上層

**提交：** acb1a6a

---

## 之前更新 (2026-02-11)

### 🎯 核心優化：確保手牌區域始終可見

本次優化重點解決手牌區域被推出螢幕外的問題，通過精確的 Flexbox 布局控制，確保：
- ✅ 頂部 AI 玩家區域：固定高度，不會增長
- ✅ 中間牌桌區域：彈性增長，可滾動
- ✅ 底部手牌區域：嚴格固定，始終可見

## 優化內容

### 1. Flexbox 布局架構優化

#### 關鍵 Flex 屬性設定

**主容器 (`#game-container`)**:
```css
height: 100vh !important;
max-height: 100vh !important;
min-height: 100vh !important; /* 防止縮小 */
display: flex;
flex-direction: column;
overflow: hidden;
```

**頂部區域 (`.top-players`)**:
```css
flex: 0 0 auto !important; /* 不增長、不縮小、自動高度 */
max-height: 80px;
min-height: 60px;
```

**中間區域 (`.middle-area`)**:
```css
flex: 1 1 0 !important; /* 增長填充空間、可縮小、從0開始 */
min-height: 0 !important; /* 關鍵：允許縮小 */
max-height: 100% !important;
overflow: hidden;
```

**牌桌 (`.game-board`)**:
```css
flex: 1 1 0 !important;
min-height: 0 !important; /* 關鍵：觸發滾動 */
overflow: hidden;
```

**牌桌內容 (`.game-board-content`)**:
```css
flex: 1 1 0 !important;
min-height: 0 !important; /* 關鍵：允許縮小並滾動 */
overflow-y: auto;
-webkit-overflow-scrolling: touch;
```

**手牌區域 (`.player-hand-container`)**:
```css
flex: 0 0 auto !important; /* 嚴格固定，絕不增長或縮小 */
max-height: 40vh !important; /* 最多佔40%視口 */
min-height: 160px !important; /* 確保最小可見高度 */
z-index: 100 !important; /* 確保在最上層 */
```

**手牌內容 (`.player-hand-tiles`)**:
```css
flex: 1 1 0 !important;
min-height: 0 !important; /* 允許縮小並滾動 */
overflow-y: auto;
```

### 2. 關鍵技術要點

#### min-height: 0 的重要性
- 在 Flexbox 中，默認 `min-height: auto` 會阻止元素縮小
- 設定 `min-height: 0` 允許子元素根據內容大小縮小
- 這是觸發滾動行為的關鍵

#### flex: 1 1 0 vs flex: 1 1 auto
- `flex: 1 1 0`: 從0開始增長，更容易控制大小
- `flex: 1 1 auto`: 從內容大小開始，可能導致溢出
- 可滾動區域應使用 `flex: 1 1 0`

#### overflow 層級控制
- 父容器: `overflow: hidden` (防止外層滾動)
- 滾動容器: `overflow-y: auto` (啟用內部滾動)
- 固定容器: `overflow: hidden` (防止意外滾動)

### 3. 響應式斷點與高度分配

#### 直立模式 (<768px)
```
┌─────────────────────┐
│ 頂部AI (60-80px)    │ ← flex: 0 0 auto (固定)
├─────────────────────┤
│                     │
│ 中間牌桌 (彈性)     │ ← flex: 1 1 0 (可滾動)
│                     │
├─────────────────────┤
│ 底部手牌 (160-40vh) │ ← flex: 0 0 auto (固定)
└─────────────────────┘
```

#### 橫屏模式 (<812px landscape)
```css
.player-hand-container {
  max-height: 50vh !important; /* 增加到50% */
  min-height: 120px !important;
}
```

#### 小手機 (<480px)
```css
.player-hand-container {
  max-height: 38vh !important; /* 減少到38% */
  min-height: 140px !important;
}
```

### 4. 元素尺寸

**手機 (<768px)**:
- 手牌: 42×56px
- 捨牌(當下): 55×75px
- 捨牌(歷史): 30×45px
- 已組牌: 38×52px

**小手機 (<480px)**:
- 手牌: 38×52px
- 捨牌(當下): 50×68px
- 捨牌(歷史): 28×40px
- 已組牌: 36×50px

### 5. 性能優化

#### GPU 加速
```css
transform: translateZ(0);
-webkit-backface-visibility: hidden;
will-change: scroll-position;
```

#### 觸控滾動優化
```css
-webkit-overflow-scrolling: touch;
scroll-behavior: smooth;
overscroll-behavior: contain;
```

#### 減少重繪
```css
contain: layout style paint;
will-change: transform, opacity;
```

### 6. 觸控體驗
- ✅ 最小觸控區域 44px (iOS 標準)
- ✅ 觸控反饋動畫 (`:active` scale)
- ✅ 防止誤觸 (`touch-action: manipulation`)
- ✅ 禁用點擊高亮 (`-webkit-tap-highlight-color: transparent`)

### 7. 視覺優化
- ✅ 緊湊間距 (4-10px 依設備)
- ✅ 縮小字體 (0.7-1.1em)
- ✅ 優化滾動條樣式 (4px 寬，半透明)
- ✅ 隱藏不必要元素 (左側AI玩家)

## 文件結構
```
src/styles/
├── layout.css              # 基礎 Flexbox 布局 (桌面+手機)
├── mobile-optimized.css    # 手機專屬優化樣式
├── tile.css                # 牌卡樣式
└── discard-timeline.css    # 捨牌池樣式
```

## 測試檢查清單

### 直立模式測試
- [ ] 手牌區域始終可見於螢幕底部
- [ ] 中間牌桌區域可以垂直滾動
- [ ] 頂部AI玩家資訊不會被遮擋
- [ ] 滾動流暢，無卡頓
- [ ] 所有按鈕均可點擊（最小44px）

### 橫屏模式測試
- [ ] 手牌區域適當增大（50vh）
- [ ] 布局不會被壓縮變形
- [ ] 滾動行為正常
- [ ] 內容不會溢出視口

### 不同尺寸設備
- [ ] 小手機 (<480px): 元素尺寸縮小適當
- [ ] 中型手機 (480-768px): 標準尺寸正常
- [ ] 大手機 (>768px): 顯示完整內容

### 互動測試
- [ ] 捲動牌桌時，手牌區域保持固定
- [ ] 手牌過多時，可在手牌區域內滾動
- [ ] 點擊手牌反應靈敏
- [ ] 捨牌動畫流暢

### 性能測試
- [ ] 滾動時幀率保持60fps
- [ ] 無明顯卡頓或延遲
- [ ] 記憶體使用穩定

## 已知限制
- 小於 320px 寬度的極小螢幕未優化
- 平板尺寸 (768-1024px) 使用桌面布局
- 部分舊版瀏覽器可能不支援某些 CSS 屬性

## 調試技巧

### 檢查元素是否被推出視口
```javascript
// 在瀏覽器控制台執行
const hand = document.querySelector('.player-hand-container');
const rect = hand.getBoundingClientRect();
console.log('手牌區域位置:', {
  top: rect.top,
  bottom: rect.bottom,
  height: rect.height,
  viewportHeight: window.innerHeight,
  visible: rect.bottom <= window.innerHeight
});
```

### 檢查 Flex 屬性
```javascript
// 檢查所有主要區域的 flex 屬性
['#game-container', '.top-players', '.middle-area', '.game-board', '.player-hand-container']
  .forEach(selector => {
    const el = document.querySelector(selector);
    const style = window.getComputedStyle(el);
    console.log(selector, {
      flex: style.flex,
      flexGrow: style.flexGrow,
      flexShrink: style.flexShrink,
      flexBasis: style.flexBasis,
      minHeight: style.minHeight,
      maxHeight: style.maxHeight,
      height: style.height
    });
  });
```

## 未來改進方向
- [ ] 添加手勢支持 (滑動出牌)
- [ ] 支援動態視口單位 (dvh) 以處理移動瀏覽器工具列
- [ ] 添加觸覺反饋 (振動)
- [ ] 優化動畫性能 (使用 CSS 變數)
- [ ] 支援更多螢幕方向鎖定
- [ ] 添加無障礙功能 (ARIA labels)

## 更新 (2026-02-11 11:30)

### 🔧 關鍵修復：強制限制牌桌高度

**問題：** 即使設定了 flex: 0 0 auto，手牌區域仍被推出螢幕外。

**根本原因：**
1. `#game-container` 的 `min-height: 100vh` 強制容器撐滿視口
2. `.middle-area` 的 `flex: 1 1 0` 會盡可能增長，佔用所有剩餘空間
3. 即使手牌設定 `flex: 0 0 auto`，因為牌桌已佔滿空間，手牌被推出視口

**解決方案：**
1. **移除 `min-height: 100vh`** — 讓內容自然分配，避免強制撐滿
2. **限制牌桌最大高度** — 使用 `calc(100vh - 頂部 - 手牌 - gap)`
3. **手牌使用固定 flex-basis** — 從 `flex: 0 0 auto` 改成 `flex: 0 0 200px`

**修改細節：**

```css
/* 標準模式 (<768px) */
.middle-area {
  max-height: calc(100vh - 80px - 200px - 18px) !important;
}
.player-hand-container {
  flex: 0 0 200px !important;
  min-height: 200px !important;
}

/* 小手機 (<480px) */
.middle-area {
  max-height: calc(100vh - 70px - 160px - 15px) !important;
}
.player-hand-container {
  flex: 0 0 160px !important;
  min-height: 160px !important;
}

/* 橫屏 (<812px landscape) */
.middle-area {
  max-height: calc(100vh - 70px - 140px - 12px) !important;
}
.player-hand-container {
  flex: 0 0 140px !important;
  min-height: 140px !important;
}
```

**效果：**
- ✅ 手牌區域始終固定在螢幕底部
- ✅ 牌桌區域不會無限增長
- ✅ 牌桌內容過多時可滾動
- ✅ 三種模式（標準/小手機/橫屏）都正常工作

**提交：** a096462

## 更新 (2026-02-11 11:35)

### 🎯 修復：手牌按鈕無法點擊

**問題：** 手牌區域可見但無法點擊。

**根本原因：**
1. `.tile.disabled` 有 `pointer-events: none`
2. `renderHandHTML` 渲染的按鈕包含 `.tile` 元素作為子元素
3. 即使按鈕本身可點擊，內部的 `.tile` 元素會攔截並阻止點擊事件

**解決方案：**
```css
/* 按鈕本身強制可點擊 */
button.hand-tile-button {
  pointer-events: auto !important;
  touch-action: manipulation !important;
}

/* 內部元素穿透點擊事件 */
button.hand-tile-button .tile,
button.hand-tile-button .tile-content {
  pointer-events: none !important;
}
```

**關鍵概念：**
- 按鈕層：可點擊，接收事件
- 內容層：不可點擊，事件穿透
- 這樣即使 `.tile` 是 disabled，按鈕仍可點擊

**效果：**
- ✅ 手牌按鈕始終可點擊（當 button 不是 disabled）
- ✅ 添加觸控反饋動畫（`:active` scale）
- ✅ 正確顯示 disabled 狀態（按鈕層控制）

**提交：** 6e063e5
