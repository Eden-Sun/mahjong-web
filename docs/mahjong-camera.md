# 麻將牌相機辨識功能

## 目前進度

**Phase 3 — 真實模型推論管線完成**（含 YOLOv8 TFJS + fallback）

| 項目 | 狀態 |
|------|------|
| Domain types（TileId、RecognitionResult、CorrectedTiles、CameraStatus） | Done |
| 相機擷取模組（getUserMedia + 檔案上傳降級） | Done |
| TFJS 推論管線（YOLOv8 single-tensor + 舊版多 tensor） | Done |
| YOLOv8 後處理（NMS、類別映射、confidence filter） | Done |
| Fallback（模型不存在或推論失敗 → mock 結果） | Done |
| Runtime logging（REAL_MODEL / FALLBACK_MOCK 標記） | Done |
| 校正 UI（可編輯每張牌、刪除、確認/取消） | Done |
| 完整頁面流程（idle → 拍照/上傳 → 預覽 → 辨識 → 校正 → 完成） | Done |
| 主選單入口（📷 辨識牌組） | Done |
| 單元測試（types + postprocessing + REAL_MODEL + FALLBACK_MOCK） | Done |
| 模型訓練/匯出腳本 | Done |

## 檔案結構

```
src/camera/
  types.ts              # Domain types：TileId, RecognitionResult, CorrectedTiles, CameraStatus
  cameraCapture.ts      # getUserMedia 封裝、拍照、檔案上傳
  modelLoader.ts        # TFJS GraphModel 懶載入 + 快取（singleton）
  preprocessing.ts      # imageDataUrl → [1, 640, 640, 3] float32 tensor
  postprocessing.ts     # YOLOv8 output → RecognizedTile[]（含 NMS、類別映射）
  recognitionService.ts # 辨識服務：REAL_MODEL 推論 + FALLBACK_MOCK
  correctionUI.ts       # 校正 UI 元件（含即時聽牌顯示）
  tingAdvisor.ts        # 聽牌分析器（純函式）
  cameraPage.ts         # 頁面流程控制

scripts/
  setup-model.py        # YOLOv8 模型訓練/匯出腳本

public/models/mahjong/  # 模型檔案（不 commit 進 git）
  model.json            # TFJS 模型拓撲
  group1-shard*.bin     # 權重檔案
  metadata.json         # 模型 metadata

src/__tests__/camera.test.ts  # 單元測試
```

## 模型設定

### 方式 A：訓練新模型（推薦）

使用 [Roboflow mahjong_yolo 資料集](https://universe.roboflow.com/test-wmo8i/mahjong_yolo)（4483 張圖片，34 類，CC BY 4.0）：

```bash
# 安裝 Python 依賴
pip install ultralytics roboflow

# 訓練 + 匯出（需免費 Roboflow API key）
ROBOFLOW_API_KEY=your_key python scripts/setup-model.py --train

# 訓練完成後自動匯出至 public/models/mahjong/
```

預期訓練時間：
- CPU：2-4 小時
- GPU（CUDA）：15-30 分鐘

### 方式 B：匯出現有 .pt 模型

如果你已有訓練好的 YOLOv8 .pt 模型：

```bash
python scripts/setup-model.py --export path/to/best.pt
```

### 方式 C：匯出為 ONNX（不需 TFJS 轉換環境）

```bash
python scripts/setup-model.py --export path/to/best.pt --format onnx
```

### 驗證模型是否正確安裝

```bash
# 確認模型檔案存在
ls public/models/mahjong/model.json

# 啟動開發伺服器
bun run dev

# 開啟瀏覽器 console，使用辨識功能後應看到：
# [REAL_MODEL] inference 150ms — 16 tiles detected  （綠色）
# 而非：
# [FALLBACK_MOCK] inference 2ms                      （黃色）
```

## 模型輸入/輸出格式

### YOLOv8 TFJS 輸入

| 屬性 | 值 |
|------|-----|
| shape | `[1, 640, 640, 3]` |
| dtype | `float32` |
| 值域 | `[0, 1]`（原始像素 / 255） |
| 色彩空間 | RGB |

### YOLOv8 TFJS 輸出

單一 tensor，shape `[1, 38, 8400]`：

| 維度 | 說明 |
|------|------|
| `[1, ...]` | batch（固定 1） |
| `[..., 38, ...]` | 4 (bbox: x_center, y_center, w, h) + 34 (class scores) |
| `[..., 8400]` | 偵測候選數（anchor points） |

後處理流程：
1. 遍歷 8400 個候選
2. 取最高 class score，若 < 0.5 則丟棄
3. NMS（IoU threshold = 0.45）去除重疊偵測
4. 依 x 座標排序（從左到右 = 牌序）

### 類別索引對應

```
 0: 1m   1: 2m   2: 3m  ...  8: 9m
 9: 1p  10: 2p  ...         17: 9p
18: 1s  19: 2s  ...         26: 9s
27: E   28: S   29: W   30: N
31: B   32: F   33: Z
```

**重要**：訓練時的類別順序必須與上述一致。若不同，需修改 `postprocessing.ts` 的 `VALID_TILE_IDS` 映射或在 `metadata.json` 的 `classNames` 中指定對應。

## 精度注意事項

- YOLOv8n（nano）模型約 6-13MB，適合瀏覽器推論，但精度會低於較大模型
- 推論速度取決於裝置 GPU（WebGL backend）：桌機約 50-200ms，手機約 200-800ms
- 若精度不夠，可改用 YOLOv8s（small, ~22MB）或 YOLOv8m（medium, ~50MB），修改 `setup-model.py` 的基礎模型即可
- 光線不足、牌面反光、角度傾斜都會降低辨識精度
- 建議拍攝時將牌面朝上平放，光線均勻

## Fallback 行為

當以下任一狀況發生時，自動降級為 mock 結果：

1. **模型檔案不存在**（fetch model.json 失敗）
2. **TFJS 載入失敗**（瀏覽器不支援 WebGL 等）
3. **推論拋出例外**
4. **推論結果為空**（0 個有效偵測）

瀏覽器 console 會清楚標記目前使用的模式：
- `[REAL_MODEL]`（綠色）— 真實模型推論
- `[FALLBACK_MOCK]`（黃色）— 降級為 mock 結果

Mock 結果固定回傳 16 張牌（1m-9m, 1p, 2p, 3p, 9s, E, S, F），方便開發測試。

## 即時聽牌分析

辨識校正後即時顯示聽牌資訊，無需額外操作。

### 功能

| 手牌張數 | 顯示內容 |
|----------|----------|
| 16 張（% 3 === 1） | **已聽牌**：列出所有可胡的牌 |
| 17 張（% 3 === 2） | **打出 → 可聽**：每張打出後的聽牌表，按聽牌數降序排列 |
| 其他張數 | 不顯示（有碰/槓時 13/14 張同樣適用） |

### 模組

`src/camera/tingAdvisor.ts` — 純函式，零副作用：

- `getCurrentWaits(hand: TileId[]): TileId[]`
- `getDiscardToWaits(hand: TileId[]): Partial<Record<TileId, TileId[]>>`

### 解讀說明

- 聽牌分析假設手牌為門清（無碰/槓面子），因為相機僅辨識暗牌
- 若有已碰/槓的面子，使用者可刪除對應牌張使手牌張數回到正確的 mod 3 === 1
- 牌數限制：每種牌最多 4 張，超過的不列入聽牌候選
