import './style.css'
import './tile.css'
import './styles/discard-timeline.css'
import './styles/layout.css'
import './styles/mobile-optimized.css'
import { initWasm, GameEngine } from './wasm'
import { GameState, createInitialGameState, sortHand } from './gameState'
import { GameController } from './gameController'
import { renderHandHTML, renderMeldsHTML } from './tileRenderer'
import { renderDiscardTimeline, resetDiscardAnimations } from './components/DiscardTimeline'
import { initChowSelector, showChowSelector } from './components/ChowSelector'
import { getChowOptions } from './actionChecker'

const app = document.getElementById('app')!

let gameState: GameState = createInitialGameState()
let gameController: GameController | null = null

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

function showMenu() {
  app.innerHTML = `
    <div style="max-width: 600px; margin: 0 auto;">
      <h2 style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
        🀄 麻將遊戲
      </h2>
      
      <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 40px;">
        <button id="startBtn" onclick="startGame()" style="
          padding: 15px 40px;
          font-size: 1.1em;
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          🎮 開始遊戲
        </button>
        
        <button id="ruleBtn" onclick="showRules()" style="
          padding: 15px 40px;
          font-size: 1.1em;
          background: #f0f0f0;
          color: #333;
          border: 2px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s;
        ">
          📋 查看規則
        </button>
      </div>
      
      <div style="padding: 30px; background: #f9f9f9; border-radius: 8px;">
        <h3 style="margin-bottom: 15px; color: #667eea;">✨ 功能</h3>
        <ul style="list-style: none; color: #666; line-height: 2; margin: 0; padding: 0;">
          <li>✅ 純前端 TypeScript + WebAssembly</li>
          <li>✅ 4 人麻將（1 人 + 3 AI）</li>
          <li>✅ 台灣麻將規則</li>
          <li>✅ 實時遊戲狀態</li>
        </ul>
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
4. 和牌

💰 計分
- 平胡：100 分起
- 番數越高分數越多`)
}

function startGame() {
  // 初始化遊戲
  const result = GameEngine.initGame()
  console.log('✓ 遊戲初始化:', result)

  // 重置遊戲狀態
  gameState = createInitialGameState()
  
  // 重置捨牌動畫追蹤
  resetDiscardAnimations()

  // 給每個玩家初始 16 張牌
  for (let playerIdx = 0; playerIdx < 4; playerIdx++) {
    for (let i = 0; i < 16; i++) {
      const tile = GameEngine.drawTile() as any
      if (tile && tile.tile) {
        gameState.players[playerIdx].hand.push(tile.tile)
        gameState.tileCount = tile.remaining || 0
      }
    }
    // 排序手牌
    gameState.players[playerIdx].hand = sortHand(gameState.players[playerIdx].hand)
  }

  // 创建游戏控制器
  gameController = new GameController(gameState, (newState) => {
    gameState = newState
    showGameBoard()
  })

  console.log('✓ 遊戲開始')
  showGameBoard()
  
  // 自动开始第一轮（玩家摸牌）
  setTimeout(() => {
    if (gameController) {
      gameController.playerDraw()
    }
  }, 500)
}

let renderCount = 0
let renderPending = false
let lastDiscardPoolLength = 0

function showGameBoard() {
  renderCount++
  
  // 檢查是否有新的捨牌
  const currentDiscardPoolLength = gameState.discardPool.length
  const hasNewDiscard = currentDiscardPoolLength > lastDiscardPoolLength
  
  console.log(`🎨 呼叫 showGameBoard (第 ${renderCount} 次)`, {
    捨牌池長度: currentDiscardPoolLength,
    上次長度: lastDiscardPoolLength,
    有新捨牌: hasNewDiscard
  })
  
  // 如果已經有待處理的渲染，且沒有新捨牌，跳過
  if (renderPending && !hasNewDiscard) {
    console.log(`⏭️  跳過渲染（已有待處理的渲染）`)
    return
  }
  
  renderPending = true
  
  // 使用 requestAnimationFrame 確保每幀只渲染一次
  requestAnimationFrame(() => {
    console.log(`✅ 執行渲染`)
    lastDiscardPoolLength = gameState.discardPool.length
    renderGameBoardNow()
    renderPending = false
  })
}

