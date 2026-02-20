// 牌卡渲染模块

import { Meld } from './gameState'

/**
 * Unicode 麻將牌字符對照表
 * U+1F000 起的麻將專用 Unicode 字符
 */
const TILE_EMOJI: Record<string, string> = {
  // 萬子 U+1F007–1F00F
  '1m': '🀇', '2m': '🀈', '3m': '🀉', '4m': '🀊', '5m': '🀋',
  '6m': '🀌', '7m': '🀍', '8m': '🀎', '9m': '🀏',
  // 索子 U+1F010–1F018
  '1s': '🀐', '2s': '🀑', '3s': '🀒', '4s': '🀓', '5s': '🀔',
  '6s': '🀕', '7s': '🀖', '8s': '🀗', '9s': '🀘',
  // 筒子 U+1F019–1F021
  '1p': '🀙', '2p': '🀚', '3p': '🀛', '4p': '🀜', '5p': '🀝',
  '6p': '🀞', '7p': '🀟', '8p': '🀠', '9p': '🀡',
  // 風牌 U+1F000–1F003
  'E': '🀀', 'S': '🀁', 'W': '🀂', 'N': '🀃',
  // 三元牌 U+1F004–1F006
  'Z': '🀄', 'F': '🀅', 'B': '🀆',
}

/** 取得牌的 Unicode 字符 */
export function tileToEmoji(tile: string): string {
  return TILE_EMOJI[tile] ?? tile
}

/**
 * 牌类型显示映射（保留備用）
 */
const tileTypeMap: { [key: string]: string } = {
  'm': '萬', 'p': '筒', 's': '索',
  'E': '東', 'S': '南', 'W': '西', 'N': '北',
  'B': '白', 'F': '發', 'Z': '中',
}

/**
 * 获取牌的显示文本（備用，供非 emoji 場景使用）
 */
export function getTileDisplay(tile: string): { suit: string; number: string } {
  const type = tile[tile.length - 1]
  if (['E', 'S', 'W', 'N', 'B', 'F', 'Z'].includes(type)) {
    return { suit: '', number: tileTypeMap[type] || type }
  }
  const num = tile.substring(0, tile.length - 1)
  return { suit: tileTypeMap[type] || type, number: num }
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
  
  // Unicode 麻將字符
  const emojiDiv = document.createElement('div')
  emojiDiv.className = 'tile-emoji'
  emojiDiv.textContent = tileToEmoji(tile)
  div.appendChild(emojiDiv)
  
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
 * 新摸的牌显示在最右边
 */
export function renderHandHTML(
  hand: string[],
  drawnTile: string | null = null,
  canDiscard: boolean = false
): string {
  // 分离新摸的牌和其他牌
  type TileItem = { tile: string; idx: number }
  const otherTiles: TileItem[] = []
  let newDrawItem: TileItem | null = null
  
  hand.forEach((tile, idx) => {
    if (drawnTile && tile === drawnTile && newDrawItem === null) {
      // 找到新摸的牌（第一个匹配）
      newDrawItem = { tile, idx } as TileItem
    } else {
      otherTiles.push({ tile, idx } as TileItem)
    }
  })
  
  // 先渲染其他牌，再渲染新摸的牌（最右边）
  const renderTileHtml = (tile: string, idx: number, isNewDraw: boolean) => {
    const tileClass = getTileClass(tile)
    const disabled = !canDiscard

    const classes = ['tile', tileClass]
    if (isNewDraw) classes.push('new-draw')
    if (disabled) classes.push('disabled')

    return `
      <button
        class="hand-tile-button ${classes.join(' ')}"
        data-tile="${tile}"
        data-index="${idx}"
        ${disabled ? 'disabled' : ''}
        ${disabled ? '' : `onclick="selectTile(${idx})"`}
        style="cursor: ${disabled ? 'not-allowed' : 'pointer'}; border: none; background: transparent; padding: 0;">
        <div class="tile-content" style="pointer-events: none;">
          <div class="tile-emoji">${tileToEmoji(tile)}</div>
        </div>
      </button>
    `
  }
  
  const html: string[] = []
  
  // 其他牌
  for (const item of otherTiles) {
    html.push(renderTileHtml(item.tile, item.idx, false))
  }
  
  // 新摸的牌在最右边
  if (newDrawItem !== null) {
    const item: TileItem = newDrawItem
    html.push(renderTileHtml(item.tile, item.idx, true))
  }
  
  return html.join('')
}

/**
 * 渲染牌组为 HTML 字符串
 */
export function renderMeldsHTML(melds: Meld[]): string {
  return melds.map(meld => {
    const typeIcon = meld.type === 'pong' ? '🤝' : meld.type === 'kong' ? '🔄' : '➡️'
    const tilesHTML = meld.tiles.map(tile => {
      const tileClass = getTileClass(tile)
      return `
        <div class="tile ${tileClass} disabled" data-tile="${tile}">
          <div class="tile-emoji">${tileToEmoji(tile)}</div>
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
