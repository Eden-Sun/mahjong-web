// 胡牌检查算法 + 台灣麻將完整台數計算

import { Meld } from './gameState'

// ═══════════════════════════════════════
// Types
// ═══════════════════════════════════════

export interface WinResult {
  canWin: boolean
  winType: 'self-draw' | 'win-from-others' | null
  fans: number
  pattern: string
  details: string[]
}

export interface WinContext {
  isDealer?: boolean       // 莊家
  seatWind?: string        // 座位風 E/S/W/N
  roundWind?: string       // 圈風 E/S/W/N
  isLastTile?: boolean     // 最後一張牌
  isKongDraw?: boolean     // 槓上補牌
  isRobKong?: boolean      // 搶槓
}

// 獨聽子類型
// 緊聽：1-2 聽 3（低端邊張）
// 騎壁：8-9 聽 7（高端邊張）
// 中洞：x-(x+2) 聽 x+1（嵌張）
// 單吊：缺眼單張等配對
type WaitType = 'two-sided' | 'jin-ting' | 'qi-bi' | 'zhong-dong' | 'dan-diao' | 'full-claim'

const SUIT_TILES = ['m', 's', 'p']
const HONOR_TILES = ['E', 'S', 'W', 'N', 'B', 'F', 'Z']
const DRAGON_TILES = ['B', 'F', 'Z']  // 白/發/中
const WIND_TILES = ['E', 'S', 'W', 'N']

// ═══════════════════════════════════════
// 主入口：checkWin
// ═══════════════════════════════════════

export function checkWin(
  hand: string[],
  melds: Meld[],
  drawnTile?: string,
  discardedTile?: string,
  context?: WinContext
): WinResult {
  let winType: 'self-draw' | 'win-from-others' | null = null
  let fullHand: string[] = []
  let winTile = ''

  if (drawnTile) {
    winType = 'self-draw'
    fullHand = [...hand, drawnTile]
    winTile = drawnTile
  } else if (discardedTile) {
    winType = 'win-from-others'
    fullHand = [...hand, discardedTile]
    winTile = discardedTile
  } else {
    fullHand = [...hand]
  }

  const meldCount = melds.length
  const needMelds = 5 - meldCount

  const canWin = canFormWinPattern(fullHand, needMelds)

  if (!canWin) {
    return { canWin: false, winType: null, fans: 0, pattern: '', details: [] }
  }

  const { fans, pattern, details } = calculateFans(fullHand, melds, winType, winTile, context)

  return { canWin: true, winType, fans, pattern, details }
}

// ═══════════════════════════════════════
// 胡牌結構判斷（遞迴）
// ═══════════════════════════════════════

export function canFormWinPattern(
  hand: string[],
  needMelds: number,
  hasEye: boolean = false
): boolean {
  if (hand.length === 0) return needMelds === 0 && hasEye
  if (hand.length === 2 && needMelds === 0 && !hasEye) return hand[0] === hand[1]
  if (hand.length < needMelds * 3 + (hasEye ? 0 : 2)) return false

  const sorted = [...hand].sort()
  const first = sorted[0]
  const firstCount = sorted.filter(t => t === first).length

  // 眼牌
  if (!hasEye && firstCount >= 2) {
    const newHand = [...sorted]
    newHand.splice(0, 2)
    if (canFormWinPattern(newHand, needMelds, true)) return true
  }

  // 刻子
  if (needMelds > 0 && firstCount >= 3) {
    const newHand = [...sorted]
    newHand.splice(0, 3)
    if (canFormWinPattern(newHand, needMelds - 1, hasEye)) return true
  }

  // 順子
  if (needMelds > 0 && first.match(/^[1-9][msp]$/)) {
    const suit = first[1]
    const num = parseInt(first[0])
    if (num <= 7) {
      const t2 = `${num + 1}${suit}`
      const t3 = `${num + 2}${suit}`
      const i2 = sorted.indexOf(t2)
      const i3 = sorted.indexOf(t3)
      if (i2 !== -1 && i3 !== -1) {
        const newHand = [...sorted]
        newHand.splice(i3, 1)
        newHand.splice(i2, 1)
        newHand.splice(0, 1)
        if (canFormWinPattern(newHand, needMelds - 1, hasEye)) return true
      }
    }
  }

  return false
}