function renderGameBoardNow() {
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
    // 逆時針：檢查玩家 0 是否是打牌者的下一家（只有下一家才能吃）
    const isNextPlayer = (gameState.lastDiscardPlayer + 3) % 4 === 0
    availableActions = gameController?.getAvailableActions(0, gameState.lastDiscardedTile, isNextPlayer) || []
  }
  
  // 获取摸牌后的状态
  const drawnTile = gameController?.getDrawnTile() || null
  const canWinAfterDraw = gameController?.getCanWinAfterDraw() || false
  const winResultAfterDraw = gameController?.getWinResultAfterDraw() || null
  
  // 檢查高亮（可吃/碰的牌）
  let highlightTile: string | null = null
  let highlightType: 'chow' | 'pong' | null = null
  
  console.log('🔍 高亮檢查:', { 
    hasResponseRight, 
    lastDiscardedTile: gameState.lastDiscardedTile,
    availableActions,
    discardPoolLength: gameState.discardPool.length,
    currentTiles: gameState.discardPool.filter(d => d.isCurrentTile).map(d => d.tile)
  })
  
  if (hasResponseRight && gameState.lastDiscardedTile) {
    highlightTile = gameState.lastDiscardedTile
    if (availableActions.includes('chow')) {
      highlightType = 'chow'
      console.log('🔴 高亮吃牌:', highlightTile)
    } else if (availableActions.includes('pong')) {
      highlightType = 'pong'
      console.log('🟠 高亮碰牌:', highlightTile)
    }
  }

  app.innerHTML = `
    <div id="game-container">
      
      <!-- 頂部：三個 AI 玩家 -->
      <div class="top-players">
        ${renderAIPlayer(aiPlayers[0] || gameState.players[1], gameState.currentPlayerIdx === 1)}
        ${renderAIPlayer(aiPlayers[1] || gameState.players[2], gameState.currentPlayerIdx === 2)}
        ${renderAIPlayer(aiPlayers[2] || gameState.players[3], gameState.currentPlayerIdx === 3)}
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
        </div>
        
        <!-- 碰杠吃的牌组 -->
        ${humanPlayer.melds.length > 0 ? `
          <div style="margin-bottom: 15px;">
            <strong style="color: #666; display: block; margin-bottom: 8px;">已組牌：</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
              ${renderMeldsHTML(humanPlayer.melds)}
            </div>
          </div>
        ` : ''}
        
        <!-- 自摸和牌按钮 -->
        ${canWinAfterDraw && winResultAfterDraw ? `
          <div class="response-panel response-panel--win" style="margin-bottom: 15px; padding: 15px; background: #e8f5e9; border: 3px solid #4CAF50; border-radius: 8px; animation: pulse 1.5s ease-in-out infinite;">
            <strong class="response-title" style="color: #2e7d32; font-size: 1.2em;">🏆 可以和牌！</strong>
            <p class="response-subtitle" style="color: #2e7d32; margin: 8px 0;">番數：${winResultAfterDraw.fans} 番 | 牌型：${winResultAfterDraw.pattern}</p>
            <div class="response-actions response-actions--duo" style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="response-button response-button--win" type="button" onclick="playerWin()" style="padding: 12px 24px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1.1em; flex: 1;">
                🎉 和牌
              </button>
              <button class="response-button response-button--pass" type="button" onclick="playerPass()" style="padding: 12px 24px; background: #9e9e9e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                ⏭️ 過
              </button>
            </div>
          </div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.02); }
            }
          </style>
        ` : ''}
        
        <!-- 响应按钮 -->
        ${hasResponseRight ? `
          <div class="response-panel response-panel--notice" style="margin-bottom: 15px; padding: 15px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 6px;">
            <strong class="response-title" style="color: #856404;">⚡ 你可以響應！</strong>
            <div class="response-actions response-actions--multi" style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
              ${availableActions.includes('win') ? '<button class="response-button response-button--win" type="button" onclick="playerResponse(\\\'win\\\')" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🎉 和牌</button>' : ''}
              ${availableActions.includes('kong') ? '<button class="response-button response-button--kong" type="button" onclick="playerResponse(\\\'kong\\\')" style="padding: 8px 16px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🔄 槓</button>' : ''}
              ${availableActions.includes('pong') ? '<button class="response-button response-button--pong" type="button" onclick="playerResponse(\\\'pong\\\')" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🤝 碰</button>' : ''}
              ${availableActions.includes('chow') ? '<button class="response-button response-button--chow" type="button" onclick="playerResponse(\\\'chow\\\')" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">➡️ 吃</button>' : ''}
              <button class="response-button response-button--pass" type="button" onclick="playerResponse('pass')" style="padding: 8px 16px; background: #9e9e9e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">⏭️ 過</button>
            </div>
          </div>
        ` : ''}
        
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
      return `<span style="color: #4CAF50; font-size: 1.2em;">🏆 可以和牌！(${winResultAfterDraw.fans} 番)</span>`
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


function renderAIPlayer(player: any, isCurrentPlayer: boolean = false, orientation: 'horizontal' | 'vertical' = 'horizontal') {
  const borderColor = isCurrentPlayer ? '#4CAF50' : '#FFF'
  const borderWidth = isCurrentPlayer ? '3px' : '2px'
  
  if (orientation === 'vertical') {
    return `
      <div class="ai-player-container" style="background: rgba(255, 255, 255, 0.1); border: ${borderWidth} solid ${borderColor}; border-radius: 8px; padding: 15px; color: white; text-align: center; writing-mode: vertical-rl; text-orientation: mixed;">
        <p style="margin: 0 0 10px 0; font-weight: bold;">${player.name} ${isCurrentPlayer ? '👈' : ''}</p>
        <p class="ai-player-hand-count" style="margin: 0 0 10px 0; font-size: 0.9em;">🃏 ${player.hand.length} 張</p>
        ${player.melds && player.melds.length > 0 ? `<p style="margin: 0 0 10px 0; font-size: 0.9em;">📦 ${player.melds.length} 組</p>` : ''}
      </div>
    `
  }

  return `
    <div class="ai-player-container" style="background: rgba(255, 255, 255, 0.1); border: ${borderWidth} solid ${borderColor}; border-radius: 8px; padding: 15px; color: white; flex: 1; min-width: 200px;">
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
  if (!gameController) {
    console.warn('游戏控制器未初始化')
    return
  }
  
  // 玩家出牌
  gameController.playerDiscard(idx)
}

