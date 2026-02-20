// 捨牌時間線組件 - 中央海底設計 + 當下牌特顯 + 性能優化

import { DiscardedTile } from '../gameState'

interface DiscardTimelineProps {
  discardPool: DiscardedTile[]
  highlightTile?: string | null  // 可吃/碰的牌（高亮）
  highlightType?: 'chow' | 'pong' | null
}

// 全局追蹤：哪些捨牌的飛入動畫已經播放過
const animatedDiscardIds = new Set<string>()

// 重置動畫追蹤（新遊戲時調用）
export function resetDiscardAnimations(): void {
  animatedDiscardIds.clear()
}

// 性能優化：快取牌顯示文本
const tileDisplay: { [key: string]: string } = {
  '1m': '1萬', '2m': '2萬', '3m': '3萬', '4m': '4萬', '5m': '5萬',
  '6m': '6萬', '7m': '7萬', '8m': '8萬', '9m': '9萬',
  '1p': '1筒', '2p': '2筒', '3p': '3筒', '4p': '4筒', '5p': '5筒',
  '6p': '6筒', '7p': '7筒', '8p': '8筒', '9p': '9筒',
  '1s': '1索', '2s': '2索', '3s': '3索', '4s': '4索', '5s': '5索',
  '6s': '6索', '7s': '7索', '8s': '8索', '9s': '9索',
  'E': '東', 'S': '南', 'W': '西', 'N': '北',
  'B': '▢', 'F': '發', 'Z': '中',
}

const playerNames = ['東', '南', '西', '北']
const arrowSymbols = ['↑', '←', '↓', '→']
const playerColors = ['#ef5350', '#42a5f5', '#66bb6a', '#ffa726']