// ═══════════════════════════════════════
// 聽牌類型判斷
// ═══════════════════════════════════════

/**
 * 判斷聽牌類型
 * @param preWinHand 胡牌前的手牌（不含 winTile）
 * @param melds 已有的面子
 * @param winTile 胡的那張牌
 *
 * 核心邏輯：窮舉所有 34 種牌，看有幾種能完成胡牌。
 * 只有 1 種 = 獨聽（邊/嵌/單騎）；超過 1 種 = 雙面。
 */
function detectWaitType(
  preWinHand: string[],
  melds: Meld[],
  winTile: string
): WaitType {
  const needMelds = 5 - melds.length

  // 全求：手牌只剩 1 張 且 melds 已滿 4 組
  if (preWinHand.length === 1 && melds.length >= 4) return 'full-claim'

  // 窮舉所有可能的胡牌
  const ALL_TILES = [
    ...Array.from({ length: 9 }, (_, i) => `${i + 1}m`),
    ...Array.from({ length: 9 }, (_, i) => `${i + 1}s`),
    ...Array.from({ length: 9 }, (_, i) => `${i + 1}p`),
    'E', 'S', 'W', 'N', 'B', 'F', 'Z',
  ]
  const winningTiles = ALL_TILES.filter(t =>
    canFormWinPattern([...preWinHand, t], needMelds)
  )

  // 超過 1 種牌可胡 → 雙面（不算獨聽）
  if (winningTiles.length > 1) return 'two-sided'

  // ── 只有 1 種可胡 → 獨聽，判斷子類型 ──

  // 單吊：手牌剩 1 張等配對（眼）
  if (preWinHand.length === 1) return 'dan-diao'

  if (winTile.match(/^[1-9][msp]$/)) {
    const suit = winTile[1]
    const num = parseInt(winTile[0])

    // 中洞（嵌張）：x-(x+2) 聽 x+1
    if (preWinHand.includes(`${num - 1}${suit}`) &&
        preWinHand.includes(`${num + 1}${suit}`)) return 'zhong-dong'

    // 緊聽：低端邊張，1-2 聽 3
    if (num === 3 && preWinHand.includes(`1${suit}`) && preWinHand.includes(`2${suit}`)) return 'jin-ting'

    // 騎壁：高端邊張，8-9 聽 7
    if (num === 7 && preWinHand.includes(`8${suit}`) && preWinHand.includes(`9${suit}`)) return 'qi-bi'
  }

  // 字牌或複合等待 → 單吊
  return 'dan-diao'
}

// ═══════════════════════════════════════
// 台數計算（核心）
// ═══════════════════════════════════════

