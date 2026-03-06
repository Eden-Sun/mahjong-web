import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidTileId, VALID_TILE_IDS } from '../camera/types'
import { classIndexToTileId, CONFIDENCE_THRESHOLD, parseYolov8Output } from '../camera/postprocessing'

// ── Mock TFJS before importing recognitionService ──

vi.mock('@tensorflow/tfjs', () => ({
  loadGraphModel: vi.fn(),
}))

vi.mock('../camera/preprocessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../camera/preprocessing')>()
  return {
    ...actual,
    preprocessImage: vi.fn(),
  }
})

import * as tf from '@tensorflow/tfjs'
import { preprocessImage } from '../camera/preprocessing'
import { recognizeTiles } from '../camera/recognitionService'

// ── Type tests ──────────────────────────────────────

describe('isValidTileId', () => {
  it('合法牌型全部通過', () => {
    for (const id of VALID_TILE_IDS) {
      expect(isValidTileId(id)).toBe(true)
    }
  })

  it('非法字串回傳 false', () => {
    expect(isValidTileId('')).toBe(false)
    expect(isValidTileId('10m')).toBe(false)
    expect(isValidTileId('X')).toBe(false)
    expect(isValidTileId('0p')).toBe(false)
  })
})

describe('VALID_TILE_IDS', () => {
  it('共 34 種牌', () => {
    expect(VALID_TILE_IDS.length).toBe(34)
  })

  it('包含萬筒索風箭', () => {
    expect(VALID_TILE_IDS).toContain('1m')
    expect(VALID_TILE_IDS).toContain('9p')
    expect(VALID_TILE_IDS).toContain('5s')
    expect(VALID_TILE_IDS).toContain('E')
    expect(VALID_TILE_IDS).toContain('Z')
  })
})

// ── Postprocessing tests ────────────────────────────

describe('classIndexToTileId', () => {
  it('有效索引回傳對應 TileId', () => {
    expect(classIndexToTileId(0)).toBe('1m')
    expect(classIndexToTileId(9)).toBe('1p')
    expect(classIndexToTileId(33)).toBe('Z')
  })

  it('無效索引回傳 null', () => {
    expect(classIndexToTileId(-1)).toBeNull()
    expect(classIndexToTileId(34)).toBeNull()
    expect(classIndexToTileId(100)).toBeNull()
  })
})

describe('CONFIDENCE_THRESHOLD', () => {
  it('閾值在合理範圍 (0, 1)', () => {
    expect(CONFIDENCE_THRESHOLD).toBeGreaterThan(0)
    expect(CONFIDENCE_THRESHOLD).toBeLessThan(1)
  })
})

describe('parseYolov8Output', () => {
  const NUM_CLASSES = 34
  const NUM_ROWS = 4 + NUM_CLASSES
  const NUM_DETECTIONS = 3

  function buildFakeOutput(detections: Array<{
    xc: number; yc: number; w: number; h: number
    classIdx: number; score: number
  }>): Float32Array {
    const numDet = detections.length
    const raw = new Float32Array(NUM_ROWS * numDet)

    for (let i = 0; i < numDet; i++) {
      const d = detections[i]
      raw[0 * numDet + i] = d.xc    // x_center
      raw[1 * numDet + i] = d.yc    // y_center
      raw[2 * numDet + i] = d.w     // width
      raw[3 * numDet + i] = d.h     // height
      // class scores — all zero except the target class
      raw[(4 + d.classIdx) * numDet + i] = d.score
    }
    return raw
  }

  it('正確解析高信心偵測', () => {
    const raw = buildFakeOutput([
      { xc: 100, yc: 200, w: 40, h: 60, classIdx: 0, score: 0.9 },
      { xc: 200, yc: 200, w: 40, h: 60, classIdx: 9, score: 0.8 },
    ])

    const tiles = parseYolov8Output(raw, NUM_ROWS, 2, 640, 640)

    expect(tiles).toHaveLength(2)
    expect(tiles[0].tileId).toBe('1m')
    expect(tiles[0].confidence).toBeCloseTo(0.9)
    expect(tiles[1].tileId).toBe('1p')
    expect(tiles[1].confidence).toBeCloseTo(0.8)
  })

  it('過濾低信心偵測', () => {
    const raw = buildFakeOutput([
      { xc: 100, yc: 200, w: 40, h: 60, classIdx: 0, score: 0.3 }, // below threshold
      { xc: 200, yc: 200, w: 40, h: 60, classIdx: 1, score: 0.7 },
    ])

    const tiles = parseYolov8Output(raw, NUM_ROWS, 2, 640, 640)

    expect(tiles).toHaveLength(1)
    expect(tiles[0].tileId).toBe('2m')
  })

  it('空輸入回傳空陣列', () => {
    const raw = new Float32Array(0)
    const tiles = parseYolov8Output(raw, NUM_ROWS, 0, 640, 640)
    expect(tiles).toHaveLength(0)
  })

  it('NMS 去除重疊偵測', () => {
    // 兩個幾乎完全重疊的偵測，同一類別
    const raw = buildFakeOutput([
      { xc: 100, yc: 200, w: 40, h: 60, classIdx: 0, score: 0.9 },
      { xc: 101, yc: 201, w: 40, h: 60, classIdx: 0, score: 0.7 },
    ])

    const tiles = parseYolov8Output(raw, NUM_ROWS, 2, 640, 640)
    expect(tiles).toHaveLength(1)
    expect(tiles[0].confidence).toBeCloseTo(0.9) // keeps higher confidence
  })

  it('依 x 座標排序', () => {
    const raw = buildFakeOutput([
      { xc: 300, yc: 200, w: 40, h: 60, classIdx: 2, score: 0.9 },
      { xc: 100, yc: 200, w: 40, h: 60, classIdx: 0, score: 0.8 },
      { xc: 200, yc: 200, w: 40, h: 60, classIdx: 1, score: 0.85 },
    ])

    const tiles = parseYolov8Output(raw, NUM_ROWS, 3, 640, 640)

    expect(tiles[0].tileId).toBe('1m')
    expect(tiles[1].tileId).toBe('2m')
    expect(tiles[2].tileId).toBe('3m')
  })
})

