/**
 * 辨識結果校正 UI
 *
 * 顯示辨識結果，允許使用者修改每張牌，確認後回傳校正結果。
 */

import type { RecognitionResult, CorrectedTiles, TileId } from './types'
import { VALID_TILE_IDS, isValidTileId } from './types'

const TILE_DISPLAY: Record<string, string> = {
  '1m':'1萬','2m':'2萬','3m':'3萬','4m':'4萬','5m':'5萬','6m':'6萬','7m':'7萬','8m':'8萬','9m':'9萬',
  '1p':'1筒','2p':'2筒','3p':'3筒','4p':'4筒','5p':'5筒','6p':'6筒','7p':'7筒','8p':'8筒','9p':'9筒',
  '1s':'1索','2s':'2索','3s':'3索','4s':'4索','5s':'5索','6s':'6索','7s':'7索','8s':'8索','9s':'9索',
  'E':'東','S':'南','W':'西','N':'北',
  'B':'白','F':'發','Z':'中',
}

function tileOptionHTML(selected: string): string {
  return VALID_TILE_IDS.map(id =>
    `<option value="${id}" ${id === selected ? 'selected' : ''}>${TILE_DISPLAY[id] ?? id}</option>`
  ).join('')
}

/**
 * 渲染校正 UI 到指定容器
 *
 * @returns Promise，使用者按下確認時 resolve 校正結果
 */
export function renderCorrectionUI(
  container: HTMLElement,
  result: RecognitionResult,
): Promise<CorrectedTiles | null> {
  return new Promise(resolve => {
    const tilesState = result.tiles.map(t => t.tileId)

    function render() {
      container.innerHTML = `
        <div class="camera-correction">
          <h3 style="margin: 0 0 12px; text-align: center;">辨識結果（${tilesState.length} 張）</h3>
          <p style="text-align: center; font-size: 0.85em; color: #888; margin-bottom: 16px;">
            耗時 ${result.processingMs.toFixed(0)}ms — 點擊牌面可修改
          </p>
          <div class="camera-correction__tiles">
            ${tilesState.map((tileId, i) => {
              const conf = result.tiles[i]?.confidence ?? 0
              const pct = (conf * 100).toFixed(0)
              const color = conf >= 0.9 ? '#4caf50' : conf >= 0.7 ? '#ff9800' : '#f44336'
              return `
                <div class="camera-correction__tile">
                  <select data-idx="${i}" class="camera-tile-select">
                    ${tileOptionHTML(tileId)}
                  </select>
                  <span style="font-size: 0.7em; color: ${color};">${pct}%</span>
                </div>
              `
            }).join('')}
          </div>
          <div class="camera-correction__actions">
            <button type="button" class="camera-btn camera-btn--confirm">確認匯入</button>
            <button type="button" class="camera-btn camera-btn--delete-last">刪除末張</button>
            <button type="button" class="camera-btn camera-btn--cancel">取消</button>
          </div>
        </div>
      `

      // 綁定 select 變更
      container.querySelectorAll<HTMLSelectElement>('.camera-tile-select').forEach(sel => {
        sel.addEventListener('change', () => {
          const idx = Number(sel.dataset.idx)
          const val = sel.value
          if (isValidTileId(val)) {
            tilesState[idx] = val
          }
        })
      })

      // 確認
      container.querySelector('.camera-btn--confirm')?.addEventListener('click', () => {
        resolve({ tiles: [...tilesState] as TileId[], originalResult: result })
      })

      // 刪除末張
      container.querySelector('.camera-btn--delete-last')?.addEventListener('click', () => {
        if (tilesState.length > 0) {
          tilesState.pop()
          render()
        }
      })

      // 取消
      container.querySelector('.camera-btn--cancel')?.addEventListener('click', () => {
        resolve(null)
      })
    }

    render()
  })
}
