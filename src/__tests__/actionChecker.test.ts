import { describe, it, expect } from 'vitest'
import {
  canPong,
  canKong,
  canConcealedKong,
  canAddKong,
  canChow,
  getChowOptions,
  executePong,
  executeKong,
  executeConcealedKong,
  executeChow,
} from '../actionChecker'
import { Player, Meld } from '../gameState'

// ═══════════════════════════════════════
// canPong
// ═══════════════════════════════════════

describe('canPong', () => {
  it('手中有 2 張相同的牌 → true', () => {
    expect(canPong(['1m','1m','2m'], '1m')).toBe(true)
  })

  it('手中有 3 張相同的牌 → true（3 ≥ 2）', () => {
    expect(canPong(['1m','1m','1m','2m'], '1m')).toBe(true)
  })

  it('手中只有 1 張 → false', () => {
    expect(canPong(['1m','2m','3m'], '1m')).toBe(false)
  })

  it('手中沒有目標牌 → false', () => {
    expect(canPong(['2m','3m','4m'], '1m')).toBe(false)
  })

  it('碰字牌（東風）', () => {
    expect(canPong(['E','E','1m'], 'E')).toBe(true)
  })
})

// ═══════════════════════════════════════
// canKong（明槓）
// ═══════════════════════════════════════

describe('canKong', () => {
  it('手中有 3 張相同的牌 → true', () => {
    expect(canKong(['1m','1m','1m','2m'], '1m')).toBe(true)
  })

  it('手中只有 2 張 → false', () => {
    expect(canKong(['1m','1m','2m'], '1m')).toBe(false)
  })

  it('手中有 4 張 → true（4 ≥ 3）', () => {
    expect(canKong(['1m','1m','1m','1m'], '1m')).toBe(true)
  })

  it('手中沒有目標牌 → false', () => {
    expect(canKong(['2m','3m','4m'], '1m')).toBe(false)
  })
})

// ═══════════════════════════════════════
// canConcealedKong（暗槓）
// ═══════════════════════════════════════

describe('canConcealedKong', () => {
  it('手中有 4 張相同 → 返回含該牌的陣列', () => {
    const result = canConcealedKong(['1m','1m','1m','1m','2m'])
    expect(result).toContain('1m')
    expect(result.length).toBe(1)
  })

  it('手中有兩種各 4 張 → 返回兩種牌', () => {
    const result = canConcealedKong(['1m','1m','1m','1m','2s','2s','2s','2s'])
    expect(result).toContain('1m')
    expect(result).toContain('2s')
    expect(result.length).toBe(2)
  })

  it('手中沒有 4 張相同 → 空陣列', () => {
    const result = canConcealedKong(['1m','1m','1m','2m'])
    expect(result).toEqual([])
  })

  it('空手牌 → 空陣列', () => {
    expect(canConcealedKong([])).toEqual([])
  })
})

// ═══════════════════════════════════════
// canAddKong（加槓）
// ═══════════════════════════════════════

describe('canAddKong', () => {
  it('已碰的牌又在手中 → 返回含該牌的陣列', () => {
    const melds: Meld[] = [
      { type: 'pong', tiles: ['1m','1m','1m'], isConcealed: false },
    ]
    const result = canAddKong(['1m','2m','3m'], melds)
    expect(result).toContain('1m')
  })

  it('已碰的牌不在手中 → 空陣列', () => {
    const melds: Meld[] = [
      { type: 'pong', tiles: ['1m','1m','1m'], isConcealed: false },
    ]
    const result = canAddKong(['2m','3m','4m'], melds)
    expect(result).toEqual([])
  })

  it('沒有碰過任何牌 → 空陣列', () => {
    const result = canAddKong(['1m','1m','1m','1m'], [])
    expect(result).toEqual([])
  })

  it('已槓的牌不算（只有 pong 才能加槓）', () => {
    const melds: Meld[] = [
      { type: 'kong', tiles: ['1m','1m','1m','1m'], isConcealed: false },
    ]
    const result = canAddKong(['1m'], melds)
    expect(result).toEqual([])
  })
})

