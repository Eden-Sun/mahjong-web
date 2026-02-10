# 麻將遊戲規則 SPEC

## 1. 遊戲狀態管理

### GameState 結構
```typescript
interface GameState {
  players: Player[]
  currentPlayerIdx: number      // 當前玩家
  gamePhase: 'draw' | 'discard' | 'response' | 'end'
  lastDiscardedTile: string | null
  tileCount: number
  round: number
}

interface Player {
  name: string
  hand: string[]
  melds: Meld[]              // 碰、槓、吃的牌組
  discardPile: string[]      // 已出牌
  score: number
  isHuman: boolean
  canAction: boolean         // 是否有響應權（吃碰槓）
}

interface Meld {
  type: 'pong' | 'kong' | 'chow'  // 碰/槓/吃
  tiles: string[]
  isConcealed: boolean             // 暗槓
}
```

## 2. 遊戲流程

### 初始化
1. 給 4 位玩家各發 16 張牌（WASM 處理）
2. 玩家手牌自動排序
3. 設定 currentPlayerIdx = 0（東家）
4. gamePhase = 'draw'

### 玩家轉順序
**東 → 南 → 西 → 北 → 東...**

### 每輪流程
```
1. DRAW 階段
   ├─ 檢查 tileCount > 0
   ├─ 從 WASM 摸牌
   ├─ 加入玩家手牌（自動排序）
   └─ gamePhase = 'discard'

2. DISCARD 階段
   ├─ 如果是玩家 (isHuman) → 啟用出牌按鈕，等待選擇
   ├─ 如果是 AI → 自動選牌出牌
   ├─ 出牌後從手牌移除，加入 discardPile
   ├─ 設定 lastDiscardedTile
   └─ gamePhase = 'response'

3. RESPONSE 階段（其他 3 玩家有響應權）
   ├─ 輪詢其他 3 玩家（順序：下家 → 對家 → 上家）
   ├─ 檢查可否吃、碰、槓、和
   │  ├─ 和優先級最高（任何人都可和）
   │  ├─ 槓次之（只有有該牌的人）
   │  ├─ 碰次之（任何人都可碰，優先權靠下家）
   │  └─ 吃最低（只有下家可吃，限定順序）
   ├─ 如果有人響應 → 執行該動作，回到 DRAW
   ├─ 如果都不響應 → 下一位玩家
   └─ gamePhase = 'draw'

4. 和牌檢查
   ├─ 自摸和（剛摸的牌）
   ├─ 點牌和（他人出的牌）
   ├─ 檢查手牌是否達成勝牌條件
   ├─ 如果成功 → gamePhase = 'end'，計分、通知
   └─ 否則繼續

5. 局結束
   ├─ 牌堆用完 → 流局
   ├─ 有人和牌 → 計分、結算
   └─ 顯示結果，提示回到菜單
```

## 3. 出牌規則

### 何時可以出牌
**只有以下情況可出牌：**
1. 剛摸到牌（DRAW 階段剛進入 DISCARD）
2. 進行吃碰槓後（吃碰槓限制如下）

### 禁止出牌的情況
- ❌ 還沒摸牌就直接出
- ❌ 摸了但還沒明確結束摸牌動作
- ❌ 執行吃碰槓前

## 4. 吃碰槓規則

### 碰 (Pong)
- **條件**：有 2 張該牌在手，加上剛出的 1 張 = 3 張
- **誰能碰**：任何玩家都可以
- **優先級**：優先於吃，低於和、槓
- **執行**：
  ```
  碰後 → 從手牌移除 2 張
       → 加入 Melds (type: 'pong')
       → 該玩家立即摸牌出牌
  ```

### 槓 (Kong)
- **類型**：
  1. 明槓：有 3 張在手，加上他人出的 1 張
  2. 暗槓：手中有 4 張相同
  3. 加槓：已經碰過的牌，又摸到第 4 張
- **誰能槓**：槓方主動（摸到時）或碰時點出牌的人
- **優先級**：優先於碰、吃，低於和
- **執行**：
  ```
  槓後 → 從手牌移除 3 或 4 張
       → 加入 Melds (type: 'kong')
       → 補花（再從牌堆摸 1 張）
       → 該玩家繼續出牌
  ```

### 吃 (Chow)
- **條件**：只有下家可以吃（上家出的牌）
- **限制**：只能吃序數牌（1-9m, 1-9s, 1-9p），不能吃風牌和箭牌
- **可能的組合**：
  - [1, 2, 3], [2, 3, 4], ..., [7, 8, 9]
  - 例：出 5m，可吃 (3m-4m-5m) 或 (4m-5m-6m) 或 (5m-6m-7m)
- **優先級**：低於碰、槓、和
- **執行**：
  ```
  吃後 → 從手牌移除 2 張
       → 加入 Melds (type: 'chow')
       → 該玩家（下家）立即出牌
  ```

