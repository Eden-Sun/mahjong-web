// AI 决策逻辑

import { Player, PlayerAction } from './gameState'
import { canPong, canKong, canChow, checkWin } from './actionChecker'

/**
 * AI 决定是否响应他人出牌
 * 优先级：和 > 杠 > 碰 > 吃 > 过
 */
export function getAIResponse(
  player: Player,
  tile: string,
  isNextPlayer: boolean  // 是否是下家（只有下家可以吃）
): { action: PlayerAction; tiles?: string[] } {
  // 1. 检查是否可以和牌
  const winCheck = checkWin(player.hand, player.melds, tile)
  if (winCheck.canWin) {
    return { action: 'win' }
  }
  
  // 2. 检查是否可以杠（70% 概率杠）
  if (canKong(player.hand, tile) && Math.random() < 0.7) {
    return { action: 'kong' }
  }
  
  // 3. 检查是否可以碰（60% 概率碰）
  if (canPong(player.hand, tile) && Math.random() < 0.6) {
    return { action: 'pong' }
  }
  
  // 4. 检查是否可以吃（只有下家，50% 概率吃）
  if (isNextPlayer) {
    const chowOptions = canChow(player.hand, tile)
    if (chowOptions.length > 0 && Math.random() < 0.5) {
      // 随机选择一个吃牌组合
      const chosen = chowOptions[Math.floor(Math.random() * chowOptions.length)]
      return { action: 'chow', tiles: chosen }
    }
  }
  
  // 5. 过
  return { action: 'pass' }
}

/**
 * AI 选择要出的牌
 * 策略：
 * 1. 优先出孤张（没有相邻或相同的牌）
 * 2. 优先出风牌和箭牌
 * 3. 随机出一张
 */
export function getAIDiscard(hand: string[]): number {
  if (hand.length === 0) return -1
  
  // 统计每张牌的"价值"（越低越容易出）
  const tileValues = hand.map((tile, idx) => {
    let value = 0
    
    // 风牌和箭牌价值较低
    if (tile.match(/^[ESNWBFZ]$/)) {
      value -= 10
    }
    
    // 检查是否有相同的牌（对子、刻子）
    const sameCount = hand.filter(t => t === tile).length
    value += sameCount * 5
    
    // 检查是否有相邻的牌（可能组成顺子）
    if (tile.match(/^[1-9][msp]$/)) {
      const suit = tile[1]
      const num = parseInt(tile[0])
      
      const hasLeft = hand.some(t => t === `${num - 1}${suit}`)
      const hasRight = hand.some(t => t === `${num + 1}${suit}`)
      
      if (hasLeft) value += 3
      if (hasRight) value += 3
    }
    
    return { idx, value }
  })
  
  // 按价值排序，选择价值最低的牌
  tileValues.sort((a, b) => a.value - b.value)
  
  // 在价值最低的几张牌中随机选择
  const lowValueTiles = tileValues.filter(t => t.value === tileValues[0].value)
  const chosen = lowValueTiles[Math.floor(Math.random() * lowValueTiles.length)]
  
  return chosen.idx
}

/**
 * AI 检查是否可以自摸和牌
 */
export function checkAISelfWin(player: Player): boolean {
  if (player.hand.length === 0) return false
  
  // 检查最后一张牌是否能和
  const lastTile = player.hand[player.hand.length - 1]
  const winCheck = checkWin(player.hand.slice(0, -1), player.melds, lastTile)
  
  return winCheck.canWin
}
