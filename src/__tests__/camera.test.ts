import { describe, it, expect } from 'vitest'
import { isValidTileId, VALID_TILE_IDS } from '../camera/types'
import { recognizeTiles } from '../camera/recognitionService'

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

describe('recognizeTiles (mock)', () => {
  it('回傳結構正確', async () => {
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