async function playerResponse(action: string) {
  if (!gameController) {
    console.warn('游戏控制器未初始化')
    return
  }
  
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
    
    // 如果有多个选项，显示选择对话框
    if (options.length > 1) {
      const selectedTiles = await showChowSelector(options)
      
      if (selectedTiles) {
        gameController.playerResponse('chow', selectedTiles)
      } else {
        // 玩家選擇過
        const centerHighlight = document.querySelector('.discard-highlight-center')
        if (centerHighlight && !centerHighlight.classList.contains('animate-to-side')) {
          centerHighlight.classList.add('animate-to-side', 'manual')
        }
        gameController.playerResponse('pass')
      }
    } else {
      // 只有一种吃法，直接执行
      gameController.playerResponse('chow', options[0].tiles)
    }
  } else {
    gameController.playerResponse(action as any)
  }
}

function playerWin() {
  if (!gameController) {
    console.warn('游戏控制器未初始化')
    return
  }
  
  gameController.playerWin()
}

function playerPass() {
  if (!gameController) {
    console.warn('游戏控制器未初始化')
    return
  }
  
  // 玩家选择不和，继续出牌
  // 不做任何操作，玩家可以继续选择出牌
  console.log('玩家选择过，继续出牌')
}

// 全局函數
Object.assign(window, {
  showMenu,
  startGame,
  showRules,
  selectTile,
  playerResponse,
  playerWin,
  playerPass,
})

// 啟動應用
init()
