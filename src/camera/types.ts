/**
 * 麻將牌辨識 — Domain Types
 *
 * 牌型編碼沿用現有 gameState 格式：
 *   萬: 1m–9m, 筒: 1p–9p, 索: 1s–9s
 *   風: E/S/W/N, 箭: B/F/Z
 */

/** 所有合法牌型字串 */
export const VALID_TILE_IDS = [
  '1m','2m','3m','4m','5m','6m','7m','8m','9m',
  '1p','2p','3p','4p','5p','6p','7p','8p','9p',
  '1s','2s','3s','4s','5s','6s','7s','8s','9s',
  'E','S','W','N',
  'B','F','Z',
] as const

export type TileId = typeof VALID_TILE_IDS[number]

export function isValidTileId(s: string): s is TileId {
  return (VALID_TILE_IDS as readonly string[]).includes(s)
}

/** 單張辨識結果 */
export interface RecognizedTile {
  tileId: TileId
  confidence: number               // 0–1
  bbox: [x: number, y: number, w: number, h: number]
}

/** 整張照片的辨識結果 */
export interface RecognitionResult {
  tiles: RecognizedTile[]
  imageDataUrl: string              // 原圖 base64（用於校正 UI 顯示）
  processingMs: number              // 推論耗時
}

/** 使用者校正後的牌列表 */
export interface CorrectedTiles {
  tiles: TileId[]
  originalResult: RecognitionResult // 保留原始結果，供未來回饋訓練
}

/** 相機狀態 */
export type CameraStatus =
  | { state: 'idle' }
  | { state: 'requesting' }         // 正在請求權限
  | { state: 'streaming' }          // 串流中
  | { state: 'captured'; imageDataUrl: string }
  | { state: 'recognizing' }        // 辨識中
  | { state: 'result'; result: RecognitionResult }
  | { state: 'error'; message: string }
