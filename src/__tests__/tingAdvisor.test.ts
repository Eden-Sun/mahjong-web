import { describe, it, expect } from 'vitest'
import { getCurrentWaits, getDiscardToWaits } from '../camera/tingAdvisor'
import type { TileId } from '../camera/types'

describe('getCurrentWaits', () => {
  it('清一色聽牌：1-8m + 刻子 → 聽 9m', () => {
    // 123m 456m 78m + 111s + EE → 16 張，聽 9m 和 6m
    const hand: TileId[] = [
      '1m','2m','3m','4m','5m','6m','7m','8m',
      '1s','1s','1s',
      'E','E','E',
      'N','N',
    ]
    const waits = getCurrentWaits(hand)
    expect(waits).toContain('9m')
    expect(waits).toContain('6m')
  })

  it('單吊聽牌：5 面子完成，缺眼', () => {
    // 111m 222m 333m 444m 555m + 9m → 16 張，聽 9m 配對
    const hand: TileId[] = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '9m',
    ]
    const waits = getCurrentWaits(hand)
    expect(waits).toEqual(['9m'])
  })

  it('雙面聽：12m → 聽 3m', () => {
    const hand: TileId[] = [
      '1m','2m',
      '4m','5m','6m',
      '7m','8m','9m',
      '1s','2s','3s',
      '4s','5s','6s',
      'E','E',
    ]
    const waits = getCurrentWaits(hand)
    expect(waits).toContain('3m')
  })

  it('非聽牌手：回傳空陣列', () => {
    const hand: TileId[] = [
      '1m','3m','5m','7m','9m',
      '1s','3s','5s','7s','9s',
      '1p','3p','5p','7p',
      'E','S',
    ]
    const waits = getCurrentWaits(hand)
    expect(waits).toEqual([])
  })

  it('手牌已有 4 張相同牌時，該牌不在聽牌中', () => {
    // 4 張 1m + 其他組成聽牌型，聽牌不含 1m
    const hand: TileId[] = [
      '1m','1m','1m','1m',
      '2m','3m','4m',
      '5m','6m','7m',
      '8m','8m','8m',
      '1s','2s','3s',
    ]
    // 17 tiles → mod 2, not mod 1. Let me fix to 16 tiles
    const hand16: TileId[] = [
      '1m','1m','1m','1m',
      '2m','3m','4m',
      '5m','6m','7m',
      '1s','1s','1s',
      'E','E','E',
    ]
    // 聽牌：需要眼 + 1 面子
    // 手牌結構：1m1m1m + 1m234m + 567m + 111s + EEE → 但只有 16 張
    // 實際：(1m,1m,1m) 刻 + (1m) + (2m,3m,4m) 順 + (5m,6m,7m) 順 + (1s,1s,1s) 刻 + (E,E,E) 刻
    // 那是 3+1+3+3+3+3 = 16，缺眼 → 聽任何能配眼的牌，但不能聽 1m（已 4 張）
    const waits = getCurrentWaits(hand16)
    expect(waits).not.toContain('1m')
  })

  it('不合法牌數（非 mod 3 === 1）回傳空陣列', () => {
    const hand: TileId[] = ['1m','2m','3m']
    const waits = getCurrentWaits(hand)
    expect(waits).toEqual([])
  })

  it('13 張手牌（有碰過牌）也能分析', () => {
    // 13 張 = mod 1, needMelds = 4
    const hand: TileId[] = [
      '1m','2m','3m',
      '4m','5m','6m',
      '7m','8m','9m',
      '1s','2s','3s',
      'E',
    ]
    const waits = getCurrentWaits(hand)
    expect(waits).toContain('E')
  })
})

describe('getDiscardToWaits', () => {
  it('17 張手牌：列出每張打出後的聽牌', () => {
    // 111m 222m 333m 444m 555m + 9m 9m → 17 張（已胡）
    // 打任意非 9m 都會破壞面子
    const hand: TileId[] = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '9m','9m',
    ]
    const result = getDiscardToWaits(hand)
    // 打 9m → 剩 16 張，單吊 9m
    expect(result['9m']).toContain('9m')
  })

  it('不重複計算相同牌', () => {
    const hand: TileId[] = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '9m','9m',
    ]
    const result = getDiscardToWaits(hand)
    // result 的 key 應該是唯一的牌（不重複）
    const keys = Object.keys(result)
    expect(keys.length).toBe(new Set(keys).size)
  })

  it('回傳只包含有聽牌的條目', () => {
    const hand: TileId[] = [
      '1m','2m','3m',
      '4m','5m','6m',
      '7m','8m','9m',
      '1s','2s','3s',
      '4s','5s','6s',
      'E','E',
    ]
    const result = getDiscardToWaits(hand)
    for (const waits of Object.values(result)) {
      expect(waits!.length).toBeGreaterThan(0)
    }
  })

  it('無法聽牌時回傳空物件', () => {
    const hand: TileId[] = [
      '1m','3m','5m','7m','9m',
      '1s','3s','5s','7s','9s',
      '1p','3p','5p','7p',
      'E','S','W',
    ]
    const result = getDiscardToWaits(hand)
    expect(Object.keys(result).length).toBe(0)
  })

  it('排除打出後手牌不合法的情況', () => {
    // 14 張 (mod 2)：有碰過 1 副的情況
    const hand: TileId[] = [
      '1m','2m','3m',
      '4m','5m','6m',
      '7m','8m','9m',
      '1s','2s','3s',
      'E','E',
    ]
    const result = getDiscardToWaits(hand)
    // 打 E → 13 張，123m 456m 789m 123s + 缺眼 → 聽 E
    expect(result['E']).toBeDefined()
    if (result['E']) {
      expect(result['E']).toContain('E')
    }
  })
})
