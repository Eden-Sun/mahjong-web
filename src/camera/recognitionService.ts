/**
 * 麻將牌辨識服務
 *
 * 目前為 mock 實作，回傳固定結果。
 * TODO: 接入真實模型（TensorFlow.js / ONNX Runtime Web / Cloud API）
 */

import type { RecognitionResult, TileId } from './types'

const MOCK_TILES: TileId[] = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','9s','E','S','F']

/**
 * 辨識圖片中的麻將牌
 *
 * @param imageDataUrl - base64 圖片資料
 * @returns 辨識結果
 */
export async function recognizeTiles(imageDataUrl: string): Promise<RecognitionResult> {
  const start = performance.now()

  // TODO: 替換為真實推論
  // 可能的接入方式：
  //   1. TensorFlow.js：載入 .tflite / .json 模型，在瀏覽器端推論
  //   2. ONNX Runtime Web：載入 .onnx 模型
  //   3. Cloud API：POST 圖片至後端 /api/recognize
  await simulateDelay(300)

  const tiles = MOCK_TILES.map((tileId, i) => ({
    tileId,
    confidence: 0.85 + Math.random() * 0.15,         // 0.85–1.0
    bbox: [i * 40, 10, 36, 50] as [number, number, number, number],
  }))

  return {
    tiles,
    imageDataUrl,
    processingMs: performance.now() - start,
  }
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
