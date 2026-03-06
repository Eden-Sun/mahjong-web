import { describe, it, expect } from 'vitest'
import { isValidTileId, VALID_TILE_IDS } from '../camera/types'
import { recognizeTiles } from '../camera/recognitionService'
import { classIndexToTileId, CONFIDENCE_THRESHOLD } from '../camera/postprocessing'

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

describe('recognizeTiles (fallback to mock)', () => {
  it('回傳結構正確', async () => {
    // 沒有模型檔案，會 fallback 到 mock
    const result = await recognizeTiles('data:image/jpeg;base64,fake')

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