export function calculateFans(
  hand: string[],
  melds: Meld[],
  winType: 'self-draw' | 'win-from-others' | null,
  winTile: string = '',
  context: WinContext = {}
): { fans: number; pattern: string; details: string[] } {
  const details: string[] = []
  let fans = 0

  const {
    isDealer = false,
    seatWind = 'E',
    roundWind = 'E',
    isLastTile = false,
    isKongDraw = false,
    isRobKong = false,
  } = context

  const isSelfDraw = winType === 'self-draw'
  const isConcealed = melds.length === 0  // 門清

  // ── 全部牌（hand + melds展開）
  const allTiles = [
    ...hand,
    ...melds.flatMap(m => m.tiles),
  ]

  // ── 手牌暗刻數（不含 meld 碰牌，含暗槓）
  const concealedTriplets = countConcealedTriplets(hand, melds)

  // ── 聽牌類型（preWinHand = fullHand 移除一張 winTile）
  let waitType: WaitType = 'two-sided'
  if (winTile) {
    const preWinHand = [...hand]
    const rmIdx = preWinHand.indexOf(winTile)
    if (rmIdx !== -1) preWinHand.splice(rmIdx, 1)
    waitType = detectWaitType(preWinHand, melds, winTile)
  }

  // ─────────────────────────────────────
  // 1. 特殊大牌型（最高優先，互斥）
  // ─────────────────────────────────────

  // 大四喜 16台
  if (hasAllWindPongs(melds, hand)) {
    fans += 16
    details.push('大四喜 16台')
    // 大四喜不另計個別風牌台
  }
  // 大三元 8台
  else if (hasAllDragonPongs(melds, hand)) {
    fans += 8
    details.push('大三元 8台')
    // 大三元不另計箭牌台
  }
  // 小四喜 8台
  else if (hasSmallFourWinds(melds, hand)) {
    fans += 8
    details.push('小四喜 8台')
    // 小四喜仍計圈風/門風
    const windFans = calcWindFans(melds, hand, roundWind, seatWind, true)
    fans += windFans.fans
    details.push(...windFans.details)
  }
  // 小三元 4台
  else if (hasSmallThreeDragons(melds, hand)) {
    fans += 4
    details.push('小三元 4台')
    // 小三元不另計箭牌台
    // 但仍計風牌台
    const windFans = calcWindFans(melds, hand, roundWind, seatWind, false)
    fans += windFans.fans
    details.push(...windFans.details)
  }
  else {
    // 一般：計風牌 + 箭牌
    const windFans = calcWindFans(melds, hand, roundWind, seatWind, false)
    fans += windFans.fans
    details.push(...windFans.details)

    const dragonFans = calcDragonFans(melds, hand)
    fans += dragonFans.fans
    details.push(...dragonFans.details)
  }

  // ─────────────────────────────────────
  // 2. 顏色/花色台
  // ─────────────────────────────────────

  // 清一色 8台
  if (isSingleSuitOnly(allTiles)) {
    fans += 8
    details.push('清一色 8台')
  }
  // 混一色 4台（清一色不疊加）
  else if (isMixedOneSuit(allTiles)) {
    fans += 4
    details.push('混一色 4台')
  }

  // ─────────────────────────────────────
  // 3. 刻子/暗刻台
  // ─────────────────────────────────────

  // 五暗刻 8台
  if (concealedTriplets >= 5) {
    fans += 8
    details.push('五暗刻 8台')
  }
  // 四暗刻 5台
  else if (concealedTriplets >= 4) {
    fans += 5
    details.push('四暗刻 5台')
  }
  // 三暗刻 2台
  else if (concealedTriplets >= 3) {
    fans += 2
    details.push('三暗刻 2台')
  }

  // 碰碰胡 4台（無順子）
  if (isAllPongs(melds, hand)) {
    fans += 4
    details.push('碰碰胡 4台')
  }

  // ─────────────────────────────────────
  // 4. 門清/自摸台
  // ─────────────────────────────────────

  if (isConcealed && isSelfDraw) {
    // 不求 3台（取代門清+自摸）
    fans += 3
    details.push('不求 3台')
  } else {
    if (isConcealed) {
      fans += 1
      details.push('門清 1台')
    }
    if (isSelfDraw) {
      fans += 1
      details.push('自摸 1台')
    }
  }

  // ─────────────────────────────────────
  // 5. 獨聽
  // ─────────────────────────────────────

  const DUTING_TYPES: WaitType[] = ['jin-ting', 'qi-bi', 'zhong-dong', 'dan-diao']
  if (DUTING_TYPES.includes(waitType)) {
    fans += 1
    const waitNameMap: Partial<Record<WaitType, string>> = {
      'jin-ting':   '緊聽',
      'qi-bi':      '騎壁',
      'zhong-dong': '中洞',
      'dan-diao':   '單吊',
    }
    const waitName = waitNameMap[waitType] ?? '獨聽'
    details.push(`獨聽（${waitName}）1台`)
  }

  // ─────────────────────────────────────
  // 6. 平胡 2台（嚴格條件）
  // ─────────────────────────────────────

  if (isPingHu(hand, melds, winType, waitType, allTiles)) {
    fans += 2
    details.push('平胡 2台')
  }

  // ─────────────────────────────────────
  // 7. 特殊情境台
  // ─────────────────────────────────────

  if (isLastTile && isSelfDraw) {
    fans += 1
    details.push('海底撈月 1台')
  } else if (isLastTile && !isSelfDraw) {
    fans += 1
    details.push('河底撈魚 1台')
  }

  if (isKongDraw) {
    fans += 1
    details.push('槓上開花 1台')
  }

  if (isRobKong) {
    fans += 1
    details.push('搶槓 1台')
  }

  // 莊家 1台
  if (isDealer) {
    fans += 1
    details.push('莊家 1台')
  }

  // 最少 1台
  if (fans === 0) {
    fans = 1
    details.push('平胡（基本）1台')
  }

  return {
    fans,
    pattern: details.join(' + '),
    details,
  }
}

