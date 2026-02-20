# 和牌/自摸判斷診斷

## 當前實現

### ✅ 自摸（摸牌後和牌）

**檢查流程：**
1. `gameController.playerDraw()` — 玩家摸牌
2. `checkWinNew(hand, melds, drawnTile)` — 檢查是否可以自摸
3. 如果可以 → 設置 `canWinAfterDraw = true`
4. UI 顯示綠色面板：「🏆 可以和牌！」
5. 點擊「🎉 和牌」→ `playerWin()` → 遊戲結束

**條件：**
- 手牌 + 新摸的牌 = 14 張（或 17/20 張，如果有槓）
- 能組成 4 組面子 + 1 對眼

### ✅ 點炮（別人出牌後和牌）

**檢查流程：**
1. 別人出牌 → `checkOthersResponse()`
2. `getAvailableActions(playerIdx, tile, isNextPlayer)`
3. `checkWinNew(hand, melds, undefined, discardedTile)` — 檢查是否可以點和
4. 如果可以 → `availableActions.push('win')`
5. UI 顯示響應面板：紅色「🎉 和牌」按鈕
6. 點擊 → `playerResponse('win')` → 遊戲結束

**條件：**
- 手牌 + 別人的牌 = 14 張（或 17/20 張）
- 能組成 4 組面子 + 1 對眼

## 可能的問題

### 問題 A：UI 沒有顯示按鈕

**自摸按鈕不出現：**
- 檢查 `canWinAfterDraw` 是否為 true
- 檢查 `winResultAfterDraw` 是否有值
- Console 日誌：`${currentPlayer.name} 可以自摸！番数: ${winResult.fans}`

**點炮按鈕不出現：**
- 檢查 `availableActions` 是否包含 'win'
- Console 日誌：`getAvailableActions` 的返回值

### 問題 B：判斷條件太嚴格

**可能原因：**
1. 牌數計算錯誤（手牌 + 面子 ≠ 14/17/20）
2. `canFormWinPattern` 遞歸邏輯太嚴格
3. 沒有考慮某些胡牌模式（如七對子、十三么）

**解決方案：**
- 添加更多調試日誌
- 檢查實際牌數
- 放寬判斷條件（先實現基本胡牌）

### 問題 C：按鈕點了沒反應

**自摸按鈕：**
- 檢查 `playerWin()` 是否被調用
- Console 日誌：`${player.name} 自摸！`

**點炮按鈕：**
- 檢查 `playerResponse('win')` 是否被調用
- Console 日誌：`🎯 gameController.playerResponse 被調用`

## 調試步驟

1. **開啟 Console**（F12）
2. **開始遊戲**
3. **製造胡牌機會**（摸到聽牌）
4. **觀察日誌：**
   - 摸牌後是否有：`可以自摸！` 或 `無法和牌`
   - 別人出牌後是否有：`getAvailableActions` 返回 `['win', ...]`
5. **檢查 UI：**
   - 是否出現綠色/紅色和牌按鈕
   - 按鈕是否可點擊
6. **點擊按鈕，觀察：**
   - Console 是否有 `自摸！` 或 `${player.name} 响应: win`
   - 遊戲是否結束

## 下一步

請提供以下信息：
1. **問題類型：**
   - [ ] 完全沒有和牌按鈕出現
   - [ ] 按鈕出現但點了沒反應
   - [ ] 明明可以胡但判斷不出來（請提供手牌截圖）
2. **Console 日誌**（複製相關部分）
3. **當時的手牌**（如果記得）