export function renderDiscardTimeline(props: DiscardTimelineProps): string {
  const { discardPool, highlightTile, highlightType } = props
  
  // 分類捨牌：按玩家分組
  const currentTile = discardPool.find(d => d.isCurrentTile)
  const historicTiles = discardPool.filter(d => !d.isCurrentTile)
  
  // 按玩家分組歷史牌
  const leftTiles = historicTiles.filter(d => d.player === 1)  // 南（上家）
  const centerTopTiles = historicTiles.filter(d => d.player === 2)  // 西（對家）
  const centerBottomTiles = historicTiles.filter(d => d.player === 0)  // 東（自己）
  const rightTiles = historicTiles.filter(d => d.player === 3)  // 北（下家）
  
  // 找出最後一張歷史牌（海底）
  const lastHistoricTile = historicTiles.length > 0 
    ? historicTiles.reduce((latest, tile) => 
        tile.timestamp > latest.timestamp ? tile : latest
      ) 
    : null
  
  // 渲染單張牌
  function renderTile(d: DiscardedTile, isCurrent: boolean = false, isHistoric: boolean = true): string {
    const shouldHighlight = highlightTile && d.tile === highlightTile && d.isCurrentTile
    const highlightClass = shouldHighlight ? (highlightType === 'chow' ? 'can-chow' : 'can-pong') : ''
    const highlightLabel = shouldHighlight ? (highlightType === 'chow' ? '吃' : '碰') : ''
    
    // 海底牌（最後一張歷史牌）不顯示箭頭
    const isLastHistoric = lastHistoricTile && d.id === lastHistoricTile.id
    
    // 飛入動畫 class（根據玩家位置）- 只有尚未播放過的才加動畫
    let flyClass = ''
    if (isCurrent) {
      const hasAnimated = animatedDiscardIds.has(d.id)
      console.log(`🎬 檢查動畫: 牌=${d.tile} ID=${d.id?.substring(0, 10)}... 已播放=${hasAnimated} 集合大小=${animatedDiscardIds.size}`)
      
      if (d.id && !hasAnimated) {
        const flyAnimations = ['fly-from-bottom', 'fly-from-left', 'fly-from-top', 'fly-from-right']
        flyClass = flyAnimations[d.player]
        animatedDiscardIds.add(d.id)
        console.log(`✅ 添加動畫: ${flyClass}`)
      } else {
        console.log(`⏭️ 跳過動畫（已播放或無ID）`)
      }
    }
    
    // 調試信息
    if (shouldHighlight) {
      console.log('✨ 高亮牌:', d.tile, '類型:', highlightType, '是當下牌:', d.isCurrentTile)
    }
    
    // 獲取牌的花色 class（用於顏色）
    const getTileColorClass = (tile: string): string => {
      const lastChar = tile[tile.length - 1]
      if (lastChar === 'm' || lastChar === 'p' || lastChar === 's') {
        return `tile-${lastChar}`
      }
      // 字牌：E, S, W, N, B, F, Z
      return `tile-${tile}`
    }
    
    const colorClass = getTileColorClass(d.tile)
    
    return `
      <div class="discard-tile ${isCurrent ? 'current-tile' : 'historic-tile'} ${flyClass} ${highlightClass} ${colorClass}" 
           style="position: relative;" data-discard-id="${d.id || ''}">
        <div class="tile-content">${tileDisplay[d.tile] || d.tile}</div>
        ${!isCurrent && !isLastHistoric ? `<div class="tile-arrow" style="color: ${playerColors[d.player]}">${arrowSymbols[d.player]}</div>` : ''}
        ${shouldHighlight && highlightLabel ? `<div class="highlight-label">${highlightLabel}</div>` : ''}
      </div>
    `
  }
  
  // 渲染當下牌特大區
  let currentTileHTML = ''
  let currentTilePosition = 'none'  // 'top', 'bottom', 'center', 'none'
  let shouldAnimateToSide = false  // 是否應該滑至側邊
  
  if (currentTile) {
    if (currentTile.player === 0) {
      // 自己（東家） -> 中央下方
      currentTilePosition = 'bottom'
    } else if (currentTile.player === 2) {
      // 對家（西家） -> 中央上方
      currentTilePosition = 'top'
    } else {
      // 上家/下家 -> 中央
      currentTilePosition = 'center'
      // 不再自動滑至側邊，讓捨牌保持可見直到下一個動作
      shouldAnimateToSide = false
    }
    
    currentTileHTML = renderTile(currentTile, true, false)
  }
  
  return `
    <div class="discard-timeline-container">
      <!-- 左區：上家（南家）捨牌 -->
      <div class="discard-left">
        ${leftTiles.reverse().map(d => renderTile(d)).join('')}
      </div>
      
      <!-- 中央區 -->
      <div class="discard-center">
        <!-- 中央上方：對家（西家） -->
        <div class="discard-center-top">
          ${currentTilePosition === 'top' ? `
            <div class="discard-highlight-top">
              ${currentTileHTML}
            </div>
          ` : ''}
          <div class="discard-tiles-top">
            ${centerTopTiles.map(d => renderTile(d)).join('')}
          </div>
        </div>
        
        <!-- 中央特大區（上/下家臨時顯示） -->
        ${currentTilePosition === 'center' && currentTile ? `
          <div class="discard-highlight-center ${shouldAnimateToSide ? 'animate-to-side' : ''}" data-player="${currentTile.player}">
            ${currentTileHTML}
          </div>
        ` : ''}
        
        <!-- 中央下方：自己（東家） -->
        <div class="discard-center-bottom">
          ${currentTilePosition === 'bottom' ? `
            <div class="discard-highlight-bottom">
              ${currentTileHTML}
            </div>
          ` : ''}
          <div class="discard-tiles-bottom">
            ${centerBottomTiles.map(d => renderTile(d)).join('')}
          </div>
        </div>
      </div>
      
      <!-- 右區：下家（北家）捨牌 -->
      <div class="discard-right">
        ${rightTiles.map(d => renderTile(d)).join('')}
      </div>
    </div>
  `
}
