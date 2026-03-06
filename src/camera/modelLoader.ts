/**
 * TensorFlow.js 模型載入器
 *
 * 負責懶載入（lazy init）和快取（cache），確保模型只載入一次。
 * 模型路徑可透過 MODEL_URL 常數調整。
 */

import * as tf from '@tensorflow/tfjs'

/** 模型檔案路徑 — 預設指向 public/models/mahjong/model.json */
export const MODEL_URL = '/models/mahjong/model.json'

/** 模型載入狀態 */
export type ModelStatus =
  | { state: 'unloaded' }
  | { state: 'loading' }
  | { state: 'ready'; model: tf.GraphModel }
  | { state: 'error'; error: unknown }

let modelStatus: ModelStatus = { state: 'unloaded' }
let loadPromise: Promise<tf.GraphModel> | null = null

/**
 * 取得已載入的模型，若尚未載入則自動觸發載入。
 * 多次呼叫只會載入一次（lazy singleton）。
 *
 * @returns 載入完成的 GraphModel，失敗則 throw
 */
export async function getModel(): Promise<tf.GraphModel> {
  if (modelStatus.state === 'ready') {
    return modelStatus.model
  }

  if (modelStatus.state === 'error') {
    // 重試：清除舊的失敗狀態
    modelStatus = { state: 'unloaded' }
    loadPromise = null
  }

  if (!loadPromise) {
    modelStatus = { state: 'loading' }
    loadPromise = tf.loadGraphModel(MODEL_URL)
      .then((model) => {
        modelStatus = { state: 'ready', model }
        return model
      })
      .catch((err) => {
        modelStatus = { state: 'error', error: err }
        loadPromise = null
        throw err
      })
  }

  return loadPromise
}

/** 取得目前模型狀態（不觸發載入） */
export function getModelStatus(): ModelStatus {
  return modelStatus
}

/**
 * 手動釋放模型（測試或頁面離開時使用）
 */
export function disposeModel(): void {
  if (modelStatus.state === 'ready') {
    modelStatus.model.dispose()
  }
  modelStatus = { state: 'unloaded' }
  loadPromise = null
}
