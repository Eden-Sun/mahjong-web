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
 * 执行加杠操作
 * 条件：已经碰过的牌，手中又有一张
 * 将碰牌升级为杠牌
 */
export function executeAddKong(player: Player, tile: string): boolean {
  const meldIdx = player.melds.findIndex(m => m.type === 'pong' && m.tiles[0] === tile)
  if (meldIdx === -1) return false

  const handIdx = player.hand.indexOf(tile)
  if (handIdx === -1) return false

  player.hand.splice(handIdx, 1)
  player.melds[meldIdx].type = 'kong'
  player.melds[meldIdx].tiles.push(tile)

  return true
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
  
  if (toRemove.length !== 2) return false

  for (const tile of toRemove) {
    const idx = player.hand.indexOf(tile)
    if (idx === -1) return false
    player.hand.splice(idx, 1)
  }
  
  // 加入 melds
  player.melds.push({
    type: 'chow',
    tiles: tiles,
    isConcealed: false,
  })
  
  return true
}
