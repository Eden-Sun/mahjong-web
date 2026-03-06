# 麻將牌相機辨識功能

## 目前進度

**Phase 2 — TFJS 推論管線骨架完成**（含 fallback）

| 項目 | 狀態 |
|------|------|
| Domain types（TileId、RecognitionResult、CorrectedTiles、CameraStatus） | Done |
| 相機擷取模組（getUserMedia + 檔案上傳降級） | Done |
| TFJS 推論管線（載入 → 前處理 → 推論 → 後處理） | Done |
| Fallback（模型不存在或推論失敗 → mock 結果） | Done |
| 校正 UI（可編輯每張牌、刪除、確認/取消） | Done |
| 完整頁面流程（idle → 拍照/上傳 → 預覽 → 辨識 → 校正 → 完成） | Done |
| 主選單入口（📷 辨識牌組） | Done |
| 單元測試（types + service fallback + postprocessing） | Done |
| TypeScript 編譯通過 | Done |

## 檔案結構

```
src/camera/
  types.ts              # Domain types：TileId, RecognitionResult, CorrectedTiles, CameraStatus
  cameraCapture.ts      # getUserMedia 封裝、拍照、檔案上傳
  modelLoader.ts        # TFJS GraphModel 懶載入 + 快取（singleton）
  preprocessing.ts      # imageDataUrl → [1, 320, 320, 3] float32 tensor
  postprocessing.ts     # model output → RecognizedTile[]（含 NMS、類別映射）
  recognitionService.ts # 辨識服務：TFJS 推論 + fallback mock
  correctionUI.ts       # 校正 UI 元件
  cameraPage.ts         # 頁面流程控制

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

## 模型部署

### 放置模型檔案

將 TensorFlow.js GraphModel 檔案放至 `public/models/mahjong/`：

```
public/models/mahjong/
  model.json          # 模型拓撲 + 權重清單
  group1-shard1of1.bin  # 權重二進位檔（可能多個 shard）
```

路徑可透過 `src/camera/modelLoader.ts` 的 `MODEL_URL` 常數修改。

### 預期輸入 tensor 格式

| 屬性 | 值 |
|------|-----|
| shape | `[1, 320, 320, 3]` |
| dtype | `float32` |
| 值域 | `[0, 1]`（原始像素 ÷ 255） |
| 色彩空間 | RGB |

尺寸常數定義於 `src/camera/preprocessing.ts`（`INPUT_WIDTH`, `INPUT_HEIGHT`）。
若模型訓練時使用不同尺寸，修改這兩個常數即可。

### 預期輸出 tensor 格式

模型應輸出多個 tensor（典型 object detection 格式）：

| 輸出 tensor | shape | 說明 |
|-------------|-------|------|
| `boxes` | `[1, N, 4]` | 歸一化座標 `[y1, x1, y2, x2]`，值域 `[0, 1]` |
| `scores` | `[1, N]` | 每個偵測框的信心分數 |
| `classes` | `[1, N]` | 類別索引（0–33，對應 `VALID_TILE_IDS` 順序） |
| `num_detections` | `[1]` | 有效偵測數量 |

類別索引對應：

```
 0: 1m   1: 2m   2: 3m  ...  8: 9m
 9: 1p  10: 2p  ...         17: 9p
18: 1s  19: 2s  ...         26: 9s
27: E   28: S   29: W   30: N
31: B   32: F   33: Z
```

後處理邏輯在 `src/camera/postprocessing.ts`。
若模型輸出格式不同，修改 `parseModelOutput()` 即可。

### 信心閾值

`CONFIDENCE_THRESHOLD = 0.5`（定義於 `postprocessing.ts`）。
低於此閾值的偵測結果會被丟棄。

## Fallback 行為

當以下任一狀況發生時，自動降級為 mock 結果：

1. **模型檔案不存在**（fetch model.json 失敗）
2. **TFJS 載入失敗**（瀏覽器不支援 WebGL 等）
3. **推論拋出例外**
4. **推論結果為空**（0 個有效偵測）

Fallback 時會在 console 輸出 `[recognitionService] TFJS unavailable, falling back to mock` 警告。
Mock 結果固定回傳 16 張牌（1m–9m, 1p, 2p, 3p, 9s, E, S, F），方便開發測試。

## 下一步

1. **訓練模型**：
   - 收集標註資料（5000+ 張照片）
   - YOLOv8n / MobileNet-SSD，目標 < 10MB
   - 匯出至 TF.js GraphModel 格式

2. **校正資料回饋**：
   - 使用者修正後的 `CorrectedTiles.originalResult` 可作為再訓練資料
   - 需設計回傳 API 與匿名化處理

3. **與遊戲整合**：
   - 辨識結果 → 設定為玩家手牌
   - 需處理牌數驗證（台灣麻將 16 張）
