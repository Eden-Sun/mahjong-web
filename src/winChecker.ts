// 胡牌检查算法（改进版）

import { Meld } from './gameState'

/**
 * 胡牌结果
 */
export interface WinResult {
  canWin: boolean
  winType: 'self-draw' | 'win-from-others' | null
  fans: number
  pattern: string
}

/**
 * 检查是否可以胡牌
 * @param hand 手牌
 * @param melds 已有的牌组（碰杠吃）
 * @param drawnTile 新摸的牌（自摸时使用）
 * @param discardedTile 别人出的牌（点和时使用）
 */
export function checkWin(
  hand: string[],
  melds: Meld[],
  drawnTile?: string,
  discardedTile?: string
): WinResult {
  // 确定胡牌类型
  let winType: 'self-draw' | 'win-from-others' | null = null
  let fullHand: string[] = []
  
  if (drawnTile) {
    // 自摸 - 新牌加入手牌
    winType = 'self-draw'
    fullHand = [...hand, drawnTile]
    console.log(`🎯 檢查自摸：手牌 ${hand.length} 張 + 新牌 [${drawnTile}] = ${fullHand.length} 張`)
  } else if (discardedTile) {
    // 点和 - 别人出的牌加入手牌
    winType = 'win-from-others'
    fullHand = [...hand, discardedTile]
    console.log(`🎯 檢查點胡：手牌 ${hand.length} 張 + 打出牌 [${discardedTile}] = ${fullHand.length} 張`)
  } else {
    // 只检查当前手牌
    fullHand = [...hand]
    console.log(`🎯 檢查當前手牌：${fullHand.length} 張`)
  }
  
  // 计算已有的面子数
  const meldCount = melds.length
  
  // 標準麻將：4 組面子 + 1 對眼
  // 不驗證總牌數，只驗證結構（能否組成需要的面子）
  const needMelds = 5 - meldCount
  
  console.log(`📊 已有 ${meldCount} 組面子，還需要 ${needMelds} 組`)
  
  // 检查是否能组成胡牌
  const canWin = canFormWinPattern(fullHand, needMelds)
  
  if (!canWin) {
    return { canWin: false, winType: null, fans: 0, pattern: '' }
  }
  
  // 计算番数和牌型
  const { fans, pattern } = calculateFans(fullHand, melds, winType)
  
  return { canWin: true, winType, fans, pattern }
}

/**
 * 递归检查能否组成胡牌
 * @param hand 剩余手牌
 * @param needMelds 还需要的面子数
 * @param hasEye 是否已经有眼牌
 */
export function canFormWinPattern(
  hand: string[],
  needMelds: number,
  hasEye: boolean = false
): boolean {
  // 终止条件：手牌用完且面子数正确
  if (hand.length === 0) {
    return needMelds === 0 && hasEye
  }
  
  // 如果只剩 2 张牌，检查是否是对子（眼牌）
  if (hand.length === 2 && needMelds === 0 && !hasEye) {
    return hand[0] === hand[1]
  }
  
  // 如果牌数不足以组成剩余面子
  if (hand.length < needMelds * 3 + (hasEye ? 0 : 2)) {
    return false
  }
  
  // 排序手牌
  const sorted = [...hand].sort()
  const first = sorted[0]
  
  // 统计第一张牌的数量
  const firstCount = sorted.filter(t => t === first).length
  
  // 策略 1：尝试将第一张牌作为眼牌（对子）
  if (!hasEye && firstCount >= 2) {
    const newHand = [...sorted]
    // 移除 2 张作为眼牌
    newHand.splice(0, 2)
    if (canFormWinPattern(newHand, needMelds, true)) {
      return true
    }
  }
  
  // 策略 2：尝试将第一张牌组成刻子（3 张相同）
  if (needMelds > 0 && firstCount >= 3) {
    const newHand = [...sorted]
    // 移除 3 张作为刻子
    newHand.splice(0, 3)
    if (canFormWinPattern(newHand, needMelds - 1, hasEye)) {
      return true
    }
  }
  
  // 策略 3：尝试将第一张牌组成顺子（3 张连续）
  if (needMelds > 0 && first.match(/^[1-9][msp]$/)) {
    const suit = first[1]
    const num = parseInt(first[0])
    
    if (num <= 7) {
      const tile2 = `${num + 1}${suit}`
      const tile3 = `${num + 2}${suit}`
      
      const idx2 = sorted.indexOf(tile2)
      const idx3 = sorted.indexOf(tile3)
      
      if (idx2 !== -1 && idx3 !== -1) {
        const newHand = [...sorted]
        // 移除顺子的 3 张牌（从后往前删除，避免索引变化）
        newHand.splice(idx3, 1)
        newHand.splice(idx2, 1)
        newHand.splice(0, 1)
        
        if (canFormWinPattern(newHand, needMelds - 1, hasEye)) {
          return true
        }
      }
    }
  }
  
  // 如果第一张牌无法组成任何组合，返回 false
  return false
}

/**
 * 计算番数
 * @param hand 手牌
 * @param melds 牌组
 * @param winType 胡牌类型
 */
export function calculateFans(
  hand: string[],
  melds: Meld[],
  winType: 'self-draw' | 'win-from-others' | null
): { fans: number; pattern: string } {
  let fans = 1  // 基础番（平胡）
  const patterns: string[] = ['平胡']
  
  // 自摸加番
  if (winType === 'self-draw') {
    fans += 1
    patterns.push('自摸')
  }
  
  // 门清加番（没有吃碰杠）
  if (melds.length === 0) {
    fans += 1
    patterns.push('門清')
  }
  
  // 检查暗刻数量
  const tileCounts = new Map<string, number>()
  for (const tile of hand) {
    tileCounts.set(tile, (tileCounts.get(tile) || 0) + 1)
  }
  
  let darkTriplets = 0
  for (const count of tileCounts.values()) {
    if (count >= 3) {
      darkTriplets++
    }
  }
  
  // 三暗刻
  if (darkTriplets >= 3) {
    fans += 1
    patterns.push('三暗刻')
  }
  
  // 检查是否全是一种花色（清一色）
  const suits = new Set<string>()
  for (const tile of hand) {
    const suit = tile[tile.length - 1]
    if (['m', 'p', 's'].includes(suit)) {
      suits.add(suit)
    }
  }
  
  if (suits.size === 1 && hand.every(t => ['m', 'p', 's'].includes(t[t.length - 1]))) {
    fans += 3
    patterns.push('清一色')
  }
  
  // 检查是否全是字牌（字一色）
  if (hand.every(t => ['E', 'S', 'W', 'N', 'B', 'F', 'Z'].includes(t[t.length - 1]))) {
    fans += 4
    patterns.push('字一色')
  }
  
  return {
    fans,
    pattern: patterns.join(' + '),
  }
}

/**
 * 检查自摸和牌（用于 AI）
 */
export function checkSelfDrawWin(hand: string[], melds: Meld[]): boolean {
  if (hand.length === 0) return false
  
  // 检查最后一张牌是否能胡
  const lastTile = hand[hand.length - 1]
  const result = checkWin(hand, melds, lastTile)
  
  return result.canWin
}
