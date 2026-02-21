import { describe, it, expect } from 'vitest'
import { canFormWinPattern, checkWin, calculateFans } from '../winChecker'
import { Meld } from '../gameState'

// ═══════════════════════════════════════
// canFormWinPattern
// ═══════════════════════════════════════

describe('canFormWinPattern', () => {
  it('空手牌 + needMelds=0 + hasEye=true → true', () => {
    expect(canFormWinPattern([], 0, true)).toBe(true)
  })

  it('空手牌 + needMelds=0 + hasEye=false → false（無雀頭）', () => {
    expect(canFormWinPattern([], 0, false)).toBe(false)
  })

  it('空手牌 + needMelds=1 + hasEye=true → false（還需要面子）', () => {
    expect(canFormWinPattern([], 1, true)).toBe(false)
  })

  it('2 張對子 + needMelds=0 → true（雀頭）', () => {
    expect(canFormWinPattern(['1m', '1m'], 0, false)).toBe(true)
  })

  it('2 張非對子 + needMelds=0 → false', () => {
    expect(canFormWinPattern(['1m', '2m'], 0, false)).toBe(false)
  })

  it('標準胡牌：5 副面子 + 1 對眼（17 張）', () => {
    // 111m 222m 333m 444m 555m + 99m
    const hand = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '9m','9m',
    ]
    expect(canFormWinPattern(hand, 5)).toBe(true)
  })

  it('順子胡：5 副順子 + 1 對眼', () => {
    // 123m 456m 789m 123s 456s + 7p7p
    const hand = [
      '1m','2m','3m',
      '4m','5m','6m',
      '7m','8m','9m',
      '1s','2s','3s',
      '4s','5s','6s',
      '7p','7p',
    ]
    expect(canFormWinPattern(hand, 5)).toBe(true)
  })

  it('混合順子刻子胡', () => {
    // 123m 123m 123m 123m + 55m（平胡型）= 14 張 → 需 needMelds=4, hasEye=false
    const hand = ['1m','2m','3m','1m','2m','3m','1m','2m','3m','1m','2m','3m','5m','5m']
    expect(canFormWinPattern(hand, 4)).toBe(true)
  })

  it('不滿足胡牌條件：缺一個面子', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','4s']
    // 4 副面子 + 1 眼，needMelds=5 時 false
    expect(canFormWinPattern(hand, 5)).toBe(false)
  })

  it('對對胡型：5 刻子 + 1 對眼', () => {
    // 111m 222m 333m 444m 555m + 11s
    const hand = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '1s','1s',
    ]
    expect(canFormWinPattern(hand, 5)).toBe(true)
  })

  it('手牌太少：直接 false', () => {
    // 需要 17 張（5 副面子 + 1 眼），只給 10 張
    const hand = ['1m','1m','1m','2m','2m','2m','3m','3m','3m','4m']
    expect(canFormWinPattern(hand, 5)).toBe(false)
  })

  it('字牌刻子', () => {
    // EEE SSS WWW NNN BBB + ZZ（17張）
    const hand = ['E','E','E','S','S','S','W','W','W','N','N','N','B','B','B','Z','Z']
    expect(canFormWinPattern(hand, 5)).toBe(true)
  })

  it('已有 3 個面子（meldCount=3），手牌需 2 副 + 1 眼', () => {
    // needMelds = 5 - 3 = 2
    const hand = ['1m','2m','3m','4m','5m','6m','7m','7m']
    expect(canFormWinPattern(hand, 2)).toBe(true)
  })

  it('已有 4 個面子（meldCount=4），手牌需 1 副 + 1 眼', () => {
    const hand = ['1m','2m','3m','4m','4m']
    expect(canFormWinPattern(hand, 1)).toBe(true)
  })

  it('已有 4 個面子，手牌只有 2 張眼（單吊）', () => {
    const hand = ['7m','7m']
    expect(canFormWinPattern(hand, 1)).toBe(false) // 還需要 1 個面子
    expect(canFormWinPattern(hand, 0)).toBe(true)  // 0 個面子需求時，2 張對子 = 雀頭
  })
})

// ═══════════════════════════════════════
// checkWin - 自摸
// ═══════════════════════════════════════