// ═══════════════════════════════════════
// canChow
// ═══════════════════════════════════════

describe('canChow', () => {
  it('只有下家才能吃（功能上 canChow 只檢查手牌，呼叫方負責限制）', () => {
    // canChow 本身不判斷是否下家，gameController 才做此判斷
    const result = canChow(['2m','3m'], '1m')
    expect(result).toEqual([['1m','2m','3m']])
  })

  it('吃法 1：tile-2, tile-1, tile（尾端吃）', () => {
    const result = canChow(['1m','2m'], '3m')
    expect(result).toContainEqual(['1m','2m','3m'])
  })

  it('吃法 2：tile-1, tile, tile+1（中間吃）', () => {
    const result = canChow(['4m','6m'], '5m')
    expect(result).toContainEqual(['4m','5m','6m'])
  })

  it('吃法 3：tile, tile+1, tile+2（首端吃）', () => {
    const result = canChow(['2m','3m'], '1m')
    expect(result).toContainEqual(['1m','2m','3m'])
  })

  it('多種吃法同時存在', () => {
    // 手中有 3m 和 5m，可吃 4m（3-4-5）；也有 5m 和 6m，可吃 4m（4-5-6）
    const result = canChow(['3m','5m','6m'], '4m')
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('字牌不能吃', () => {
    expect(canChow(['E','E'], 'E')).toEqual([])
    expect(canChow(['Z','Z'], 'Z')).toEqual([])
  })

  it('邊張不能吃超出範圍', () => {
    // 1m 不能 吃 0m-1m-2m（0m 不存在）
    const result = canChow(['2m'], '1m')
    // 只有 1-2-3 才可能
    expect(result.every(combo => combo.every(t => parseInt(t) >= 1 && parseInt(t) <= 9))).toBe(true)
  })

  it('不同花色不能吃', () => {
    // 手中有 2m、3s，不能吃 1m（因為 3s 是索子）
    const result = canChow(['2m','3s'], '1m')
    // 1m 的三種吃法都只能在萬子
    expect(result.every(combo => combo.every(t => t.endsWith('m')))).toBe(true)
  })
})

// ═══════════════════════════════════════
// getChowOptions
// ═══════════════════════════════════════

describe('getChowOptions', () => {
  it('返回 ChowOption 格式', () => {
    const options = getChowOptions(['2m','3m'], '1m')
    expect(options.length).toBe(1)
    expect(options[0].tiles).toEqual(['1m','2m','3m'])
    expect(options[0].with).toBe('1m')
  })

  it('無法吃時返回空陣列', () => {
    expect(getChowOptions(['1s','2s'], '1m')).toEqual([])
  })
})

// ═══════════════════════════════════════
// executePong
// ═══════════════════════════════════════

describe('executePong', () => {
  function makePlayer(hand: string[]): Player {
    return { name: 'test', hand: [...hand], melds: [], discardPile: [], score: 0, isHuman: false, canAction: false }
  }

  it('碰牌：從手牌移除 2 張，加入 melds', () => {
    const p = makePlayer(['1m','1m','2m','3m'])
    const ok = executePong(p, '1m')
    expect(ok).toBe(true)
    expect(p.hand.filter(t => t === '1m').length).toBe(0)
    expect(p.hand).toContain('2m')
    expect(p.melds).toHaveLength(1)
    expect(p.melds[0].type).toBe('pong')
    expect(p.melds[0].tiles).toEqual(['1m','1m','1m'])
  })

  it('手牌不足 → false', () => {
    const p = makePlayer(['1m','2m','3m'])
    expect(executePong(p, '1m')).toBe(false)
    expect(p.melds).toHaveLength(0)
  })
})

// ═══════════════════════════════════════
// executeKong（明槓）
// ═══════════════════════════════════════

describe('executeKong', () => {
  function makePlayer(hand: string[]): Player {
    return { name: 'test', hand: [...hand], melds: [], discardPile: [], score: 0, isHuman: false, canAction: false }
  }

  it('明槓：從手牌移除 3 張，加入 melds（4 張 kong）', () => {
    const p = makePlayer(['1m','1m','1m','2m'])
    const ok = executeKong(p, '1m')
    expect(ok).toBe(true)
    expect(p.hand.filter(t => t === '1m').length).toBe(0)
    expect(p.melds[0].type).toBe('kong')
    expect(p.melds[0].tiles.length).toBe(4)
    expect(p.melds[0].isConcealed).toBe(false)
  })

  it('手牌不足（只有 2 張）→ false', () => {
    const p = makePlayer(['1m','1m','2m'])
    expect(executeKong(p, '1m')).toBe(false)
  })
})

// ═══════════════════════════════════════
// executeConcealedKong（暗槓）
// ═══════════════════════════════════════

describe('executeConcealedKong', () => {
  function makePlayer(hand: string[]): Player {
    return { name: 'test', hand: [...hand], melds: [], discardPile: [], score: 0, isHuman: false, canAction: false }
  }

  it('暗槓：從手牌移除 4 張，加入暗槓 meld', () => {
    const p = makePlayer(['1m','1m','1m','1m','2m'])
    const ok = executeConcealedKong(p, '1m')
    expect(ok).toBe(true)
    expect(p.hand.filter(t => t === '1m').length).toBe(0)
    expect(p.melds[0].type).toBe('kong')
    expect(p.melds[0].isConcealed).toBe(true)
    expect(p.melds[0].tiles.length).toBe(4)
  })

  it('手牌不足 4 張 → false', () => {
    const p = makePlayer(['1m','1m','1m','2m'])
    expect(executeConcealedKong(p, '1m')).toBe(false)
  })
})

// ═══════════════════════════════════════
// executeChow
// ═══════════════════════════════════════

describe('executeChow', () => {
  function makePlayer(hand: string[]): Player {
    return { name: 'test', hand: [...hand], melds: [], discardPile: [], score: 0, isHuman: false, canAction: false }
  }

  it('吃牌：從手牌移除另外 2 張，加入 chow meld', () => {
    const p = makePlayer(['2m','3m','5m'])
    const ok = executeChow(p, ['1m','2m','3m'], '1m')
    expect(ok).toBe(true)
    expect(p.hand).not.toContain('2m')
    expect(p.hand).not.toContain('3m')
    expect(p.hand).toContain('5m')
    expect(p.melds[0].type).toBe('chow')
    expect(p.melds[0].tiles).toEqual(['1m','2m','3m'])
  })

  it('吃牌：手牌中找不到 → false', () => {
    const p = makePlayer(['4m','5m'])
    const ok = executeChow(p, ['1m','2m','3m'], '1m')
    expect(ok).toBe(false)
  })

  it('tiles 長度不是 3 → false', () => {
    const p = makePlayer(['1m','2m'])
    expect(executeChow(p, ['1m','2m'], '1m')).toBe(false)
  })
})

// ═══════════════════════════════════════
// 上家槓牌規則驗證
// ═══════════════════════════════════════

describe('上家捨牌不能大明槓（gameController 層面的規則）', () => {
  // 這個規則由 gameController.getAvailableActions 的 isNextPlayer 控制
  // 這裡只確認 canKong 本身是純手牌檢查，不包含方向限制
  it('canKong 本身不判斷方向（方向由 gameController 限制）', () => {
    // 方向限制：isNextPlayer=true 時 gameController 不加 kong 動作
    // canKong 只檢查手牌
    expect(canKong(['E','E','E'], 'E')).toBe(true) // 手牌有 3 張
  })
})
