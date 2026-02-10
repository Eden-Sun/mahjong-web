// 捨牌時間線組件 - 中央海底設計 + 當下牌特顯

import { DiscardedTile } from '../gameState'

interface DiscardTimelineProps {
  discardPool: DiscardedTile[]
  highlightTile?: string | null  // 可吃/碰的牌（高亮）
  highlightType?: 'chow' | 'pong' | null
}

const tileDisplay: { [key: string]: string } = {
  '1m': '1萬', '2m': '2萬', '3m': '3萬', '4m': '4萬', '5m': '5萬',
  '6m': '6萬', '7m': '7萬', '8m': '8萬', '9m': '9萬',
  '1p': '1筒', '2p': '2筒', '3p': '3筒', '4p': '4筒', '5p': '5筒',
  '6p': '6筒', '7p': '7筒', '8p': '8筒', '9p': '9筒',
  '1s': '1索', '2s': '2索', '3s': '3索', '4s': '4索', '5s': '5索',
  '6s': '6索', '7s': '7索', '8s': '8索', '9s': '9索',
  'E': '東', 'S': '南', 'W': '西', 'N': '北',
  'B': '白', 'F': '發', 'Z': '中',
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
  
  // 渲染單張牌
  function renderTile(d: DiscardedTile, isCurrent: boolean = false, isHistoric: boolean = true): string {
    const shouldHighlight = highlightTile && d.tile === highlightTile && d.isCurrentTile
    const highlightClass = shouldHighlight ? (highlightType === 'chow' ? 'can-chow' : 'can-pong') : ''
    const highlightLabel = shouldHighlight ? (highlightType === 'chow' ? '吃' : '碰') : ''
    
    return `
      <div class="discard-tile ${isCurrent ? 'current-tile' : 'historic-tile'} ${highlightClass}" 
           style="position: relative;">
        <div class="tile-content">${tileDisplay[d.tile] || d.tile}</div>
        ${!isCurrent ? `<div class="tile-arrow" style="color: ${playerColors[d.player]}">${arrowSymbols[d.player]}</div>` : ''}
        ${shouldHighlight && highlightLabel ? `<div class="highlight-label">${highlightLabel}</div>` : ''}
      </div>
    `
  }
  
  // 渲染當下牌特大區
  let currentTileHTML = ''
  let currentTilePosition = 'none'  // 'top', 'bottom', 'center', 'none'
  
  if (currentTile) {
    if (currentTile.player === 0) {
      // 自己（東家） -> 中央下方
      currentTilePosition = 'bottom'
    } else if (currentTile.player === 2) {
      // 對家（西家） -> 中央上方
      currentTilePosition = 'top'
    } else {
      // 上家/下家 -> 中央（稍後滑至側邊）
      currentTilePosition = 'center'
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
          <div class="discard-highlight-center animate-to-side" data-player="${currentTile.player}">
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
