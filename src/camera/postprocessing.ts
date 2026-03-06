/**
 * 模型輸出後處理管線
 *
 * 將原始 tensor 輸出轉換為 RecognizedTile[] 格式。
 *
 * 假設模型輸出格式（典型 detection model）：
 *   - boxes:  [1, N, 4]  — 歸一化座標 [y1, x1, y2, x2]
 *   - scores: [1, N]     — 每個 box 的最高信心分數
 *   - classes:[1, N]     — 類別索引（0–33 對應 34 種牌）
 *
 * 實際格式需依訓練模型調整。這裡提供合理骨架，
 * 只需修改 parseModelOutput 即可對接不同模型。
 */

import type { RecognizedTile, TileId } from './types'
import { VALID_TILE_IDS } from './types'

/** 信心閾值 — 低於此值的偵測結果會被丟棄 */
export const CONFIDENCE_THRESHOLD = 0.5

/** 類別索引 → TileId 映射（索引 0–33 對應 VALID_TILE_IDS） */
export function classIndexToTileId(index: number): TileId | null {
  if (index < 0 || index >= VALID_TILE_IDS.length) return null
  return VALID_TILE_IDS[index]
}

/** 原始模型輸出的結構化表示 */
export interface RawDetection {
  classIndex: number
  confidence: number
  // 歸一化座標 [y1, x1, y2, x2]
  box: [number, number, number, number]
}

/**
 * 解析模型原始輸出為 RawDetection[]
 *
 * NOTE: 這個函式是對接模型的核心銜接點。
 *       不同模型的輸出 tensor 數量/shape 不同，
 *       請依實際模型修改此函式。
 *
 * @param outputs - model.predict() 的回傳值
 * @param imageWidth - 原圖寬（用於反歸一化 bbox）
 * @param imageHeight - 原圖高
 */
export function parseModelOutput(
  outputs: Record<string, Float32Array>,
  numDetections: number,
  imageWidth: number,
  imageHeight: number,
): RecognizedTile[] {
  const boxes = outputs['boxes']     // [N*4] flattened
  const scores = outputs['scores']   // [N]
  const classes = outputs['classes'] // [N]

  if (!boxes || !scores || !classes) {
    console.warn('[postprocessing] Model output missing expected keys (boxes/scores/classes)')
    return []
  }

  const results: RecognizedTile[] = []

  for (let i = 0; i < numDetections; i++) {
    const confidence = scores[i]
    if (confidence < CONFIDENCE_THRESHOLD) continue

    const classIndex = Math.round(classes[i])
    const tileId = classIndexToTileId(classIndex)
    if (!tileId) continue

    // 歸一化座標 [y1, x1, y2, x2] -> 像素座標 [x, y, w, h]
    const y1 = boxes[i * 4]
    const x1 = boxes[i * 4 + 1]
    const y2 = boxes[i * 4 + 2]
    const x2 = boxes[i * 4 + 3]

    const x = Math.round(x1 * imageWidth)
    const y = Math.round(y1 * imageHeight)
    const w = Math.round((x2 - x1) * imageWidth)
    const h = Math.round((y2 - y1) * imageHeight)

    results.push({
      tileId,
      confidence,
      bbox: [x, y, w, h],
    })
  }

  // 依 x 座標排序（從左到右 = 牌序）
  results.sort((a, b) => a.bbox[0] - b.bbox[0])

  return results
}
