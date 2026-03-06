# 麻將牌相機辨識功能

## 目前進度

**Phase 1 骨架完成**（mock 推論，UI 可運作）

| 項目 | 狀態 |
|------|------|
| Domain types（TileId、RecognitionResult、CorrectedTiles、CameraStatus） | Done |
| 相機擷取模組（getUserMedia + 檔案上傳降級） | Done |
| Mock 辨識服務（固定回傳 16 張牌） | Done |
| 校正 UI（可編輯每張牌、刪除、確認/取消） | Done |
| 完整頁面流程（idle → 拍照/上傳 → 預覽 → 辨識 → 校正 → 完成） | Done |
| 主選單入口（📷 辨識牌組） | Done |
| 單元測試（types + mock service） | Done |
| TypeScript 編譯通過 | Done |

## 檔案結構

```
src/camera/
  types.ts              # Domain types：TileId, RecognitionResult, CorrectedTiles, CameraStatus
  cameraCapture.ts      # getUserMedia 封裝、拍照、檔案上傳
  recognitionService.ts # 辨識服務（目前 mock，留 TODO）
  correctionUI.ts       # 校正 UI 元件
  cameraPage.ts         # 頁面流程控制

src/styles/camera.css   # 相機相關樣式
src/__tests__/camera.test.ts  # 單元測試
```

## 如何啟動

```bash
bun run dev
# 開啟瀏覽器 → 主選單 → 點擊「📷 辨識牌組」
```

手機測試需 HTTPS（getUserMedia 限制），開發時可用：
```bash
# 使用 vite 的 --host 搭配手機同網段存取
# 或用 ngrok / Cloudflare Tunnel 取得 HTTPS URL
```

## 下一步：接入真實模型

1. **選擇推論方式**（二擇一）：
   - **On-device**：TensorFlow.js / ONNX Runtime Web，載入量化模型
   - **Cloud API**：POST 圖片到後端 `/api/recognize`

2. **修改 `recognitionService.ts`**：
   - 替換 `recognizeTiles()` 內的 mock 邏輯
   - 實作 NMS（Non-Maximum Suppression）後處理
   - 依 bbox x 座標排序，對應實際牌序

3. **訓練模型**：
   - 收集標註資料（5000+ 張照片）
   - YOLOv8n / MobileNet-SSD，目標 < 10MB
   - 匯出至 TF.js 或 ONNX 格式

4. **校正資料回饋**：
   - 使用者修正後的 `CorrectedTiles.originalResult` 可作為再訓練資料
   - 需設計回傳 API 與匿名化處理

5. **與遊戲整合**：
   - 辨識結果 → 設定為玩家手牌
   - 需處理牌數驗證（台灣麻將 16 張）