## 5. 和牌規則

### 和的條件
手牌形成有效的麻將牌型：
1. **平胡**：5 組牌（4 組面子 + 1 組眼牌）
2. **面子**：
   - 刻子（3 張相同）：由碰或暗槓組成
   - 順子（3 張連續）：由吃組成或手牌自有
3. **眼牌**：2 張相同

### 和的類型
1. **自摸和**：剛摸到的牌完成牌型
2. **點和**：他人出的牌完成牌型（可能多人點和 → 流標）

### 和牌檢查
```typescript
function checkWin(hand: string[], melds: Meld[]): {canWin: boolean, fans: number}
// 返回是否可和及番數
```

## 6. 玩家動作 UI

### 玩家（isHuman = true）
- **DISCARD 階段**：手牌全部可點擊，點擊即出牌
- **RESPONSE 階段**（輪到檢查吃碰槓）：
  ```
  如果有可用動作 → 顯示按鈕：
  - 🤝 碰
  - 🔄 槓
  - ➡️  吃
  - ⏭️  過
  
  玩家選擇後 → 執行該動作或跳過
  ```

### AI 玩家（isHuman = false）
- **DISCARD 階段**：自動選擇最不需要的牌出掉
- **RESPONSE 階段**：
  - 檢查是否有和牌機會 → 優先和
  - 檢查是否有槓的機會 → 考慮槓
  - 檢查是否有碰的機會 → 考慮碰
  - 檢查是否有吃的機會（僅下家）→ 考慮吃
  - 否則 → 過

## 7. 禁止出牌狀態

在以下狀態下，**禁用出牌按鈕**：
1. ✗ gamePhase !== 'discard'
2. ✗ currentPlayerIdx !== 0（不是玩家的回合）
3. ✗ 正在等待 RESPONSE 階段（其他玩家決定吃碰槓）
4. ✗ 任何響應動作未完成

**按鈕狀態管理**：
```typescript
function updatePlayerUI() {
  const canDiscard = 
    gamePhase === 'discard' && 
    currentPlayerIdx === 0 &&
    gameState.players[0].hand.length > 0
  
  // 啟用/禁用出牌按鈕
  document.querySelectorAll('.tile').forEach(btn => {
    btn.disabled = !canDiscard
    btn.style.opacity = canDiscard ? '1' : '0.5'
  })
}
```

## 8. 計分規則

### 番數計算
基本番數表：
- 平胡：1 番（基本分）
- 自摸：+2 番
- 門清：+1 番（未有碰槓吃）
- 全求人：+1 番（全由他人出牌）
- ... 等等（詳見 `calculateFans()` 實現）

### 分數計算
```
基礎分 = 8 × 2^(番數)
和牌者得分 = 基礎分 × 玩家數
點牌者失分 = 基礎分 × 玩家數（如果自摸則全部失分）
```

## 9. 實現優先級

### Phase 1：基礎框架
- [x] GameState 結構
- [ ] 遊戲流程管理（Phase 狀態轉移）
- [ ] DRAW → DISCARD → RESPONSE 週期
- [ ] 禁止出牌檢查

### Phase 2：出牌邏輯
- [ ] 只允許摸牌後出牌
- [ ] 吃碰槓後允許出牌
- [ ] UI 按鈕禁用邏輯

### Phase 3：吃碰槓
- [ ] 碰邏輯
- [ ] 槓邏輯（明槓、暗槓、加槓）
- [ ] 吃邏輯（下家專有）

### Phase 4：和牌
- [ ] 自摸和檢查
- [ ] 點和檢查
- [ ] 番數計算
- [ ] 計分

## 10. 技術實現建議

### 狀態機模式
```typescript
class GameController {
  state: GameState
  phase: 'draw' | 'discard' | 'response'
  
  async onPlayerSelectTile(tileIdx: number) {
    // 檢查合法性
    // 執行出牌
    // 轉移到 RESPONSE
  }
  
  async onPlayerResponse(action: 'pong' | 'kong' | 'chow' | 'pass') {
    // 執行響應
    // 轉移狀態
  }
}
```

### 玩家轉順序
```typescript
const nextPlayerIdx = (currentIdx + 1) % 4
```

### 禁用出牌的實現
```typescript
function disablePlayerActions() {
  const canAct = 
    phase === 'discard' && 
    currentPlayerIdx === 0 &&
    players[0].canAction === true
  
  // 更新 UI
}
```

---

## 快速檢查清單

- [ ] 摸牌後才能出牌
- [ ] 吃碰槓後才能出牌
- [ ] 禁止在其他階段出牌
- [ ] RESPONSE 階段其他玩家有響應權
- [ ] 和牌優先級最高
- [ ] 玩家界面清晰顯示當前狀態
- [ ] AI 邏輯合理
- [ ] 計分正確
