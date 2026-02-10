# CA 任务 2：牌图渲染 + 胡牌/自摸逻辑

## 优先级任务

### 任务 1：牌卡 CSS 图示化
**文件**：`src/tile.css` 和 `src/tileRenderer.ts`

实现麻将牌的 CSS 渲染：
```typescript
// 牌卡 HTML 结构
<div class="tile tile-m new-draw" data-tile="5m">
  <div class="tile-suit">萬</div>
  <div class="tile-number">5</div>
</div>
```

**需要的样式：**
- 基础牌卡：60×80px，边框、阴影、圆角
- 牌类颜色：萬(红) / 筒(蓝) / 索(绿) / 风(黄) / 箭(紫)
- 新摸的牌：金色边框 + 发光效果 (.new-draw 类)
- 禁用状态：灰显 (opacity: 0.5, cursor: not-allowed)
- 悬停效果：translateY(-4px) + 阴影增强

**函数实现：**
```typescript
// src/tileRenderer.ts
export function renderTile(tile: string, isNewDraw: boolean = false): HTMLElement
export function renderHand(hand: string[], drawnTile?: string): HTMLElement
export function highlightNewTile(tile: string): void
```

### 任务 2：胡牌检查算法
**文件**：`src/winChecker.ts`

实现完整的胡牌检查：

```typescript
interface WinResult {
  canWin: boolean
  winType: 'self-draw' | 'win-from-others' | null
  fans: number  // 番数
  pattern: string  // 平胡、自摸、门清等
}

// 主函数
export function checkWin(
  hand: string[],
  melds: Meld[],
  lastDrawnTile?: string
): WinResult

// 递归检查能否组成胡牌
function canFormWinPattern(
  hand: string[],
  melds: Meld[],
  eyeUsed: boolean = false
): boolean
```

**核心逻辑：**
1. 检查能否组成 4 组面子 + 1 对眼牌
2. 面子 = 刻子（3 张）或顺子（3 张连续）
3. 使用递归回溯算法

**检查流程：**
```
checkWin(hand, melds)
  ├─ 如果 hand.length + melds面子数 === 4 + 眼牌 → 检查是否能组成
  ├─ 尝试每种可能的眼牌
  ├─ 对剩余牌递归检查面子
  └─ 返回 canWin + fans
```

### 任务 3：自摸逻辑
**文件**：修改 `src/gameController.ts`

在玩家摸牌后立即检查胡牌：

```typescript
async playerDraw() {
  // 1. 摸牌
  const tile = GameEngine.drawTile()
  this.player.hand.push(tile)
  this.player.hand = sortHand(this.player.hand)
  
  // 2. 检查是否可以和牌
  const winResult = checkWin(this.player.hand, this.player.melds, tile)
  
  // 3. 更新 UI
  renderHand(this.player.hand, tile)  // 新牌带 .new-draw 样式
  
  if (winResult.canWin) {
    // 显示"和"按钮
    document.getElementById('winBtn').disabled = false
    showMessage(`🏆 可以和！(${winResult.fans} 番)`)
  } else {
    // 隐藏"和"按钮，只显示"出牌"
    document.getElementById('winBtn').disabled = true
  }
  
  // 4. 进入 DISCARD 阶段
  this.gameState.gamePhase = 'discard'
  updatePlayerUI()
}
```

### 任务 4：番数计算
**文件**：`src/winChecker.ts` 中的 `calculateFans()`

```typescript
function calculateFans(
  hand: string[],
  melds: Meld[],
  winType: 'self-draw' | 'win-from-others'
): number
```

**番数表（基础）：**
```
平胡 (基础)        1 番
自摸 (self-draw)   +1 番
门清 (无碰槓吃)     +1 番
全求人 (全他人牌)   +1 番

示例：
- 自摸平胡 = 1 + 1 = 2 番
- 点和门清 = 1 + 1 = 2 番
- 自摸门清平胡 = 1 + 1 + 1 = 3 番
```

### 任务 5：UI 交互更新
**文件**：修改 `src/main.ts`

**新增按钮逻辑：**
```html
<!-- 摸牌阶段 -->
<button id="winBtn" disabled>🏆 和 (${fans} 番)</button>
<button id="passBtn" disabled>⏭️ 过</button>
```

**事件处理：**
```typescript
document.getElementById('winBtn').addEventListener('click', () => {
  playerWin()  // 执行和牌逻辑
})

document.getElementById('passBtn').addEventListener('click', () => {
  playerDiscard()  // 进入出牌选择
})
```

**状态显示：**
```html
<div class="game-status">
  📍 阶段：摸牌后
  👤 当前：你
  🤔 可以和？YES (2 番)
  💡 提示：点击"和"或选择出牌
</div>
```

## 验收标准

- [ ] 牌卡能正确显示（颜色、数字、样式）
- [ ] 新摸的牌在最右边且有金色边框
- [ ] 胡牌检查算法正确
- [ ] 自摸检查准确
- [ ] 能正确计算番数
- [ ] UI 按钮按流程显示/隐藏
- [ ] 玩家可以点击"和"按钮来宣布胡牌
- [ ] AI 玩家也能正确检查胡牌
- [ ] 没有浏览器错误

## 依赖

**已有的：**
- `checkWin()` WASM 函数（但可能需要改进）
- `sortHand()` 排序函数
- GameController 状态机

**可能需要的：**
- 优化 WASM 的 checkWin() 或用 TypeScript 重新实现更可靠的版本

## 完成后

提交 git commit：
```bash
git add .
git commit -m "feat: 实现牌卡图示化、胡牌和自摸逻辑

- 添加 CSS 牌卡渲染
- 实现胡牌检查算法（递归回溯）
- 添加自摸检查和番数计算
- 更新 UI 交互（和/过按钮）
- 新摸的牌带金色标记并显示在最右边"
```

## 预期时间

15-20 分钟内完成

## 可选优化（后续）

- SVG 精美牌图库
- 更复杂的番数表（对对、一色等）
- 胡牌动画和音效
