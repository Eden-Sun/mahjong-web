# SyntaxError 修復

## 錯誤信息
```
Uncaught SyntaxError: Invalid or unexpected token (at (index):1:16)
```

## 根本原因

響應按鈕的 HTML 生成使用了錯誤的引號轉義：

**錯誤代碼：**
```javascript
'<button onclick="playerResponse(\\\'win\\\')" ...>🎉 和牌</button>'
```

這會生成錯誤的 HTML：
```html
<button onclick="playerResponse(\'win\')" ...>
```

瀏覽器無法解析這個語法，導致 SyntaxError。

## 修復方案

將單引號字符串改為模板字符串（反引號）：

**修復後：**
```javascript
`<button onclick="playerResponse('win')" ...>🎉 和牌</button>`
```

這會生成正確的 HTML：
```html
<button onclick="playerResponse('win')" ...>
```

## 修改的文件

- `src/main.ts` 第 313-316 行
  - ✅ 和牌按鈕
  - ✅ 槓按鈕
  - ✅ 碰按鈕
  - ✅ 吃按鈕

## 測試

刷新頁面後應該不再有 SyntaxError，響應按鈕可以正常點擊。
