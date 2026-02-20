# 吃碰後出牌功能修復

## 問題
玩家成功吃牌或碰牌後，無法選擇手牌進行捨牌。

## 已修復

### 1. 添加延遲確保 UI 更新
在吃牌和碰牌後，添加 100ms 延遲，確保 UI 有時間重新渲染。

```typescript
// 在 executeResponse 的 chow 和 pong case 中
this.updateState()
await this.delay(100)  // 新增：確保 UI 更新
console.log('🎯 吃/碰牌後 canPlayerDiscard:', this.canPlayerDiscard())
```

### 2. 添加調試日誌
- `🎯 吃牌後 canPlayerDiscard:` - 顯示吃牌後是否可以出牌
- `🎯 碰牌後 canPlayerDiscard:` - 顯示碰牌後是否可以出牌

## 測試步驟

1. 訪問 http://localhost:5173
2. 開啟 F12 Console
3. 開始遊戲
4. 等待吃牌或碰牌機會
5. 點擊「➡️ 吃」或「🤝 碰」
6. 觀察：
   - Console 是否顯示 `🎯 吃/碰牌後 canPlayerDiscard: true`
   - 手牌是否可以點擊（cursor 應該是 pointer，不是 not-allowed）
   - 點擊手牌是否能成功出牌

## 預期行為

吃牌/碰牌後：
- ✅ gamePhase 變為 'discard'
- ✅ currentPlayerIdx 變為玩家索引（0）
- ✅ waitingForResponse 變為 false
- ✅ canPlayerDiscard() 返回 true
- ✅ 手牌變成可點擊（綠色高亮，cursor: pointer）
- ✅ 點擊手牌可以出牌

## 可能的問題

如果仍然無法出牌，檢查 Console 日誌：

### 問題 A: canPlayerDiscard 返回 false
查看日誌中的詳細條件：
```
🔍 canPlayerDiscard: {
  result: false,
  gamePhase: "...",
  currentPlayerIdx: ...,
  handLength: ...,
  waitingForResponse: ...
}
```

### 問題 B: UI 沒有重新渲染
查看是否有 `✅ 執行渲染` 日誌。如果沒有，可能是渲染被跳過了。

### 問題 C: 手牌仍然是 disabled
查看 HTML，檢查 `<button class="hand-tile-button">` 是否有 `disabled` 屬性。
