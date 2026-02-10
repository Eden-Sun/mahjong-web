# Cursor Agent 開發任務

## 背景
- 我們有一個麻將遊戲前端（TypeScript + WASM）
- 當前實現：基礎 UI、手牌排序、AI 簡單出牌
- 需要優化：按照標準台灣麻將規則實現完整遊戲邏輯

## 任務列表

### 1. 遊戲狀態管理
**文件**：`src/gameState.ts` (新建)

實現以下結構：
```typescript
interface GameState {
  players: Player[]
  currentPlayerIdx: number
  gamePhase: 'draw' | 'discard' | 'response' | 'end'
  lastDiscardedTile: string | null
  tileCount: number
  round: number
}

interface Player {
  name: string
  hand: string[]
  melds: Meld[]
  discardPile: string[]
  score: number
  isHuman: boolean
  canAction: boolean
}

interface Meld {
  type: 'pong' | 'kong' | 'chow'
  tiles: string[]
  isConcealed: boolean
}
```

### 2. 禁止出牌邏輯
**文件**：修改 `src/main.ts`

實現 `canPlayerDiscard()` 函數：
```typescript
function canPlayerDiscard(): boolean {
  return gameState.gamePhase === 'discard' && 
         gameState.currentPlayerIdx === 0 &&
         gameState.players[0].hand.length > 0
}
```

在 `renderPlayerHand()` 中應用：
- 當 `canPlayerDiscard() === true` 時：手牌可點擊
- 當 `canPlayerDiscard() === false` 時：手牌禁用（灰顯 + disabled）
- 顯示當前狀態提示（如「等待其他玩家響應」）

### 3. 遊戲流程轉移
**文件**：`src/gameController.ts` (新建)

實現狀態機：
```typescript
class GameController {
  async startRound() {
    // 發牌、排序
  }
  
  async playerDraw() {
    // 玩家摸牌
    // phase = 'discard'
    // 更新 UI
  }
  
  async playerDiscard(tileIdx: number) {
    // 檢查 canPlayerDiscard()
    // 出牌
    // phase = 'response'
    // 呼叫 checkOthersResponse()
  }
  
  async checkOthersResponse() {
    // 輪詢其他 3 玩家
    // 檢查可用動作（吃碰槓和）
    // 執行最高優先級動作或都過
    // phase = 'draw' → 下一位玩家
  }
}
```

### 4. 吃碰槓檢查
**文件**：`src/actionChecker.ts` (新建)

實現檢查函數：
```typescript
function canPong(hand: string[], tile: string): boolean
function canKong(hand: string[], tile: string): boolean
function canChow(hand: string[], tile: string): [boolean, string[]]
function canWin(hand: string[], melds: Meld[], tile?: string): {canWin: boolean, fans: number}
```

### 5. 優先級邏輯
**Priority Order**（高到低）：
1. **和** - 任何人都可和
2. **槓** - 有該牌的人
3. **碰** - 任何人都可碰
4. **吃** - 只有下家
5. **過** - 無法應對

### 6. 玩家 UI 更新
**文件**：修改 `src/main.ts` 的 `showGameBoard()`

添加當前狀態顯示：
```html
<!-- 狀態欄 -->
<div>
  📍 當前階段：${gamePhase}
  👤 當前玩家：${players[currentIdx].name}
  ${gamePhase === 'response' ? '⏳ 等待響應...' : ''}
  ${gamePhase === 'discard' && currentIdx === 0 ? '👉 點擊手牌出牌' : ''}
</div>
```

### 7. AI 智能化
**文件**：`src/aiLogic.ts` (新建)

實現 AI 決策：
```typescript
function getAIAction(player: Player, lastTile: string): 'pong' | 'kong' | 'chow' | 'win' | 'pass'
function getAIDiscard(hand: string[]): string  // 返回索引
```

優先級：
1. 有和牌機會 → 和
2. 有槓的機會 → 槓
3. 有碰的機會 → 碰
4. 有吃的機會（下家）→ 吃
5. 其他 → 過 或隨機出最危險的牌

## 驗收清單

- [ ] gamePhase 狀態轉移正確
- [ ] 玩家摸牌後才能出牌
- [ ] 吃碰槓後才能出牌
- [ ] 禁止在 RESPONSE 階段出牌
- [ ] 禁止在其他玩家回合出牌
- [ ] UI 按鈕禁用邏輯正確
- [ ] 當前狀態清晰顯示
- [ ] AI 有響應邏輯
- [ ] 流程不卡死

## 依賴

**已有的：**
- WASM 遊戲引擎（摸牌、和牌檢查）
- 基礎 UI 框架
- 手牌排序邏輯

**不需要實現：**
- 計分細節（番數計算暫時簡化）
- 複雜 AI（可以簡單決策）

## 進度追蹤

使用 git commit，格式：
```
feat: 實現吃碰槓響應機制

- 添加 GameController 類
- 實現 checkOthersResponse() 狀態轉移
- 添加優先級邏輯
```