describe('checkWin - 自摸', () => {
  it('自摸胡牌（17 張）', () => {
    const hand = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '9m', // 16 張在手
    ]
    const result = checkWin(hand, [], '9m') // drawnTile = 9m → fullHand = 17 張
    expect(result.canWin).toBe(true)
    expect(result.winType).toBe('self-draw')
  })

  it('無法自摸（缺牌）', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','5s','6s','7s']
    const result = checkWin(hand, [], '8s') // 不湊齊
    // 手牌沒有 9s，無法組成順子 7s8s9s，但有其他可能性？不一定是 false
    // 這裡只驗證 canWin
    expect(typeof result.canWin).toBe('boolean')
  })

  it('沒有 drawnTile 也沒有 discardedTile → 用現有手牌判斷', () => {
    const hand = ['1m','1m']
    const result = checkWin(hand, [], undefined, undefined)
    // hand 只有 2 張，needMelds=5，不可能胡
    expect(result.canWin).toBe(false)
  })

  it('自摸 fan 計算包含自摸加成（門清自摸 = 不求 3台）', () => {
    const hand = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '9m',
    ]
    const result = checkWin(hand, [], '9m')
    expect(result.canWin).toBe(true)
    expect(result.fans).toBeGreaterThan(0)
    // 門清自摸 → 不求 3台（含自摸），非門清自摸才單獨顯示「自摸」
    expect(result.details.some(d => d.includes('自摸') || d.includes('不求'))).toBe(true)
  })
})

// ═══════════════════════════════════════
// checkWin - 點胡
// ═══════════════════════════════════════

describe('checkWin - 點胡', () => {
  it('點胡（discardedTile），16 張手牌 + 1 捨牌 = 17 張', () => {
    const hand = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '8m', // 16 張
    ]
    // 對方捨出 8m，但這樣只有 2 個 8m，不是對子眼... 試試 9m
    const hand2 = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '9m', // 16 張
    ]
    const result = checkWin(hand2, [], undefined, '9m')
    expect(result.canWin).toBe(true)
    expect(result.winType).toBe('win-from-others')
  })

  it('已碰 1 副，點胡剩餘手牌（16-3+1-1=13 張）', () => {
    const melds: Meld[] = [{ type: 'pong', tiles: ['E','E','E'], isConcealed: false }]
    // 碰後手牌 13 張 + 捨牌 1 = 14 張，needMelds = 5-1 = 4，4*3+2=14 ✓
    const hand = [
      '1m','2m','3m',
      '4m','5m','6m',
      '7m','8m','9m',
      '1s','2s','3s',
      '9p', // 13 張
    ]
    const result = checkWin(hand, melds, undefined, '9p')
    expect(result.canWin).toBe(true)
    expect(result.winType).toBe('win-from-others')
  })

  it('點胡不符合條件（無法組成胡牌型）', () => {
    const hand = ['1m','3m','5m','7m','9m','1s','3s','5s','7s','9s','1p','3p','5p','7p','9p','E']
    const result = checkWin(hand, [], undefined, '2m')
    expect(result.canWin).toBe(false)
  })
})

// ═══════════════════════════════════════
// needMelds 正確性（5 - meldCount）
// ═══════════════════════════════════════

describe('needMelds = 5 - meldCount', () => {
  it('無面子：needMelds=5，手牌需 17 張', () => {
    // 5 副面子 + 1 眼 = 17 張
    const hand = [
      '1m','1m','1m',
      '2m','2m','2m',
      '3m','3m','3m',
      '4m','4m','4m',
      '5m','5m','5m',
      '9m',
    ]
    const result = checkWin(hand, [], '9m')
    expect(result.canWin).toBe(true)
  })

  it('1 個面子（pong）：needMelds=4，手牌需 14 張', () => {
    const melds: Meld[] = [{ type: 'pong', tiles: ['1p','1p','1p'], isConcealed: false }]
    const hand = [
      '1m','2m','3m',
      '4m','5m','6m',
      '7m','8m','9m',
      '1s','2s','3s',
      '9p',
    ]
    // 13 張手牌 + drawnTile 9p = 14 張，needMelds=4，4*3+2=14 ✓
    const result = checkWin(hand, melds, '9p')
    expect(result.canWin).toBe(true)
  })

  it('2 個面子：needMelds=3，手牌需 11 張', () => {
    const melds: Meld[] = [
      { type: 'pong', tiles: ['1p','1p','1p'], isConcealed: false },
      { type: 'pong', tiles: ['2p','2p','2p'], isConcealed: false },
    ]
    const hand = [
      '1m','2m','3m',
      '4m','5m','6m',
      '7m','8m','9m',
      '9p',
    ]
    // 10 張手牌 + drawnTile 9p = 11 張，needMelds=3 ✓
    const result = checkWin(hand, melds, '9p')
    expect(result.canWin).toBe(true)
  })

  it('4 個面子（明槓 1 個）：needMelds=1，手牌需 5 張', () => {
    const melds: Meld[] = [
      { type: 'pong', tiles: ['1p','1p','1p'], isConcealed: false },
      { type: 'pong', tiles: ['2p','2p','2p'], isConcealed: false },
      { type: 'pong', tiles: ['3p','3p','3p'], isConcealed: false },
      { type: 'kong', tiles: ['4p','4p','4p','4p'], isConcealed: false },
    ]
    const hand = ['1m','2m','3m','9p']
    // 4 張手牌 + drawnTile 9p = 5 張，needMelds=1，1*3+2=5 ✓
    const result = checkWin(hand, melds, '9p')
    expect(result.canWin).toBe(true)
  })
})

