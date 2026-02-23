import './style.css'
import './tile.css'
import './styles/discard-timeline.css'
import './styles/layout.css'
import './styles/mobile-optimized.css'
import './debug' // 🐛 Mobile Debug Tool (僅 dev 環境)
import { initWasm, GameEngine, lastWasmError } from './wasm'
import { GameState, PlayerAction, createInitialGameState, sortHand } from './gameState'
import { GameController } from './gameController'
import { renderHandHTML, renderMeldsHTML } from './tileRenderer'
import { renderDiscardTimeline, resetDiscardAnimations } from './components/DiscardTimeline'
import { initChowSelector, showChowSelector } from './components/ChowSelector'
import { getChowOptions } from './actionChecker'

const app = document.getElementById('app')!

let gameState: GameState = createInitialGameState()
let gameController: GameController | null = null

// 🀄 天聽模式：固定手牌 1112345678999萬 發發發（摸牌即可胡）
const TENPAI_HAND = ['1m', '1m', '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '9m', '9m', 'F', 'F', 'F']

// 記住上一局使用的模式，讓「再來一局」延續同模式
let currentGameMode = false

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

const phaseDisplay: { [key: string]: string } = {
  'draw': '摸牌階段',
  'discard': '出牌階段',
  'response': '響應階段',
  'end': '遊戲結束',
}

async function init() {
  app.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <p style="font-size: 1.2em; margin-bottom: 20px; color: #666;">
        正在加載 WASM 遊戲引擎...
      </p>
      <div style="display: inline-block; animation: spin 2s linear infinite; font-size: 3em;">
        ⚙️
      </div>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    </div>
  `

  // 加載 WASM
  const ready = await initWasm()
  
  if (!ready) {
    app.innerHTML = `
      <div style="text-align: center; color: #d32f2f; padding: 40px;">
        <p>❌ 無法加載 WASM 遊戲引擎</p>
        <p style="color: #d32f2f; margin-top: 10px; font-family: monospace; font-size: 0.9em;">${lastWasmError}</p>
        <p style="color: #666; margin-top: 10px;">請檢查瀏覽器控制台的錯誤信息</p>
      </div>
    `
    return
  }

  // 初始化吃牌選擇器
  initChowSelector()

  // 顯示主菜單
  showMenu()
}

function togglePlayerHand(playerIdx: number) {
  const handElement = document.getElementById(`player-hand-${playerIdx}`)
  const iconElement = document.getElementById(`toggle-icon-${playerIdx}`)
  const cardElement = document.getElementById(`player-card-${playerIdx}`)
  
  if (handElement && iconElement && cardElement) {
    const isExpanded = handElement.style.display !== 'none'
    
    if (isExpanded) {
      // 收起
      handElement.style.display = 'none'
      iconElement.textContent = '👇'
      cardElement.style.width = '100px'
      cardElement.style.boxShadow = 'none'
    } else {
      // 展開
      handElement.style.display = 'block'
      iconElement.textContent = '👆'
      cardElement.style.width = '240px'
      cardElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
    }
  }
}

function showGameEndScreen() {
  const winner = gameState.winner
  const winResult = gameState.winResult
  
  if (winner === null || !winResult) {
    // 流局
    app.innerHTML = `
      <style>
        @media (max-width: 768px) {
          .draw-screen {
            margin: 20px 10px !important;
            padding: 25px 15px !important;
          }
          .draw-screen h1 {
            font-size: 2.2em !important;
          }
          .draw-screen p {
            font-size: 1em !important;
          }
        }
      </style>
      <div class="draw-screen" style="max-width: 600px; margin: 40px auto; text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <h1 style="font-size: 3em; margin-bottom: 20px;">🌊 流局</h1>
        <p style="font-size: 1.2em; color: #666; margin-bottom: 30px;">牌堆已空，無人胡牌</p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button id="restartBtn" style="padding: 12px 30px; font-size: clamp(0.95em, 2.5vw, 1.1em); background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; -webkit-tap-highlight-color: transparent; min-width: 120px;">🔄 再來一局${currentGameMode ? '（天聽）' : ''}</button>
          <button id="menuBtn" style="padding: 12px 30px; font-size: clamp(0.95em, 2.5vw, 1.1em); background: #f0f0f0; color: #333; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; -webkit-tap-highlight-color: transparent; min-width: 120px;">🏠 返回菜單</button>
        </div>
      </div>
    `
    
    // 綁定按鈕事件
    const restartBtn = document.getElementById('restartBtn')
    const menuBtn = document.getElementById('menuBtn')
    
    if (restartBtn) {
      restartBtn.addEventListener('click', () => startGame(currentGameMode))
    }

    if (menuBtn) {
      menuBtn.addEventListener('click', () => showMenu())
    }

    return
  }
  
  const winnerPlayer = gameState.players[winner]
  const isPlayerWin = winner === 0
  
  app.innerHTML = `
    <style>
      @media (max-width: 768px) {
        .game-end-screen {
          margin: 10px !important;
          padding: 15px !important;
          border-radius: 8px !important;
          max-height: 95vh !important;
        }
        .game-end-screen h1 {
          font-size: clamp(2em, 10vw, 3em) !important;
        }
        .game-end-screen h2 {
          font-size: clamp(1.2em, 6vw, 2em) !important;
        }
      }
    </style>
    <div class="game-end-screen" style="max-width: 800px; margin: 20px auto; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="font-size: clamp(2.5em, 8vw, 4em); margin-bottom: 10px;">${isPlayerWin ? '🎉' : '😢'}</h1>
        <h2 style="font-size: clamp(1.5em, 5vw, 2.5em); margin-bottom: 15px; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
          ${isPlayerWin ? '恭喜胡牌！' : `${winnerPlayer.name} 胡牌`}
        </h2>
        
        <div style="display: inline-block; padding: 15px 25px; background: linear-gradient(135deg, #f8f9fa, #e9ecef); border-radius: 12px; margin-bottom: 20px;">
          <p style="font-size: clamp(1.1em, 3vw, 1.5em); color: #667eea; margin: 5px 0;">
            <strong>${winResult.winType}</strong>
          </p>
          <p style="font-size: clamp(1.4em, 4vw, 2em); color: #764ba2; margin: 8px 0;">
            <strong>${winResult.fans} 番</strong>
          </p>
          <p style="font-size: clamp(1em, 2.5vw, 1.2em); color: #666; margin: 5px 0;">
            ${winResult.pattern}
          </p>
        </div>
      </div>
      
      <!-- 各玩家手牌展示 -->
      <div style="margin-bottom: 15px; overflow-x: auto;">
        <h3 style="text-align: center; margin-bottom: 10px; color: #333; font-size: 1.1em;">最終手牌（點擊展開）</h3>
        <div style="display: flex; gap: 8px; justify-content: center; min-width: min-content;">
          ${gameState.players.map((p, idx) => `
            <div id="player-card-${idx}" style="flex: 0 0 auto; width: 100px; padding: 8px; background: ${idx === winner ? '#e8f5e9' : '#f9f9f9'}; border-radius: 6px; border: ${idx === winner ? '2px solid #4CAF50' : '2px solid #ddd'}; cursor: pointer; transition: all 0.2s; -webkit-tap-highlight-color: transparent;" onclick="togglePlayerHand(${idx})">
              <div style="text-align: center;">
                <div style="font-weight: bold; color: ${idx === winner ? '#2e7d32' : '#666'}; font-size: 0.85em; margin-bottom: 4px;">
                  ${p.name.substring(0, 3)} ${idx === winner ? '🏆' : ''}
                </div>
                <div style="font-size: 0.75em; color: #888; line-height: 1.3;">
                  🃏${p.hand.length}
                  ${p.melds.length > 0 ? `+${p.melds.length}組` : ''}
                </div>
                <div style="font-size: 1.2em; margin-top: 4px;">
                  <span id="toggle-icon-${idx}">👇</span>
                </div>
              </div>
              <div id="player-hand-${idx}" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px solid ${idx === winner ? '#4CAF50' : '#ddd'};">
                <div style="display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; margin-bottom: 6px;">
                  ${p.hand.map(tile => `<span style="padding: 4px 6px; background: white; border: 1px solid #ddd; border-radius: 3px; font-size: 0.75em;">${tileDisplay[tile]}</span>`).join('')}
                </div>
                ${p.melds.length > 0 ? `
                  <div style="margin-top: 6px; font-size: 0.7em;">
                    <strong style="color: #666;">組：</strong>
                    <div style="display: flex; flex-wrap: wrap; gap: 3px; margin-top: 3px;">
                      ${p.melds.map(m => `<span style="padding: 2px 4px; background: #e3f2fd; border-radius: 3px; font-size: 0.85em;">${m.tiles.map(t => tileDisplay[t]).join(' ')}</span>`).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- 按鈕 -->
      <div style="text-align: center; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 15px;">
        <button id="restartBtn" style="padding: 12px 30px; font-size: clamp(0.95em, 2.5vw, 1.1em); background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; transition: transform 0.2s; -webkit-tap-highlight-color: transparent; min-width: 120px;">
          🔄 再來一局${currentGameMode ? '（天聽）' : ''}
        </button>
        <button id="menuBtn" style="padding: 12px 30px; font-size: clamp(0.95em, 2.5vw, 1.1em); background: #f0f0f0; color: #333; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; transition: transform 0.2s; -webkit-tap-highlight-color: transparent; min-width: 120px;">
          🏠 返回菜單
        </button>
      </div>
    </div>
  `
  
  // 綁定按鈕事件（確保在手機端也能正常工作）
  const restartBtn = document.getElementById('restartBtn')
  const menuBtn = document.getElementById('menuBtn')
  
  if (restartBtn) {
    restartBtn.addEventListener('click', () => startGame(currentGameMode))
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', () => showMenu())
  }
}

function startGameTenpai() {
  startGame(true)
}

function showMenu() {
  app.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h2 style="text-align: center; margin-bottom: 8px; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
        🀄 麻將遊戲
      </h2>
      <p style="text-align: center; color: #999; margin-bottom: 30px; font-size: 0.9em;">選擇模式開始</p>

      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; margin-bottom: 30px;">

        <!-- 一般模式 -->
        <div onclick="startGame()" style="
          flex: 1; min-width: 200px; max-width: 240px;
          padding: 24px 20px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border-radius: 12px;
          cursor: pointer;
          text-align: center;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(102,126,234,0.3);
        " onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="font-size: 2.5em; margin-bottom: 10px;">🎲</div>
          <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">一般模式</div>
          <div style="font-size: 0.85em; opacity: 0.85; line-height: 1.5;">隨機發牌<br>正常遊戲流程</div>
        </div>

        <!-- 天聽模式 -->
        <div onclick="startGameTenpai()" style="
          flex: 1; min-width: 200px; max-width: 240px;
          padding: 24px 20px;
          background: linear-gradient(135deg, #f093fb, #f5576c);
          color: white;
          border-radius: 12px;
          cursor: pointer;
          text-align: center;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 15px rgba(245,87,108,0.3);
        " onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="font-size: 2.5em; margin-bottom: 10px;">🀄</div>
          <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">天聽模式</div>
          <div style="font-size: 0.85em; opacity: 0.85; line-height: 1.5;">1112345678999萬 發發發<br>摸牌即可測試胡牌</div>
        </div>

      </div>

      <div style="text-align: center;">
        <button onclick="showRules()" style="
          padding: 10px 28px;
          font-size: 0.95em;
          background: transparent;
          color: #888;
          border: 1px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
        ">📋 查看規則</button>
      </div>
    </div>
  `
}

function showRules() {
  alert(`台灣麻將規則：
  
🀄 基本規則
- 16 張麻將
- 4 人遊戲
- 144 張牌總計

🎯 遊戲流程
1. 摸牌
2. 出牌
3. 應對（碰/槓/吃）
4. 胡牌

💰 計分
- 平胡：100 分起
- 番數越高分數越多`)
}

function startGame(devMode = false) {
  currentGameMode = devMode
  GameEngine.resetGame()
  GameEngine.initGame()

  gameState = createInitialGameState()
  resetDiscardAnimations()

  if (devMode) {
    // 🀄 天聽模式：從牌堆移除固定手牌，直接設給玩家 0
    for (const tile of TENPAI_HAND) {
      GameEngine.removeTile(tile)
    }
    gameState.players[0].hand = [...TENPAI_HAND]
    gameState.players[0].hand = sortHand(gameState.players[0].hand)

    // AI 玩家（1-3）正常摸牌
    for (let playerIdx = 1; playerIdx < 4; playerIdx++) {
      for (let i = 0; i < 16; i++) {
        const tile = GameEngine.drawTile() as any
        if (tile && tile.tile) {
          gameState.players[playerIdx].hand.push(tile.tile)
          gameState.tileCount = tile.remaining || 0
        }
      }
      gameState.players[playerIdx].hand = sortHand(gameState.players[playerIdx].hand)
    }
  } else {
    // 正常模式：所有玩家隨機摸牌
    for (let playerIdx = 0; playerIdx < 4; playerIdx++) {
      for (let i = 0; i < 16; i++) {
        const tile = GameEngine.drawTile() as any
        if (tile && tile.tile) {
          gameState.players[playerIdx].hand.push(tile.tile)
          gameState.tileCount = tile.remaining || 0
        }
      }
      gameState.players[playerIdx].hand = sortHand(gameState.players[playerIdx].hand)
    }
  }

  gameController = new GameController(gameState, (newState) => {
    gameState = newState
    showGameBoard()
  })

  showGameBoard()
  
  // 自动开始第一轮（玩家摸牌）
  setTimeout(() => {
    if (gameController) {
      gameController.playerDraw()
    }
  }, 500)
}

let renderPending = false
let lastDiscardPoolLength = 0

function showGameBoard() {
  const currentDiscardPoolLength = gameState.discardPool.length
  const hasNewDiscard = currentDiscardPoolLength > lastDiscardPoolLength
  const isImportantStateChange = gameState.gamePhase === 'discard' && gameState.currentPlayerIdx === 0

  if (renderPending && !hasNewDiscard && !isImportantStateChange) return

  renderPending = true
  requestAnimationFrame(() => {
    lastDiscardPoolLength = gameState.discardPool.length
    renderGameBoardNow()
    renderPending = false
  })
}

function renderGameBoardNow() {
  // 檢查是否遊戲結束
  if (gameState.gamePhase === 'end') {
    showGameEndScreen()
    return
  }
  
  // 其他 3 個玩家的區域（上、左、右）
  const aiPlayers = gameState.players.filter((_, idx) => idx !== 0)
  const currentPlayer = gameState.players[gameState.currentPlayerIdx]
  const humanPlayer = gameState.players[0]
  
  // 检查玩家是否可以出牌
  const canDiscard = gameController?.canPlayerDiscard() || false

  // 检查玩家是否有响应权
  const hasResponseRight = humanPlayer.canAction
  
  // 获取可用动作
  let availableActions: string[] = []
  if (hasResponseRight && gameState.lastDiscardedTile && gameState.lastDiscardPlayer !== null) {
    // 出牌順序：3(東/上家) → 0(南/自己) → 1(西/下家) → 2(北/對家)
    // 自己(0) 的下家是 1，上家是 3；玩家 3 出牌時，玩家 0 是下家 → 可以吃
    const isNextPlayer = (gameState.lastDiscardPlayer + 1) % 4 === 0
    availableActions = gameController?.getAvailableActions(0, gameState.lastDiscardedTile, isNextPlayer) || []
  }
  
  // 获取摸牌后的状态
  const drawnTile = gameController?.getDrawnTile() || null
  const canWinAfterDraw = gameController?.getCanWinAfterDraw() || false
  const winResultAfterDraw = gameController?.getWinResultAfterDraw() || null
  const availableKongs = gameController?.getAvailableKongs() || []
  
  // 檢查高亮（可吃/碰的牌）
  let highlightTile: string | null = null
  let highlightType: 'chow' | 'pong' | null = null
  
  if (hasResponseRight && gameState.lastDiscardedTile) {
    highlightTile = gameState.lastDiscardedTile
    if (availableActions.includes('chow')) {
      highlightType = 'chow'
    } else if (availableActions.includes('pong')) {
      highlightType = 'pong'
    }
  }

  const meldsHtml = humanPlayer.melds.length > 0 ? `
    <div class="player-hand-melds">
      <strong class="player-hand-melds-title">已組牌：</strong>
      <div class="player-hand-melds-list">
        ${renderMeldsHTML(humanPlayer.melds)}
      </div>
    </div>
  ` : ''

  const winPanelHtml = ''  // 自摸提示改為全螢幕 overlay（見下方 tsumoOverlay）

  // 加槓/暗槓面板（出牌階段且是自己回合時顯示）
  const kongPanelHtml = availableKongs.length > 0 && !canWinAfterDraw && gameState.currentPlayerIdx === 0 ? `
    <div class="response-panel" style="margin-bottom: 12px; padding: 10px; background: #fff3e0; border: 2px solid #ff9800; border-radius: 8px;">
      <strong style="color: #e65100;">🀄 可以槓牌</strong>
      <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
        ${availableKongs.map(tile => {
          const isAddKong = humanPlayer.melds.some(m => m.type === 'pong' && m.tiles[0] === tile)
          const label = isAddKong ? `加槓 ${tileDisplay[tile] ?? tile}` : `暗槓 ${tileDisplay[tile] ?? tile}`
          const fn = isAddKong ? `playerAddKong('${tile}')` : `playerConcealedKong('${tile}')`
          return `<button type="button" onclick="${fn}" style="padding: 8px 16px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">${label}</button>`
        }).join('')}
      </div>
    </div>
  ` : ''

  const responsePanelHtml = hasResponseRight ? `
    <div class="response-panel" style="margin-bottom: 12px;">
      <div class="response-actions" style="display: flex; gap: 8px; width: 100%;">
        ${availableActions.includes('win')  ? `<button class="resp-btn resp-btn--win"  type="button" onclick="playerResponse('win')">胡</button>` : ''}
        ${availableActions.includes('kong') ? `<button class="resp-btn resp-btn--kong" type="button" onclick="playerResponse('kong')">槓</button>` : ''}
        ${availableActions.includes('pong') ? `<button class="resp-btn resp-btn--pong" type="button" onclick="playerResponse('pong')">碰</button>` : ''}
        ${availableActions.includes('chow') ? `<button class="resp-btn resp-btn--chow" type="button" onclick="playerResponse('chow')">吃</button>` : ''}
        <button class="resp-btn resp-btn--pass" type="button" onclick="playerResponse('pass')">過</button>
      </div>
    </div>
  ` : ''

  const handInfoHtml = [meldsHtml, winPanelHtml, kongPanelHtml, responsePanelHtml].filter(Boolean).join('')
  const handInfoSection = handInfoHtml ? `<div class="player-hand-info">${handInfoHtml}</div>` : ''

  // 自摸 overlay（摸到可胡牌時，全螢幕中央大字提示）
  const tsumoOverlay = canWinAfterDraw && winResultAfterDraw ? `
    <div style="
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55);
      z-index: 9998;
      animation: tsumo-bg-in 0.25s ease forwards;
    ">
      <div style="
        background: linear-gradient(135deg, #1b5e20, #2e7d32);
        color: white; border-radius: 20px;
        padding: 36px 48px; text-align: center;
        border: 4px solid #69f0ae;
        box-shadow: 0 0 60px #69f0ae88, 0 20px 60px rgba(0,0,0,0.5);
        animation: tsumo-pop 0.35s cubic-bezier(0.22,1,0.36,1) forwards;
        min-width: 280px;
      ">
        <div style="font-size: 3em; margin-bottom: 6px;">🀄</div>
        <div style="font-size: 2.8em; font-weight: 900; letter-spacing: 4px; color: #69f0ae; text-shadow: 0 0 20px #69f0ae;">自摸！</div>
        <div style="font-size: 1.5em; margin: 12px 0 4px; font-weight: bold;">${winResultAfterDraw.fans} 番</div>
        <div style="font-size: 1em; opacity: 0.85; margin-bottom: 24px;">${winResultAfterDraw.pattern}</div>
        <div style="display: flex; gap: 12px; justify-content: center; align-items: center;">
          <button type="button" onclick="playerWin()" style="
            padding: 16px 48px; font-size: 1.4em; font-weight: bold;
            background: #69f0ae; color: #1b5e20;
            border: none; border-radius: 10px; cursor: pointer;
            box-shadow: 0 4px 15px rgba(105,240,174,0.4);
          ">🀄 自摸</button>
          <button type="button" onclick="playerPass()" style="
            padding: 8px 16px; font-size: 0.85em;
            background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
            border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer;
          ">過</button>
        </div>
      </div>
    </div>
    <style>
      @keyframes tsumo-bg-in {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes tsumo-pop {
        0%   { opacity: 0; transform: scale(0.5) translateY(30px); }
        70%  { transform: scale(1.05) translateY(-4px); }
        100% { opacity: 1; transform: scale(1) translateY(0); }
      }
    </style>
  ` : ''

  // AI 動作提示
  const aiAction = gameState.lastAIAction
  const aiActionLabels: Record<string, string> = { chow: '吃', pong: '碰', kong: '槓' }
  const aiActionColors: Record<string, string> = { chow: '#42a5f5', pong: '#66bb6a', kong: '#ffa726' }
  const aiActionNotification = aiAction ? (() => {
    const player = gameState.players[aiAction.playerIdx]
    const label = aiActionLabels[aiAction.action] ?? aiAction.action
    const color = aiActionColors[aiAction.action] ?? '#fff'
    const tileName = tileDisplay[aiAction.tile] ?? aiAction.tile
    return `
      <div class="ai-action-notification" style="
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.82); color: white;
        padding: 18px 36px; border-radius: 16px;
        font-size: 1.6em; font-weight: bold; text-align: center;
        border: 3px solid ${color};
        box-shadow: 0 0 30px ${color}88;
        animation: ai-action-pop 0.3s cubic-bezier(0.22,1,0.36,1) forwards;
        pointer-events: none; z-index: 9999;
      ">
        <span style="color: ${color}; font-size: 1.1em;">${label}</span>
        <div style="font-size: 0.65em; opacity: 0.85; margin-top: 6px;">${player.name} &nbsp;${tileName}</div>
      </div>
    `
  })() : ''

  app.innerHTML = `
    <style>
      @keyframes ai-action-pop {
        0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
        60%  { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
    </style>
    <div id="game-container">
      ${tsumoOverlay}
      ${aiActionNotification}
      
      <!-- 頂部：三個 AI 玩家（左=上家/東, 中=對家/北, 右=下家/西）-->
      <div class="top-players">
        ${renderAIPlayer(gameState.players[3], gameState.currentPlayerIdx === 3, 'horizontal', '上家')}
        ${renderAIPlayer(gameState.players[2], gameState.currentPlayerIdx === 2, 'horizontal', '對家')}
        ${renderAIPlayer(gameState.players[1], gameState.currentPlayerIdx === 1, 'horizontal', '下家')}
      </div>

      <!-- 中間：牌桌 -->
      <div class="middle-area">
        <!-- 中央牌桌 -->
        <div class="game-board">
          <h2 class="game-board-title">🀄 牌桌</h2>
          
          <div class="game-board-content">
            <!-- 游戏状态 -->
            <div class="game-status">
              <p style="margin: 5px 0; font-size: 1.1em;">🃏 牌堆剩餘: <strong>${gameState.tileCount}</strong> 張</p>
              ${gameState.lastDiscardedTile ? `<p style="margin: 5px 0; font-size: 1.1em;">🎯 最後出牌: <strong>${tileDisplay[gameState.lastDiscardedTile]}</strong></p>` : ''}
            </div>
          
          <!-- 捨牌池時間線 -->
          ${renderDiscardTimeline({ 
            discardPool: gameState.discardPool,
            highlightTile,
            highlightType
          })}
          
          <!-- 状态提示 -->
          <div class="status-message" style="background: rgba(255, 255, 255, 0.15); padding: 10px; border-radius: 6px; margin: 15px 0; min-height: 40px;">
            ${getStatusMessage(canDiscard, hasResponseRight, gameState.gamePhase, gameState.currentPlayerIdx, canWinAfterDraw, winResultAfterDraw)}
          </div>
          
            <button onclick="showMenu()" style="
              padding: 10px 20px;
              background: #f44336;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: bold;
            ">
              🏠 返回菜單
            </button>
          </div>
        </div>
      </div>

      <!-- 底部：玩家手牌 -->
      <div class="player-hand-container">
        <div class="player-hand-header">
          <h3 style="margin: 0; color: #333;">
            你的手牌（${humanPlayer.hand.length} 張）
            ${humanPlayer.melds.length > 0 ? ` + ${humanPlayer.melds.length} 組` : ''}
          </h3>
          <div style="font-size: 0.7em; color: #666; margin-top: 4px;">
            階段: ${gameState.gamePhase} | 當前玩家: ${gameState.currentPlayerIdx} | 可出牌: ${canDiscard ? '✅' : '❌'} | 響應中: ${gameState.waitingForResponse ? '⏳' : '✅'}
          </div>
        </div>
        
        ${handInfoSection}
        
        <!-- 手牌 -->
        <div class="player-hand-tiles">
          ${renderHandHTML(humanPlayer.hand, drawnTile, canDiscard)}
        </div>
      </div>
    </div>
  `
}

function getStatusMessage(
  canDiscard: boolean, 
  hasResponseRight: boolean, 
  phase: string, 
  currentPlayerIdx: number,
  canWinAfterDraw: boolean = false,
  winResultAfterDraw: any = null
): string {
  if (phase === 'end') {
    return '<span style="color: #FFD700; font-size: 1.2em;">🎊 遊戲結束！</span>'
  }
  
  if (hasResponseRight) {
    return '<span style="color: #ffc107; font-size: 1.1em;">⚡ 請選擇響應動作</span>'
  }
  
  if (currentPlayerIdx === 0) {
    if (canWinAfterDraw && winResultAfterDraw) {
      return `<span style="color: #4CAF50; font-size: 1.2em;">🀄 自摸！${winResultAfterDraw.fans} 番</span>`
    } else if (canDiscard) {
      return '<span style="color: #4CAF50; font-size: 1.1em;">👉 請點擊手牌出牌</span>'
    } else if (phase === 'draw') {
      return '<span style="color: #2196F3; font-size: 1.1em;">📥 正在摸牌...</span>'
    } else if (phase === 'response') {
      return '<span style="color: #ff9800; font-size: 1.1em;">⏳ 等待其他玩家響應...</span>'
    }
  } else {
    return `<span style="color: #FFD700; font-size: 1.1em;">⏳ ${gameState.players[currentPlayerIdx].name} 回合中...</span>`
  }
  
  return ''
}


function renderAIPlayer(player: any, isCurrentPlayer: boolean = false, orientation: 'horizontal' | 'vertical' = 'horizontal', label: string = '') {
  const borderColor = isCurrentPlayer ? '#4CAF50' : '#FFF'
  const borderWidth = isCurrentPlayer ? '3px' : '2px'
  
  if (orientation === 'vertical') {
    return `
      <div class="ai-player-container" style="background: rgba(255, 255, 255, 0.1); border: ${borderWidth} solid ${borderColor}; border-radius: 8px; padding: 15px; color: white; text-align: center; writing-mode: vertical-rl; text-orientation: mixed;">
        ${label ? `<p style="margin: 0 0 4px 0; font-size: 0.75em; opacity: 0.7;">${label}</p>` : ''}
        <p style="margin: 0 0 10px 0; font-weight: bold;">${player.name} ${isCurrentPlayer ? '👈' : ''}</p>
        <p class="ai-player-hand-count" style="margin: 0 0 10px 0; font-size: 0.9em;">🃏 ${player.hand.length} 張</p>
        ${player.melds && player.melds.length > 0 ? `<p style="margin: 0 0 10px 0; font-size: 0.9em;">📦 ${player.melds.length} 組</p>` : ''}
      </div>
    `
  }

  return `
    <div class="ai-player-container" style="background: rgba(255, 255, 255, 0.1); border: ${borderWidth} solid ${borderColor}; border-radius: 8px; padding: 15px; color: white; flex: 1; min-width: 200px;">
      ${label ? `<div style="font-size: 0.75em; opacity: 0.7; margin-bottom: 4px;">${label}</div>` : ''}
      <h4 style="margin: 0 0 10px 0; color: ${isCurrentPlayer ? '#4CAF50' : '#FFD700'};">${player.name} ${isCurrentPlayer ? '👈' : ''}</h4>
      <div style="display: flex; justify-content: space-between; font-size: 0.9em;">
        <span class="ai-player-hand-count">🃏 ${player.hand.length} 張</span>
        ${player.melds && player.melds.length > 0 ? `<span>📦 ${player.melds.length} 組</span>` : ''}
        <span>💰 ${player.score}</span>
      </div>
    </div>
  `
}


function selectTile(idx: number) {
  if (!gameController) return
  gameController.playerDiscard(idx)
}

async function playerResponse(action: string) {
  if (!gameController) return

  // 如果是「過」，先觸發當下牌滑至側邊動畫（立即執行）
  if (action === 'pass') {
    const centerHighlight = document.querySelector('.discard-highlight-center')
    if (centerHighlight && !centerHighlight.classList.contains('animate-to-side')) {
      centerHighlight.classList.add('animate-to-side', 'manual')
    }
  }

  // 如果是吃牌，需要选择组合
  if (action === 'chow' && gameState.lastDiscardedTile) {
    const humanPlayer = gameState.players[0]
    const options = getChowOptions(humanPlayer.hand, gameState.lastDiscardedTile)

    if (options.length === 0) {
      alert('无法吃牌')
      return
    }

    if (options.length > 1) {
      const selectedTiles = await showChowSelector(options)

      if (selectedTiles) {
        gameController.playerResponse('chow', selectedTiles)
      } else {
        const centerHighlight = document.querySelector('.discard-highlight-center')
        if (centerHighlight && !centerHighlight.classList.contains('animate-to-side')) {
          centerHighlight.classList.add('animate-to-side', 'manual')
        }
        gameController.playerResponse('pass')
      }
    } else {
      gameController.playerResponse('chow', options[0].tiles)
    }
  } else {
    gameController.playerResponse(action as PlayerAction)
  }
}

function playerWin() {
  if (!gameController) return
  gameController.playerWin()
}

function playerPass() {
  if (!gameController) return
  // 放棄自摸胡牌，清除胡牌狀態，讓玩家繼續出牌
  gameController.clearWinState()
}

function playerAddKong(tile: string) {
  if (!gameController) return
  gameController.playerAddKong(tile)
}

function playerConcealedKong(tile: string) {
  if (!gameController) return
  gameController.playerConcealedKong(tile)
}

// 全局函數
Object.assign(window, {
  showMenu,
  startGame,
  startGameTenpai,
  showRules,
  selectTile,
  playerResponse,
  playerWin,
  playerPass,
  playerAddKong,
  playerConcealedKong,
  togglePlayerHand,
})

// 啟動應用
init()

// 吃牌選擇器的全局函數
function selectChowOption(index: number) {
  if (!gameController) return

  const lastDiscard = gameState.lastDiscardedTile
  if (!lastDiscard) return

  const humanPlayer = gameState.players[0]
  const options = getChowOptions(humanPlayer.hand, lastDiscard)

  if (index >= 0 && index < options.length) {
    const overlay = document.getElementById('chowSelectorOverlay')
    if (overlay) overlay.remove()
    gameController.playerResponse('chow', options[index].tiles)
  }
}

function passChow() {
  if (!gameController) return

  const overlay = document.getElementById('chowSelectorOverlay')
  if (overlay) overlay.remove()
  gameController.playerResponse('pass')
}

// 更新全局函數
Object.assign(window, {
  selectChowOption,
  passChow,
})