// ═══════════════════════════════════════
// 輔助函式
// ═══════════════════════════════════════

/** 手牌暗刻數（排除碰牌，含暗槓） */
function countConcealedTriplets(hand: string[], melds: Meld[]): number {
  // 暗槓算暗刻
  const concealedKongs = melds.filter(m => m.type === 'kong' && m.isConcealed).length

  // 手牌中的刻子
  const counts = new Map<string, number>()
  for (const t of hand) counts.set(t, (counts.get(t) || 0) + 1)
  let handTriplets = 0
  for (const c of counts.values()) if (c >= 3) handTriplets++

  return handTriplets + concealedKongs
}

/** 所有面子都是刻子（碰碰胡） */
function isAllPongs(melds: Meld[], hand: string[]): boolean {
  // melds 中不能有 chow
  if (melds.some(m => m.type === 'chow')) return false

  // 手牌必須能組成純刻子（含眼）
  return canFormAllPongsPattern(hand, 5 - melds.length)
}

function canFormAllPongsPattern(hand: string[], needMelds: number, hasEye = false): boolean {
  if (hand.length === 0) return needMelds === 0 && hasEye
  if (hand.length === 2 && needMelds === 0 && !hasEye) return hand[0] === hand[1]

  const sorted = [...hand].sort()
  const first = sorted[0]
  const cnt = sorted.filter(t => t === first).length

  if (!hasEye && cnt >= 2) {
    const h2 = sorted.slice(2)
    if (canFormAllPongsPattern(h2, needMelds, true)) return true
  }
  if (needMelds > 0 && cnt >= 3) {
    const h2 = sorted.slice(3)
    if (canFormAllPongsPattern(h2, needMelds - 1, hasEye)) return true
  }
  return false
}

/** 清一色：只有一種數牌 */
function isSingleSuitOnly(tiles: string[]): boolean {
  const suits = new Set(tiles.map(t => t[t.length - 1]))
  if (suits.size !== 1) return false
  const suit = [...suits][0]
  return SUIT_TILES.includes(suit)
}

/** 混一色：一種數牌 + 字牌 */
function isMixedOneSuit(tiles: string[]): boolean {
  const suits = new Set(tiles.map(t => t[t.length - 1]).filter(s => SUIT_TILES.includes(s)))
  const hasHonor = tiles.some(t => HONOR_TILES.includes(t[t.length - 1]))
  return suits.size === 1 && hasHonor
}

/** 圈風/門風台 */
function calcWindFans(
  melds: Meld[], hand: string[],
  roundWind: string, seatWind: string,
  skipBigFourWinds: boolean
): { fans: number; details: string[] } {
  const details: string[] = []
  let fans = 0

  const allMelds = [...melds]
  // 手牌暗刻也算
  const handTriples = getHandTriplets(hand)
  const pongTiles = [
    ...allMelds.filter(m => m.type === 'pong' || m.type === 'kong').map(m => m.tiles[0]),
    ...handTriples,
  ]

  for (const t of pongTiles) {
    if (WIND_TILES.includes(t)) {
      if (!skipBigFourWinds) {
        if (t === roundWind) { fans += 1; details.push(`圈風(${t}) 1台`) }
        if (t === seatWind)  { fans += 1; details.push(`門風(${t}) 1台`) }
      }
    }
  }
  return { fans, details }
}

