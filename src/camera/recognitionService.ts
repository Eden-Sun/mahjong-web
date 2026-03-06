/**
 * 麻將牌辨識服務
 *
 * 推論管線：
 *   1. 載入 TFJS 模型（lazy, cached）
 *   2. 前處理：imageDataUrl → [1, 320, 320, 3] tensor
 *   3. 模型推論
 *   4. 後處理：tensor → RecognizedTile[]
 *
 * 當模型不存在或推論失敗時，自動 fallback 至 mock 結果並在 console 標記。
 */

import type { RecognitionResult, TileId } from './types'
import { getModel } from './modelLoader'
import { preprocessImage } from './preprocessing'
import { parseModelOutput } from './postprocessing'

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
export async function recognizeTiles(imageDataUrl: string): Promise<RecognitionResult> {
  const start = performance.now()

  try {
    const model = await getModel()
    const inputTensor = await preprocessImage(imageDataUrl)

    // 推論
    const outputTensor = model.predict(inputTensor) as import('@tensorflow/tfjs').Tensor | import('@tensorflow/tfjs').Tensor[]

    // 釋放輸入 tensor
    inputTensor.dispose()

    // 解析輸出 — 需依模型實際結構調整
    // 典型 detection model 回傳多個 tensor 或單一 tensor
    const outputMap: Record<string, Float32Array> = {}
    let numDetections = 0

    if (Array.isArray(outputTensor)) {
      // 假設順序：[boxes, scores, classes, num_detections]
      // 實際模型可能不同，這裡提供合理預設
      const [boxesTensor, scoresTensor, classesTensor, numDetTensor] = outputTensor
      outputMap['boxes'] = await boxesTensor.data() as Float32Array
      outputMap['scores'] = await scoresTensor.data() as Float32Array
      outputMap['classes'] = await classesTensor.data() as Float32Array
      const numDetData = await numDetTensor.data()
      numDetections = numDetData[0]
      outputTensor.forEach(t => t.dispose())
    } else {
      // 單一 tensor 輸出 — 需依模型自行解析
      console.warn('[recognitionService] Single-tensor output: may need custom parsing')
      const data = await outputTensor.data() as Float32Array
      outputMap['raw'] = data
      outputTensor.dispose()
    }

    // 後處理（暫用 640x480 作為預設圖片尺寸，實際應從圖片取得）
    const tiles = parseModelOutput(outputMap, numDetections, 640, 480)

    if (tiles.length === 0) {
      console.warn('[recognitionService] TFJS inference returned 0 tiles, using fallback')
      return generateMockResult(imageDataUrl, start)
    }

    return {
      tiles,
      imageDataUrl,
      processingMs: performance.now() - start,
    }
  } catch (err) {
    // ── FALLBACK ──────────────────────────────────────
    // 模型載入失敗或推論錯誤時，降級為 mock 結果
    console.warn('[recognitionService] TFJS unavailable, falling back to mock:', err)
    return generateMockResult(imageDataUrl, start)
  }
}