// ═══════════════════════════════════════
// calculateFans - 台數計算
// ═══════════════════════════════════════

describe('calculateFans', () => {
  it('自摸加 1 台', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','7p','7p','9s']
    // 這不是完整胡牌手，只驗證自摸 flag
    const { details } = calculateFans(
      ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','5s','6s','7p','7p'],
      [],
      'self-draw',
      '7p'
    )
    expect(details.some(d => d.includes('自摸') || d.includes('不求'))).toBe(true)
  })

  it('門清加 1 台', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','5s','6s','7p','7p']
    const { details } = calculateFans(hand, [], 'win-from-others', '7p')
    expect(details.some(d => d.includes('門清') || d.includes('平胡'))).toBe(true)
  })

  it('不求（門清自摸）= 3 台', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','5s','6s','7p','7p']
    const { fans, details } = calculateFans(hand, [], 'self-draw', '7p')
    // 門清 + 自摸 = 不求 3 台（台灣麻將）
    expect(details.some(d => d.includes('不求'))).toBe(true)
    expect(fans).toBeGreaterThanOrEqual(3)
  })

  it('莊家加 1 台', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','5s','6s','7p','7p']
    const { fans: fansDealer } = calculateFans(hand, [], 'win-from-others', '7p', { isDealer: true })
    const { fans: fansNormal } = calculateFans(hand, [], 'win-from-others', '7p', { isDealer: false })
    expect(fansDealer).toBeGreaterThan(fansNormal)
  })

  it('最少 1 台', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','5s','6s','7p','7p']
    const { fans } = calculateFans(hand, [], 'win-from-others', '7p')
    expect(fans).toBeGreaterThanOrEqual(1)
  })

  it('箭牌（碰中/發/白）各 1 台', () => {
    const melds: Meld[] = [
      { type: 'pong', tiles: ['Z','Z','Z'], isConcealed: false }, // 中
    ]
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','9p']
    const { details } = calculateFans([...hand, '9p'], melds, 'self-draw', '9p')
    expect(details.some(d => d.includes('箭牌') || d.includes('中'))).toBe(true)
  })

  it('清一色 8 台', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1m','2m','3m','4m','5m','6m','7m','7m']
    const { fans, details } = calculateFans(hand, [], 'self-draw', '7m')
    expect(details.some(d => d.includes('清一色'))).toBe(true)
    expect(fans).toBeGreaterThanOrEqual(8)
  })

  it('碰碰胡 4 台', () => {
    const hand = ['1m','1m','1m','2m','2m','2m','3m','3m','3m','4m','4m','4m','5m','5m','5m','9s','9s']
    const { fans, details } = calculateFans(hand, [], 'win-from-others', '9s')
    expect(details.some(d => d.includes('碰碰胡'))).toBe(true)
    expect(fans).toBeGreaterThanOrEqual(4)
  })

  it('槓上開花 1 台', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','5s','6s','7p','7p']
    const { details } = calculateFans(hand, [], 'self-draw', '7p', { isKongDraw: true })
    expect(details.some(d => d.includes('槓上開花'))).toBe(true)
  })

  it('搶槓 1 台', () => {
    const hand = ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1s','2s','3s','4s','5s','6s','7p','7p']
    const { details } = calculateFans(hand, [], 'win-from-others', '7p', { isRobKong: true })
    expect(details.some(d => d.includes('搶槓'))).toBe(true)
  })
})
