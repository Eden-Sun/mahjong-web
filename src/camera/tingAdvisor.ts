/**
 * 聽牌分析器
 *
 * 純函式模組：根據手牌計算當前聽牌與打牌聽牌建議。
 * 依賴 winChecker.canFormWinPattern，不引入額外邏輯。
 */

import type { TileId } from './types'
import { VALID_TILE_IDS } from './types'
import { canFormWinPattern } from '../winChecker'

const MAX_COPIES = 4 // 每種牌最多 4 張

/**
 * 計算手牌中每種牌的張數
 */
function countTiles(hand: TileId[]): Map<TileId, number> {
  const counts = new Map<TileId, number>()
  for (const t of hand) counts.set(t, (counts.get(t) || 0) + 1)
  return counts
}

/**
 * 取得當前手牌的聽牌列表（手牌張數 % 3 === 1，例如 16/13/10 張）
 *
 * 窮舉 34 種牌，檢查加入後能否形成胡牌型。
 * 排除手牌中已有 4 張的牌（不可能再摸到）。
 */
export function getCurrentWaits(hand: TileId[]): TileId[] {
  const counts = countTiles(hand)
  const needMelds = (hand.length + 1 - 2) / 3 // (n+1) = needMelds*3 + 2

  if (!Number.isInteger(needMelds) || needMelds < 0) return []

  const waits: TileId[] = []
  for (const tile of VALID_TILE_IDS) {
    if ((counts.get(tile) || 0) >= MAX_COPIES) continue
    if (canFormWinPattern([...hand, tile], needMelds)) {
      waits.push(tile)
    }
  }
  return waits
}

/**
 * 計算打出每張牌後的聽牌情況（手牌張數 % 3 === 2，例如 17/14/11 張）
 *
 * 回傳：打出的牌 → 聽哪些牌，僅包含有聽牌的條目。
 * 相同牌不重複計算。
 */
export function getDiscardToWaits(hand: TileId[]): Partial<Record<TileId, TileId[]>> {
  const result: Partial<Record<TileId, TileId[]>> = {}
  const seen = new Set<TileId>()

  for (let i = 0; i < hand.length; i++) {
    const discard = hand[i]
    if (seen.has(discard)) continue
    seen.add(discard)

    const remaining = [...hand]
    remaining.splice(i, 1)
    const waits = getCurrentWaits(remaining as TileId[])
    if (waits.length > 0) {
      result[discard] = waits
    }
  }
  return result
}
