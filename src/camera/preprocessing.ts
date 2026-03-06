/**
 * 影像前處理管線
 *
 * 將 base64 imageDataUrl 轉換為模型可接受的 tensor。
 *
 * 假設模型輸入格式：
 *   shape: [1, INPUT_HEIGHT, INPUT_WIDTH, 3]
 *   dtype: float32
 *   值域: [0, 1]（normalize by /255）
 */

import * as tf from '@tensorflow/tfjs'

// ── 模型輸入尺寸常數 ──────────────────────────────────
// 依實際訓練模型調整，常見 YOLO/SSD 輸入為 320 或 416
export const INPUT_WIDTH = 320
export const INPUT_HEIGHT = 320
export const INPUT_CHANNELS = 3

/**
 * 將 base64 dataURL 解碼為 HTMLImageElement
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(new Error(`Image decode failed: ${e}`))
    img.src = dataUrl
  })
}

/**
 * imageDataUrl -> 模型輸入 tensor
 *
 * 步驟：
 *   1. 解碼圖片為 HTMLImageElement
 *   2. tf.browser.fromPixels 轉為 [H, W, 3] uint8 tensor
 *   3. resizeBilinear 至 [INPUT_HEIGHT, INPUT_WIDTH]
 *   4. 除以 255 正規化至 [0, 1]
 *   5. expandDims 加上 batch 維度 -> [1, H, W, 3]
 *
 * @returns shape [1, INPUT_HEIGHT, INPUT_WIDTH, 3] float32 tensor
 */
export async function preprocessImage(dataUrl: string): Promise<tf.Tensor4D> {
  const img = await loadImage(dataUrl)

  // tf.tidy 自動回收中間 tensor，但 async 環境下需手動管理
  const raw = tf.browser.fromPixels(img) // [H, W, 3] uint8
  const resized = tf.image.resizeBilinear(raw, [INPUT_HEIGHT, INPUT_WIDTH]) // [H', W', 3] float32
  const normalized = resized.div(255) as tf.Tensor3D // [0, 1]
  const batched = normalized.expandDims(0) as tf.Tensor4D // [1, H', W', 3]

  // 釋放中間 tensor
  raw.dispose()
  resized.dispose()
  normalized.dispose()

  return batched
}