// ── recognizeTiles — model unavailable (FALLBACK_MOCK) ───

describe('recognizeTiles (FALLBACK_MOCK: model unavailable)', () => {
  beforeEach(() => {
    vi.resetModules()
    // loadGraphModel 會 reject → 觸發 fallback
    vi.mocked(tf.loadGraphModel).mockRejectedValue(new Error('model not found'))
  })

  it('回傳 mock 結構正確', async () => {
    // 需要重新 import 以拿到 fresh module state
    const { recognizeTiles: recognize } = await import('../camera/recognitionService')
    const result = await recognize('data:image/jpeg;base64,fake')

    expect(result.tiles.length).toBeGreaterThan(0)
    expect(result.processingMs).toBeGreaterThan(0)
    expect(result.imageDataUrl).toBe('data:image/jpeg;base64,fake')

    for (const tile of result.tiles) {
      expect(isValidTileId(tile.tileId)).toBe(true)
      expect(tile.confidence).toBeGreaterThanOrEqual(0)
      expect(tile.confidence).toBeLessThanOrEqual(1)
      expect(tile.bbox).toHaveLength(4)
    }
  })
})

// ── recognizeTiles — model available (REAL_MODEL) ────────

describe('recognizeTiles (REAL_MODEL: model available)', () => {
  const NUM_CLASSES = 34
  const NUM_ROWS = 4 + NUM_CLASSES
  const NUM_DET = 2

  function buildYolov8Tensor() {
    const raw = new Float32Array(NUM_ROWS * NUM_DET)
    // Detection 0: 1m at (100, 200)
    raw[0 * NUM_DET + 0] = 100 // xc
    raw[1 * NUM_DET + 0] = 200 // yc
    raw[2 * NUM_DET + 0] = 40  // w
    raw[3 * NUM_DET + 0] = 60  // h
    raw[(4 + 0) * NUM_DET + 0] = 0.9 // class 0 score

    // Detection 1: 1p at (250, 200)
    raw[0 * NUM_DET + 1] = 250
    raw[1 * NUM_DET + 1] = 200
    raw[2 * NUM_DET + 1] = 40
    raw[3 * NUM_DET + 1] = 60
    raw[(4 + 9) * NUM_DET + 1] = 0.85

    return {
      shape: [1, NUM_ROWS, NUM_DET],
      data: () => Promise.resolve(raw),
      dispose: vi.fn(),
    }
  }

  beforeEach(() => {
    vi.resetModules()

    const fakeTensor = buildYolov8Tensor()
    const fakeModel = {
      predict: vi.fn().mockReturnValue(fakeTensor),
      dispose: vi.fn(),
    }

    vi.mocked(tf.loadGraphModel).mockResolvedValue(fakeModel as any)

    const fakeInputTensor = {
      dispose: vi.fn(),
    }
    vi.mocked(preprocessImage).mockResolvedValue(fakeInputTensor as any)
  })

  it('使用真實模型推論回傳正確牌', async () => {
    const { recognizeTiles: recognize } = await import('../camera/recognitionService')
    const result = await recognize('data:image/jpeg;base64,test')

    expect(result.tiles).toHaveLength(2)
    expect(result.tiles[0].tileId).toBe('1m')
    expect(result.tiles[1].tileId).toBe('1p')
    expect(result.processingMs).toBeGreaterThan(0)
  })
})
