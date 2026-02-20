// 吃碰杠和牌检查逻辑

import { Player, Meld } from './gameState'

/**
 * 检查是否可以碰
 * 条件：手牌中有 2 张相同的牌
 */
export function canPong(hand: string[], tile: string): boolean {
  const count = hand.filter(t => t === tile).length
  return count >= 2
}

/**
 * 检查是否可以明杠
 * 条件：手牌中有 3 张相同的牌
 */
export function canKong(hand: string[], tile: string): boolean {
  const count = hand.filter(t => t === tile).length
  return count >= 3
}

/**
 * 检查是否可以暗杠
 * 条件：手牌中有 4 张相同的牌
 */
export function canConcealedKong(hand: string[]): string[] {
  const tileCounts = new Map<string, number>()
  
  for (const tile of hand) {
    tileCounts.set(tile, (tileCounts.get(tile) || 0) + 1)
  }
  
  const result: string[] = []
  for (const [tile, count] of tileCounts) {
    if (count === 4) {
      result.push(tile)
    }
  }
  
  return result
}

/**
 * 检查是否可以加杠
 * 条件：已经碰过的牌，手中又有一张
 */
export function canAddKong(hand: string[], melds: Meld[]): string[] {
  const result: string[] = []
  
  for (const meld of melds) {
    if (meld.type === 'pong') {
      const tile = meld.tiles[0]
      if (hand.includes(tile)) {
        result.push(tile)
      }
    }
  }
  
  return result
}

/**
 * 吃牌選項
 */
export interface ChowOption {
  tiles: string[]  // 組成的順子（已排序）
  with: string     // 要吃的牌
}

/**
 * 获取所有可吃的方式（新接口）
 */
export function getChowOptions(hand: string[], targetTile: string): ChowOption[] {
  const combinations = canChow(hand, targetTile)
  return combinations.map(tiles => ({
    tiles,
    with: targetTile,
  }))
}

/**
 * 检查是否可以吃
 * 条件：只能吃序数牌（1-9m, 1-9s, 1-9p），不能吃风牌和箭牌
 * 返回所有可能的吃牌组合
 */
export function canChow(hand: string[], tile: string): string[][] {
  // 只能吃序数牌
  if (!tile.match(/^[1-9][msp]$/)) {
    return []
  }
  
  const suit = tile[1]  // m, s, p
  const num = parseInt(tile[0])
  
  const result: string[][] = []
  
  // 检查三种可能的顺子组合
  // 1. [tile-2, tile-1, tile]
  if (num >= 3) {
    const tile1 = `${num - 2}${suit}`
    const tile2 = `${num - 1}${suit}`
    if (hand.includes(tile1) && hand.includes(tile2)) {
      result.push([tile1, tile2, tile])
    }
  }
  
  // 2. [tile-1, tile, tile+1]
  if (num >= 2 && num <= 8) {
    const tile1 = `${num - 1}${suit}`
    const tile2 = `${num + 1}${suit}`
    if (hand.includes(tile1) && hand.includes(tile2)) {
      result.push([tile1, tile, tile2])
    }
  }
  
  // 3. [tile, tile+1, tile+2]
  if (num <= 7) {
    const tile1 = `${num + 1}${suit}`
    const tile2 = `${num + 2}${suit}`
    if (hand.includes(tile1) && hand.includes(tile2)) {
      result.push([tile, tile1, tile2])
    }
  }
  
  return result
}

/**
 * 检查是否和牌
 * 简化版：检查手牌是否符合基本和牌型（4组面子 + 1对眼）
 */
export function checkWin(hand: string[], melds: Meld[], newTile?: string): { canWin: boolean; fans: number } {
  // 将新摸的牌加入手牌
  const fullHand = newTile ? [...hand, newTile] : [...hand]
  
  // 计算已有的面子数（碰、杠、吃）
  const meldCount = melds.length
  
  // 需要的面子数：4 组面子 + 1 对眼 = 14 张牌
  // 已有面子占用 3 张牌（或 4 张杠）
  const usedTiles = melds.reduce((sum, m) => sum + m.tiles.length, 0)
  const remainingTiles = fullHand.length
  
  // 总牌数应该是 14 张（或 17 张如果有杠）
  const totalTiles = usedTiles + remainingTiles
  if (totalTiles !== 14 && totalTiles !== 17) {
    return { canWin: false, fans: 0 }
  }
  
  // 简化检查：使用递归回溯检查是否能组成合法牌型
  const canWin = checkWinRecursive(fullHand, 4 - meldCount)
  
  if (canWin) {
    // 计算番数（简化版）
    let fans = 1  // 基本番
    
    // 自摸加番
    if (newTile) {
      fans += 1
    }
    
    // 门清加番（没有吃碰杠）
    if (melds.length === 0) {
      fans += 1
    }
    
    return { canWin: true, fans }
  }
  
  return { canWin: false, fans: 0 }
}

