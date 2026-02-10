// 吃牌選擇對話框組件

import { ChowOption } from '../actionChecker'

interface ChowSelectorProps {
  options: ChowOption[]
  onSelect: (tiles: string[]) => void
  onPass: () => void
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

export function renderChowSelector(props: ChowSelectorProps): string {
  const { options, onSelect, onPass } = props
  
  if (options.length === 0) {
    return ''
  }
  
  return `
    <div class="chow-selector-overlay" id="chowSelectorOverlay">
      <div class="chow-selector-dialog">
        <h3 style="margin: 0 0 20px 0; color: #333; text-align: center;">您可以這樣吃牌：</h3>
        
        <div class="chow-options">
          ${options.map((opt, idx) => `
            <button 
              class="chow-option-btn" 
              onclick="selectChowOption(${idx})"
            >
              <div class="chow-tiles">
                ${opt.tiles.map(t => `
                  <span class="chow-tile">${tileDisplay[t] || t}</span>
                `).join('')}
              </div>
              <div class="chow-label">吃</div>
            </button>
          `).join('')}
        </div>
        
        <div class="chow-actions">
          <button class="chow-pass-btn" onclick="passChow()">
            ⏭️ 過
          </button>
        </div>
      </div>
    </div>
    
    <style>
      .chow-selector-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        animation: fadeIn 0.2s ease-in-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .chow-selector-dialog {
        background: white;
        border-radius: 12px;
        padding: 30px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        min-width: 400px;
        max-width: 500px;
        animation: slideUp 0.3s ease-in-out;
      }
      
      @keyframes slideUp {
        from {
          transform: translateY(30px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      
      .chow-options {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .chow-option-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px 20px;
        background: linear-gradient(135deg, #e3f2fd, #bbdefb);
        border: 2px solid #2196F3;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .chow-option-btn:hover {
        background: linear-gradient(135deg, #bbdefb, #90caf9);
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
      }
      
      .chow-tiles {
        display: flex;
        gap: 8px;
      }
      
      .chow-tile {
        display: inline-block;
        padding: 8px 12px;
        background: white;
        border: 2px solid #333;
        border-radius: 6px;
        font-weight: bold;
        font-size: 1.1em;
        color: #333;
        min-width: 40px;
        text-align: center;
      }
      
      .chow-label {
        padding: 6px 16px;
        background: #4CAF50;
        color: white;
        border-radius: 6px;
        font-weight: bold;
        font-size: 1em;
      }
      
      .chow-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
      }
      
      .chow-pass-btn {
        padding: 12px 32px;
        background: #9e9e9e;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 1em;
        transition: all 0.2s;
      }
      
      .chow-pass-btn:hover {
        background: #757575;
        transform: scale(1.05);
      }
    </style>
  `
}

// 全局函數：選擇吃牌
declare global {
  interface Window {
    selectChowOption: (index: number) => void
    passChow: () => void
    chowSelectorCallback: ((tiles: string[] | null) => void) | null
    chowOptions: ChowOption[]
  }
}

// 註冊全局回調
export function initChowSelector() {
  window.selectChowOption = (index: number) => {
    const options = window.chowOptions || []
    if (index >= 0 && index < options.length) {
      const selected = options[index]
      if (window.chowSelectorCallback) {
        window.chowSelectorCallback(selected.tiles)
      }
      // 關閉對話框
      const overlay = document.getElementById('chowSelectorOverlay')
      if (overlay) {
        overlay.remove()
      }
    }
  }
  
  window.passChow = () => {
    if (window.chowSelectorCallback) {
      window.chowSelectorCallback(null)
    }
    // 關閉對話框
    const overlay = document.getElementById('chowSelectorOverlay')
    if (overlay) {
      overlay.remove()
    }
  }
  
  window.chowSelectorCallback = null
  window.chowOptions = []
}

// 顯示吃牌選擇器
export function showChowSelector(options: ChowOption[]): Promise<string[] | null> {
  return new Promise((resolve) => {
    window.chowOptions = options
    window.chowSelectorCallback = resolve
    
    const html = renderChowSelector({
      options,
      onSelect: () => {},
      onPass: () => {},
    })
    
    // 插入到 body
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container.firstElementChild!)
  })
}
