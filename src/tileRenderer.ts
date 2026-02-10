// 牌卡渲染模块

import { Meld } from './gameState'

/**
 * 牌类型显示映射
 */
const tileTypeMap: { [key: string]: string } = {
  'm': '萬',
  'p': '筒',
  's': '索',
  'E': '東',
  'S': '南',
  'W': '西',
  'N': '北',
  'B': '白',
  'F': '發',
  'Z': '中',
}

/**
 * 获取牌的显示文本
 */
export function getTileDisplay(tile: string): { suit: string; number: string } {
  const type = tile[tile.length - 1]
  
  // 风牌和箭牌
  if (['E', 'S', 'W', 'N', 'B', 'F', 'Z'].includes(type)) {
    return {
      suit: '',
      number: tileTypeMap[type] || type,
    }
  }
  
  // 序数牌
  const num = tile.substring(0, tile.length - 1)
  return {
    suit: tileTypeMap[type] || type,
    number: num,
  }
}

/**
 * 获取牌的类型类名
 */
export function getTileClass(tile: string): string {
  const type = tile[tile.length - 1]
  return `tile-${type}`
}

/**
 * 渲染单张牌
 * @param tile 牌标识（如 "5m", "E", "B"）
 * @param isNewDraw 是否是新摸的牌
 * @param isDisabled 是否禁用
 * @param onClick 点击回调
 */
export function renderTile(
  tile: string,
  isNewDraw: boolean = false,
  isDisabled: boolean = false,
  onClick?: () => void
): HTMLElement {
  const div = document.createElement('div')
  div.className = `tile ${getTileClass(tile)}`
  div.setAttribute('data-tile', tile)
  
  if (isNewDraw) {
    div.classList.add('new-draw')
  }
  
  if (isDisabled) {
    div.classList.add('disabled')
  }
  
  const display = getTileDisplay(tile)
  
  // 创建牌面元素
  if (display.suit) {
    const suitDiv = document.createElement('div')
    suitDiv.className = 'tile-suit'
    suitDiv.textContent = display.suit
    div.appendChild(suitDiv)
  }
  
  const numberDiv = document.createElement('div')
  numberDiv.className = 'tile-number'
  numberDiv.textContent = display.number
  div.appendChild(numberDiv)
  
  // 添加点击事件
  if (onClick && !isDisabled) {
    div.style.cursor = 'pointer'
    div.addEventListener('click', onClick)
  }
  
  return div
}

/**
 * 渲染手牌
 * @param hand 手牌数组
 * @param drawnTile 新摸的牌（可选）
 * @param canDiscard 是否可以出牌
 * @param onTileClick 牌点击回调
 */
export function renderHand(
  hand: string[],
  drawnTile: string | null = null,
  canDiscard: boolean = false,
  onTileClick?: (tileIdx: number) => void
): HTMLElement {
  const container = document.createElement('div')
  container.className = 'hand-container'
  
  hand.forEach((tile, idx) => {
    const isNewDraw = tile === drawnTile
    const tileElement = renderTile(
      tile,
      isNewDraw,
      !canDiscard,
      onTileClick ? () => onTileClick(idx) : undefined
    )
    container.appendChild(tileElement)
  })
  
  return container
}

/**
 * 渲染牌组（碰杠吃）
 * @param melds 牌组数组
 */
export function renderMelds(melds: Meld[]): HTMLElement {
  const container = document.createElement('div')
  container.className = 'melds-container'
  
  melds.forEach(meld => {
    const meldGroup = document.createElement('div')
    meldGroup.className = 'meld-group'
    
    // 添加类型图标
    const typeIcon = document.createElement('span')
    typeIcon.style.marginRight = '4px'
    typeIcon.style.fontSize = '16px'
    
    switch (meld.type) {
      case 'pong':
        typeIcon.textContent = '🤝'
        break
      case 'kong':
        typeIcon.textContent = '🔄'
        break
      case 'chow':
        typeIcon.textContent = '➡️'
        break
    }
    
    meldGroup.appendChild(typeIcon)
    
    // 添加牌
    meld.tiles.forEach(tile => {
      const tileElement = renderTile(tile, false, true)
      meldGroup.appendChild(tileElement)
    })
    
    container.appendChild(meldGroup)
  })
  
  return container
}

/**
 * 渲染手牌为 HTML 字符串（用于现有代码兼容）
 */
export function renderHandHTML(
  hand: string[],
  drawnTile: string | null = null,
  canDiscard: boolean = false
): string {
  return hand.map((tile, idx) => {
    const isNewDraw = tile === drawnTile
    const display = getTileDisplay(tile)
    const tileClass = getTileClass(tile)
    const disabled = !canDiscard
    
    const classes = ['tile', tileClass]
    if (isNewDraw) classes.push('new-draw')
    if (disabled) classes.push('disabled')
    
    return `
      <div 
        class="${classes.join(' ')}" 
        data-tile="${tile}"
        ${disabled ? '' : `onclick="selectTile(${idx})"`}
        style="cursor: ${disabled ? 'not-allowed' : 'pointer'};">
        ${display.suit ? `<div class="tile-suit">${display.suit}</div>` : ''}
        <div class="tile-number">${display.number}</div>
      </div>
    `
  }).join('')
}

/**
 * 渲染牌组为 HTML 字符串
 */
export function renderMeldsHTML(melds: Meld[]): string {
  return melds.map(meld => {
    const typeIcon = meld.type === 'pong' ? '🤝' : meld.type === 'kong' ? '🔄' : '➡️'
    const tilesHTML = meld.tiles.map(tile => {
      const display = getTileDisplay(tile)
      const tileClass = getTileClass(tile)
      
      return `
        <div class="tile ${tileClass} disabled" data-tile="${tile}" style="width: 50px; height: 65px;">
          ${display.suit ? `<div class="tile-suit" style="font-size: 10px;">${display.suit}</div>` : ''}
          <div class="tile-number" style="font-size: 20px;">${display.number}</div>
        </div>
      `
    }).join('')
    
    return `
      <div class="meld-group" style="display: flex; gap: 4px; padding: 8px; background: #f5f5f5; border: 2px solid #4CAF50; border-radius: 6px;">
        <span style="margin-right: 4px; font-size: 16px;">${typeIcon}</span>
        ${tilesHTML}
      </div>
    `
  }).join('')
}
