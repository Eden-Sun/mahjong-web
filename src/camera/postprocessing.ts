/**
 * 模型輸出後處理管線
 *
 * YOLOv8 TFJS 輸出格式：單一 tensor, shape [1, 4+numClasses, 8400]
 *   - 前 4 行: bbox (x_center, y_center, width, height) — 像素座標
 *   - 後 numClasses 行: 各類別信心分數
 *   - 8400 列: 偵測候選數
 *
 * 也保留舊版多 tensor 格式（boxes/scores/classes）的解析路徑。
 */

import type { RecognizedTile, TileId } from './types'
import { VALID_TILE_IDS } from './types'

export const CONFIDENCE_THRESHOLD = 0.5
const IOU_THRESHOLD = 0.45
const NUM_CLASSES = VALID_TILE_IDS.length // 34

export function classIndexToTileId(index: number): TileId | null {
  if (index < 0 || index >= VALID_TILE_IDS.length) return null
  return VALID_TILE_IDS[index]
}

export interface RawDetection {
  classIndex: number
  confidence: number
  box: [number, number, number, number] // [x_center, y_center, w, h] in pixels
}

// ── YOLOv8 single-tensor 解析 ────────────────────────

/**
 * 解析 YOLOv8 TFJS 的單一 tensor 輸出
 *
 * @param raw - flattened Float32Array, shape [1, 4+numClasses, numDetections]
 * @param numDetections - 偵測候選數（通常 8400）
 * @param numRows - 每個偵測的行數（4 + numClasses）
 * @param imgWidth - 模型輸入寬度（用於歸一化 bbox）
 * @param imgHeight - 模型輸入高度
 */
export function parseYolov8Output(
  raw: Float32Array,
  numRows: number,
  numDetections: number,
  imgWidth: number,
  imgHeight: number,
): RecognizedTile[] {
  const detections: RawDetection[] = []

  for (let i = 0; i < numDetections; i++) {
    // 找到最高信心的類別
    let maxScore = -1
    let maxClassIdx = -1
    for (let c = 0; c < NUM_CLASSES; c++) {
      const score = raw[(4 + c) * numDetections + i]
      if (score > maxScore) {
        maxScore = score
        maxClassIdx = c
      }
    }

    if (maxScore < CONFIDENCE_THRESHOLD) continue

    const xCenter = raw[0 * numDetections + i]
    const yCenter = raw[1 * numDetections + i]
    const w = raw[2 * numDetections + i]
    const h = raw[3 * numDetections + i]

    detections.push({
      classIndex: maxClassIdx,
      confidence: maxScore,
      box: [xCenter, yCenter, w, h],
    })
  }

  // NMS
  const kept = nms(detections, IOU_THRESHOLD)

  return kept.map((d) => {
    const [xc, yc, w, h] = d.box
    // 轉為 [x, y, w, h] 像素座標（相對於模型輸入尺寸）
    const x = Math.round(xc - w / 2)
    const y = Math.round(yc - h / 2)
    return {
      tileId: VALID_TILE_IDS[d.classIndex],
      confidence: d.confidence,
      bbox: [x, y, Math.round(w), Math.round(h)] as [number, number, number, number],
    }
  }).sort((a, b) => a.bbox[0] - b.bbox[0])
}

// ── 舊版多 tensor 解析（向後相容） ──────────────────

export function parseModelOutput(
  outputs: Record<string, Float32Array>,
  numDetections: number,
  imageWidth: number,
  imageHeight: number,
): RecognizedTile[] {
  // YOLOv8 single-tensor 路徑
  if (outputs['raw'] && !outputs['boxes']) {
    // 需從外部得知 shape 資訊，這裡假設預設值
    const numRows = 4 + NUM_CLASSES // 38
    const numDet = outputs['raw'].length / numRows
    return parseYolov8Output(outputs['raw'], numRows, numDet, imageWidth, imageHeight)
  }

  // 舊版多 tensor 路徑
  const boxes = outputs['boxes']
  const scores = outputs['scores']
  const classes = outputs['classes']

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

    const y1 = boxes[i * 4]
    const x1 = boxes[i * 4 + 1]
    const y2 = boxes[i * 4 + 2]
    const x2 = boxes[i * 4 + 3]

    const x = Math.round(x1 * imageWidth)
    const y = Math.round(y1 * imageHeight)
    const w = Math.round((x2 - x1) * imageWidth)
    const h = Math.round((y2 - y1) * imageHeight)

    results.push({ tileId, confidence, bbox: [x, y, w, h] })
  }

  results.sort((a, b) => a.bbox[0] - b.bbox[0])
  return results
}

// ── NMS ─────────────────────────────────────────────

function iou(a: RawDetection, b: RawDetection): number {
  const [ax, ay, aw, ah] = a.box
  const [bx, by, bw, bh] = b.box

  const ax1 = ax - aw / 2, ay1 = ay - ah / 2, ax2 = ax + aw / 2, ay2 = ay + ah / 2
  const bx1 = bx - bw / 2, by1 = by - bh / 2, bx2 = bx + bw / 2, by2 = by + bh / 2

  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1)
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2)

  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const inter = iw * ih

  const areaA = aw * ah
  const areaB = bw * bh
  const union = areaA + areaB - inter

  return union > 0 ? inter / union : 0
}

function nms(detections: RawDetection[], iouThreshold: number): RawDetection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence)
  const kept: RawDetection[] = []

  for (const det of sorted) {
    let dominated = false
    for (const k of kept) {
      if (iou(det, k) > iouThreshold) {
        dominated = true
        break
      }
    }
    if (!dominated) kept.push(det)
  }

  return kept
}
