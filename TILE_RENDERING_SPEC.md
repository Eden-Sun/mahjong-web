# 麻将牌图示化 + 胡牌/自摸逻辑 SPEC

## 1. 牌图渲染方案

### 方案：CSS + 纯数字/文字渲染（最快实现）

每张牌显示为一个卡片，包含：
- **上方**：牌类型图标（萬、筒、索、风、箭）
- **中间**：大号数字/汉字
- **样式**：边框、阴影、背景色区分牌类

#### 牌类颜色方案
```
萬 (m)  - 红色背景 + 红色数字 (#d32f2f)
筒 (p)  - 蓝色背景 + 蓝色数字 (#1976d2)
索 (s)  - 绿色背景 + 绿色数字 (#388e3c)
风 (E/S/W/N) - 黄色背景 (#f57f17)
箭 (B/F/Z) - 紫色背景 (#7b1fa2)
```

#### 牌卡 HTML 结构
```html
<div class="tile" data-tile="5m" data-type="m">
  <div class="tile-suit">萬</div>
  <div class="tile-number">5</div>
</div>
```

#### CSS 样式
```css
.tile {
  width: 60px;
  height: 80px;
  border: 3px solid #333;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  cursor: pointer;
  position: relative;
  background: white;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
}

.tile.m { --color: #d32f2f; }
.tile.p { --color: #1976d2; }
.tile.s { --color: #388e3c; }
.tile.E, .tile.S, .tile.W, .tile.N { --color: #f57f17; }
.tile.B, .tile.F, .tile.Z { --color: #7b1fa2; }

.tile-suit {
  font-size: 12px;
  color: var(--color);
  font-weight: bold;
}

.tile-number {
  font-size: 24px;
  color: var(--color);
}

.tile:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.tile.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.tile.new-draw {
  border: 3px solid #FFD700;
  box-shadow: 0 0 8px #FFD700;
}
```

## 2. 手牌排列规则

### 排列顺序
```
左 ← [旧牌...] [新摸的牌] → 右
```

**实现方式：**
1. 手牌维持排序（萬 → 索 → 筒 → 风 → 箭）
2. 新摸的牌加到末尾（自动排到右边）
3. 新摸的牌显示特殊样式（金色边框 + 发光效果）

### UI 显示
```
手牌 (16 张)
[1萬] [2萬] [3萬] [4萬] [5萬] [6萬] [7萬] [8萬] 
[1索] [2索] [3索] [4索] [5索] [6索] [7索] [✨ 5筒] ← 新摸
```

## 3. 胡牌检查

### 触发条件
1. **自摸和**：玩家摸到的牌完成牌型
2. **点和**：他人出的牌被玩家碰/吃后完成牌型

### 实现函数

```typescript
function checkWin(hand: string[], melds: Meld[], drawnTile?: string): {
  canWin: boolean
  winType: 'self-draw' | 'win-from-others' | null
  fans: number
  pattern: string // 如：平胡、自摸、门清等
}
```

### 胡牌检查算法
```typescript
// 递归回溯算法
function canFormWinPattern(hand: string[], melds: Meld[]): boolean {
  // 检查：4 组面子 + 1 对眼
  // 面子 = 刻子（3 张）或顺子（3 张连续）
}
```

### 番数计算

基础番表：
```
平胡 (基础)           1 番
自摸                  +1 番（如果自摸）
门清                  +1 番（无吃碰槓）
全求人                +1 番（全是他人出的牌）
一色同顺              +2 番
三暗刻                +1 番
...（后续可扩展）
```

## 4. 自摸逻辑

### 自摸状态管理
```typescript
interface DrawState {
  drawnTile: string | null       // 刚摸的牌
  canDiscard: boolean             // 是否可出牌
  canWin: boolean                 // 是否可和
  timeStamp: number               // 摸牌时间（用于检测超时）
}
```

### 自摸后的操作流程
```
玩家摸牌
  ↓
显示新牌（金色边框、最右边）
  ↓
检查是否可和
  ├─ 可和 → 显示"和"按钮
  ├─ 不可和 → 只显示出牌按钮
  └─ （自动检查，无需手动选择）
  ↓
玩家选择：和 或 出牌
  ├─ 选和 → 计分、局结束
  └─ 选出牌 → 回到 DISCARD 阶段
```

### 自摸超时处理
如果玩家 30 秒未出牌，AI 自动代替出牌（可选）

## 5. UI 更新

### 手牌区域
```html
<div class="player-hand">
  <div class="hand-label">手牌 (16 张)</div>
  <div class="tile-container">
    <!-- tiles 渲染在这里，新摸的带 .new-draw 类 -->
  </div>
  <div class="hand-actions">
    <button id="drawBtn" disabled>📥 摸牌</button>
    <button id="winBtn" disabled>🏆 和</button>
    <button id="passBtn" disabled>⏭️ 过</button>
  </div>
</div>
```

### 状态显示
```html
<div class="game-status">
  📍 阶段：DISCARD
  👤 当前：你
  🤔 自摸可和？NO
  💡 提示：点击手牌出牌
</div>
```

## 6. 实现清单

### 前端 UI (`src/tileRenderer.ts` - 新建)
- [ ] `renderTile(tile: string, isNewDraw: boolean)` - 渲染单张牌
- [ ] `renderHand(hand: string[], drawnTile?: string)` - 渲染整个手牌
- [ ] CSS 样式文件 (`src/tile.css`)
- [ ] 牌卡悬停、选中、禁用状态

### 胡牌逻辑 (`src/winChecker.ts` - 新建)
- [ ] `checkWin(hand, melds, drawnTile)` - 检查是否和牌
- [ ] `canFormWinPattern(hand, melds)` - 递归算法
- [ ] `calculateFans(hand, melds, winType)` - 番数计算
- [ ] `checkSelfDrawWin(hand)` - 自摸和检查
- [ ] `checkWinFromOthers(hand, tile)` - 点和检查

### 自摸管理 (`src/drawState.ts` - 新建)
- [ ] 自摸状态跟踪
- [ ] 新牌样式标记（金色边框）
- [ ] 自摸后的和牌按钮显示逻辑

### 游戏流程更新 (`src/gameController.ts` - 修改)
- [ ] 摸牌后立即检查 `canWin`
- [ ] 如果可和 → 显示"和"按钮
- [ ] 如果不可和 → 隐藏"和"按钮
- [ ] 出牌后转到下一玩家

## 7. 视觉反馈

### 新摸的牌
- 金色边框（border: 3px solid #FFD700）
- 发光效果（box-shadow: 0 0 8px #FFD700）
- 位置在最右边（通过排序确保）

### 和牌提示
- 当 `canWin === true` 时
- 显示醒目提示：🏆 **可和！**
- "和"按钮突出（绿色 + 脉冲动画）

### 禁用状态
- 不可出牌时 → 手牌灰显 (opacity: 0.5)
- 不是当前玩家 → 整个界面灰显

## 8. 版本优化路线

### V1（快速实现）
- CSS 纯数字/文字牌（如上）
- 基础胡牌检查（平胡）
- 自摸检查

### V2（后续优化）
- SVG 精美牌图（可用 open-source 库）
- 完整番数表
- 复杂牌型识别（一色、对对等）

---

## 快速清单
- [ ] 牌卡 CSS 样式完成
- [ ] 手牌渲染函数 `renderHand()`
- [ ] 胡牌检查算法 `checkWin()`
- [ ] 自摸状态管理
- [ ] UI 按钮逻辑（和/过/出牌）
- [ ] 新摸的牌金色标记
- [ ] 测试胡牌判定
