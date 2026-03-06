/**
 * 麻將牌辨識服務
 *
 * 推論管線：
 *   1. 載入 TFJS 模型（lazy, cached）
 *   2. 前處理：imageDataUrl → [1, 640, 640, 3] tensor
 *   3. 模型推論（YOLOv8 single-tensor 或舊版多 tensor）
 *   4. 後處理：tensor → RecognizedTile[]
 *
 * 當模型不存在或推論失敗時，自動 fallback 至 mock 結果並在 console 標記。
 */

import type { RecognitionResult, TileId } from './types'
import { VALID_TILE_IDS } from './types'
import { getModel } from './modelLoader'
import { preprocessImage, INPUT_WIDTH, INPUT_HEIGHT } from './preprocessing'
import { parseYolov8Output, parseModelOutput } from './postprocessing'

// ── Inference mode tag ──────────────────────────────

export type InferenceMode = 'REAL_MODEL' | 'FALLBACK_MOCK'

// ── Mock fallback ─────────────────────────────────────

const MOCK_TILES: TileId[] = ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '9s', 'E', 'S', 'F']

function generateMockResult(imageDataUrl: string, startTime: number): RecognitionResult {
  const tiles = MOCK_TILES.map((tileId, i) => ({
    tileId,
    confidence: 0.85 + Math.random() * 0.15,
    bbox: [i * 40, 10, 36, 50] as [number, number, number, number],
  }))
  return {
    tiles,
    imageDataUrl,
    processingMs: performance.now() - startTime,
  }
}

// ── 主辨識函式 ─────────────────────────────────────────

/**
 * 辨識圖片中的麻將牌
 *
 * @param imageDataUrl - base64 圖片資料
 * @returns 辨識結果（TFJS 推論或 fallback mock）
 */
export async function recognizeTiles(
  imageDataUrl: string,
  options?: { signal?: AbortSignal }
): Promise<RecognitionResult> {
  const start = performance.now()
  const signal = options?.signal

  try {
    assertNotAborted(signal)
    const model = await getModel()
    assertNotAborted(signal)
    const inputTensor = await preprocessImage(imageDataUrl)
    assertNotAborted(signal)

    // 推論
    const outputTensor = model.predict(inputTensor) as import('@tensorflow/tfjs').Tensor | import('@tensorflow/tfjs').Tensor[]

    // 釋放輸入 tensor
    inputTensor.dispose()
    assertNotAborted(signal)

    let tiles: import('./types').RecognizedTile[]

    if (Array.isArray(outputTensor)) {
      if (outputTensor.length === 1) {
        // YOLOv8 TFJS: 單一 tensor wrapped in array, shape [1, 4+numClasses, numDetections]
        const tensor = outputTensor[0]
        const shape = tensor.shape // e.g. [1, 38, 8400]
        const data = await tensor.data() as Float32Array
        tensor.dispose()

        const numRows = shape[1]! // 4 + numClasses
        const numDetections = shape[2]! // 8400
        tiles = parseYolov8Output(data, numRows, numDetections, INPUT_WIDTH, INPUT_HEIGHT)
      } else {
        // 舊版多 tensor: [boxes, scores, classes, num_detections]
        const [boxesTensor, scoresTensor, classesTensor, numDetTensor] = outputTensor
        const outputMap: Record<string, Float32Array> = {
          boxes: await boxesTensor.data() as Float32Array,
          scores: await scoresTensor.data() as Float32Array,
          classes: await classesTensor.data() as Float32Array,
        }
        const numDetData = await numDetTensor.data()
        const numDetections = numDetData[0]
        outputTensor.forEach(t => t.dispose())
        tiles = parseModelOutput(outputMap, numDetections, INPUT_WIDTH, INPUT_HEIGHT)
      }
    } else {
      // 單一 tensor — YOLOv8 直接輸出 shape [1, 38, 8400]
      const shape = outputTensor.shape
      const data = await outputTensor.data() as Float32Array
      outputTensor.dispose()

      if (shape.length === 3 && shape[1]! >= VALID_TILE_IDS.length + 4) {
        const numRows = shape[1]!
        const numDetections = shape[2]!
        tiles = parseYolov8Output(data, numRows, numDetections, INPUT_WIDTH, INPUT_HEIGHT)
      } else {
        // 未知格式
        console.warn('[recognitionService] Unknown single-tensor output shape:', shape)
        const outputMap: Record<string, Float32Array> = { raw: data }
        tiles = parseModelOutput(outputMap, 0, INPUT_WIDTH, INPUT_HEIGHT)
      }
    }

    assertNotAborted(signal)

    if (tiles.length === 0) {
      console.warn('[recognitionService] REAL_MODEL inference returned 0 tiles, using FALLBACK_MOCK')
      logInferenceMode('FALLBACK_MOCK', performance.now() - start)
      return generateMockResult(imageDataUrl, start)
    }

    logInferenceMode('REAL_MODEL', performance.now() - start, tiles.length)

    return {
      tiles,
      imageDataUrl,
      processingMs: performance.now() - start,
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw err
    }

    // ── FALLBACK ──────────────────────────────────────
    console.warn('[recognitionService] TFJS unavailable, using FALLBACK_MOCK:', err)
    logInferenceMode('FALLBACK_MOCK', performance.now() - start)
    return generateMockResult(imageDataUrl, start)
  }
}

function logInferenceMode(mode: InferenceMode, ms: number, tileCount?: number): void {
  const tag = mode === 'REAL_MODEL'
    ? '%c[REAL_MODEL]'
    : '%c[FALLBACK_MOCK]'
  const style = mode === 'REAL_MODEL'
    ? 'color: #22c55e; font-weight: bold'
    : 'color: #f59e0b; font-weight: bold'

  const detail = tileCount != null ? ` — ${tileCount} tiles detected` : ''
  console.log(`${tag} inference ${ms.toFixed(0)}ms${detail}`, style)
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Recognition aborted', 'AbortError')
  }
}