/** 箭牌台 */
function calcDragonFans(
  melds: Meld[], hand: string[]
): { fans: number; details: string[] } {
  const details: string[] = []
  let fans = 0

  const handTriples = getHandTriplets(hand)
  const pongTiles = [
    ...melds.filter(m => m.type === 'pong' || m.type === 'kong').map(m => m.tiles[0]),
    ...handTriples,
  ]

  for (const t of pongTiles) {
    if (DRAGON_TILES.includes(t)) {
      fans += 1
      const name = t === 'B' ? '白' : t === 'F' ? '發' : '中'
      details.push(`${name}（箭牌）1台`)
    }
  }
  return { fans, details }
}

/** 手牌中的刻子（3張同牌） */
function getHandTriplets(hand: string[]): string[] {
  const counts = new Map<string, number>()
  for (const t of hand) counts.set(t, (counts.get(t) || 0) + 1)
  const result: string[] = []
  for (const [tile, cnt] of counts.entries()) if (cnt >= 3) result.push(tile)
  return result
}

/** 大四喜：東南西北都有刻子 */
function hasAllWindPongs(melds: Meld[], hand: string[]): boolean {
  const handTriples = getHandTriplets(hand)
  const pongs = new Set([
    ...melds.filter(m => m.type === 'pong' || m.type === 'kong').map(m => m.tiles[0]),
    ...handTriples,
  ])
  return WIND_TILES.every(w => pongs.has(w))
}

/** 大三元：中發白都有刻子 */
function hasAllDragonPongs(melds: Meld[], hand: string[]): boolean {
  const handTriples = getHandTriplets(hand)
  const pongs = new Set([
    ...melds.filter(m => m.type === 'pong' || m.type === 'kong').map(m => m.tiles[0]),
    ...handTriples,
  ])
  return DRAGON_TILES.every(d => pongs.has(d))
}

/** 小四喜：東南西北3刻+1眼 */
function hasSmallFourWinds(melds: Meld[], hand: string[]): boolean {
  const handTriples = getHandTriplets(hand)
  const pongs = new Set([
    ...melds.filter(m => m.type === 'pong' || m.type === 'kong').map(m => m.tiles[0]),
    ...handTriples,
  ])
  const windPongs = WIND_TILES.filter(w => pongs.has(w))
  if (windPongs.length !== 3) return false
  // 第4個風必須是眼牌
  const missingWind = WIND_TILES.find(w => !pongs.has(w))!
  const cnt = hand.filter(t => t === missingWind).length
  return cnt >= 2
}

/** 小三元：中發白2刻+1眼 */
function hasSmallThreeDragons(melds: Meld[], hand: string[]): boolean {
  const handTriples = getHandTriplets(hand)
  const pongs = new Set([
    ...melds.filter(m => m.type === 'pong' || m.type === 'kong').map(m => m.tiles[0]),
    ...handTriples,
  ])
  const dragonPongs = DRAGON_TILES.filter(d => pongs.has(d))
  if (dragonPongs.length !== 2) return false
  const missingDragon = DRAGON_TILES.find(d => !pongs.has(d))!
  return hand.filter(t => t === missingDragon).length >= 2
}

/** 平胡嚴格條件：無字、無刻、非自摸、非獨聽、門清、雙面聽 */
function isPingHu(
  hand: string[], melds: Meld[],
  winType: 'self-draw' | 'win-from-others' | null,
  waitType: WaitType,
  allTiles: string[]
): boolean {
  if (winType === 'self-draw') return false      // 自摸無平胡
  if (melds.length > 0) return false             // 有吃碰槓無平胡
  if (waitType !== 'two-sided') return false     // 獨聽（緊/壁/洞/吊）無平胡
  if (allTiles.some(t => HONOR_TILES.includes(t[t.length - 1]))) return false  // 有字牌
  if (getHandTriplets(hand).length > 0) return false  // 有刻子
  return true
}

/** 自摸檢查（給 AI 用） */
export function checkSelfDrawWin(hand: string[], melds: Meld[]): boolean {
  if (hand.length === 0) return false
  const lastTile = hand[hand.length - 1]
  const result = checkWin(hand, melds, lastTile)
  return result.canWin
}