/**
 * 递归检查是否能组成合法牌型
 * @param hand 剩余手牌
 * @param needMelds 还需要的面子数
 */
function checkWinRecursive(hand: string[], needMelds: number): boolean {
  if (hand.length === 0 && needMelds === 0) {
    return true
  }
  
  if (hand.length === 2 && needMelds === 0) {
    // 检查是否是对子（眼牌）
    return hand[0] === hand[1]
  }
  
  if (needMelds === 0 || hand.length < 3) {
    return false
  }
  
  const sorted = [...hand].sort()
  const first = sorted[0]
  
  // 尝试组成刻子（3张相同）
  const pongCount = sorted.filter(t => t === first).length
  if (pongCount >= 3) {
    const newHand = [...sorted]
    for (let i = 0; i < 3; i++) {
      const idx = newHand.indexOf(first)
      if (idx !== -1) newHand.splice(idx, 1)
    }
    if (checkWinRecursive(newHand, needMelds - 1)) {
      return true
    }
  }
  
  // 尝试组成顺子（3张连续）
  if (first.match(/^[1-9][msp]$/)) {
    const suit = first[1]
    const num = parseInt(first[0])
    const tile2 = `${num + 1}${suit}`
    const tile3 = `${num + 2}${suit}`
    
    if (sorted.includes(tile2) && sorted.includes(tile3)) {
      const newHand = [...sorted]
      newHand.splice(newHand.indexOf(first), 1)
      newHand.splice(newHand.indexOf(tile2), 1)
      newHand.splice(newHand.indexOf(tile3), 1)
      
      if (checkWinRecursive(newHand, needMelds - 1)) {
        return true
      }
    }
  }
  
  // 如果第一张牌无法组成面子，尝试作为眼牌
  if (needMelds === 4 && pongCount >= 2) {
    const newHand = [...sorted]
    newHand.splice(newHand.indexOf(first), 1)
    newHand.splice(newHand.indexOf(first), 1)
    
    if (checkWinRecursive(newHand, needMelds)) {
      return true
    }
  }
  
  return false
}

/**
 * 执行碰操作
 */
export function executePong(player: Player, tile: string): boolean {
  const count = player.hand.filter(t => t === tile).length
  if (count < 2) return false
  
  // 从手牌中移除 2 张
  let removed = 0
  player.hand = player.hand.filter(t => {
    if (t === tile && removed < 2) {
      removed++
      return false
    }
    return true
  })
  
  // 加入 melds
  player.melds.push({
    type: 'pong',
    tiles: [tile, tile, tile],
    isConcealed: false,
  })
  
  return true
}

/**
 * 执行明杠操作
 */
export function executeKong(player: Player, tile: string): boolean {
  const count = player.hand.filter(t => t === tile).length
  if (count < 3) return false
  
  // 从手牌中移除 3 张
  let removed = 0
  player.hand = player.hand.filter(t => {
    if (t === tile && removed < 3) {
      removed++
      return false
    }
    return true
  })
  
  // 加入 melds
  player.melds.push({
    type: 'kong',
    tiles: [tile, tile, tile, tile],
    isConcealed: false,
  })
  
  return true
}

/**
 * 执行暗杠操作
 */
export function executeConcealedKong(player: Player, tile: string): boolean {
  const count = player.hand.filter(t => t === tile).length
  if (count < 4) return false
  
  // 从手牌中移除 4 张
  player.hand = player.hand.filter(t => t !== tile)
  
  // 加入 melds
  player.melds.push({
    type: 'kong',
    tiles: [tile, tile, tile, tile],
    isConcealed: true,
  })
  
  return true
}

/**
 * 执行吃操作
 */
export function executeChow(player: Player, tiles: string[], targetTile?: string): boolean {
  if (tiles.length !== 3) return false
  
  // 如果沒有傳入 targetTile，假設是最後一張（向後兼容）
  const tileToEat = targetTile || tiles[2]
  
  // 從手牌中移除另外 2 張（不包括要吃的那張）
  const toRemove = tiles.filter(t => t !== tileToEat)
  
  console.log('🍴 執行吃牌:', { tiles, tileToEat, toRemove, handBefore: [...player.hand] })
  
  if (toRemove.length !== 2) {
    console.error('❌ 吃牌失敗：需要移除 2 張手牌，但只找到', toRemove.length, '張')
    return false
  }
  
  for (const tile of toRemove) {
    const idx = player.hand.indexOf(tile)
    if (idx === -1) {
      console.error('❌ 吃牌失敗：手牌中找不到', tile)
      return false
    }
    player.hand.splice(idx, 1)
  }
  
  console.log('✅ 吃牌成功，手牌變為:', player.hand)
  
  // 加入 melds
  player.melds.push({
    type: 'chow',
    tiles: tiles,
    isConcealed: false,
  })
  
  return true
}
