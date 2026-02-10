import './style.css'
import { initWasm, GameEngine } from './wasm'
import { GameState, createInitialGameState, sortHand } from './gameState'
import { GameController } from './gameController'

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

function showGameBoard() {
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
    const isNextPlayer = (gameState.lastDiscardPlayer + 1) % 4 === 0
    availableActions = gameController?.getAvailableActions(0, gameState.lastDiscardedTile, isNextPlayer) || []
  }

  app.innerHTML = `
    <div style="width: 100%; height: 100vh; background: linear-gradient(135deg, #1e3c72, #2a5298); padding: 20px; font-family: Arial, sans-serif; display: flex; flex-direction: column;">
      
      <!-- 頂部：AI 玩家 1 和 2 -->
      <div style="display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; flex: 0;">
        ${renderAIPlayer(aiPlayers[0] || gameState.players[1], gameState.currentPlayerIdx === 1)}
        ${renderAIPlayer(aiPlayers[1] || gameState.players[2], gameState.currentPlayerIdx === 2)}
      </div>

      <!-- 中間：牌桌 + AI 玩家 3 -->
      <div style="display: flex; gap: 20px; flex: 1; justify-content: center; align-items: center;">
        <!-- AI 玩家 3（左） -->
        <div style="flex-direction: column; display: flex; align-items: center;">
          ${renderAIPlayer(aiPlayers[2] || gameState.players[3], gameState.currentPlayerIdx === 3, 'vertical')}
        </div>

        <!-- 中央牌桌 -->
        <div style="background: rgba(0, 0, 0, 0.3); border: 3px solid #FFD700; border-radius: 12px; padding: 20px; text-align: center; color: white; min-width: 350px;">
          <h2 style="margin: 0 0 15px 0; color: #FFD700;">🀄 牌桌</h2>
          
          <!-- 游戏状态 -->
          <div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 5px 0; font-size: 1.1em;">📍 階段: <strong>${phaseDisplay[gameState.gamePhase]}</strong></p>
            <p style="margin: 5px 0; font-size: 1.1em;">👤 當前玩家: <strong style="color: ${gameState.currentPlayerIdx === 0 ? '#4CAF50' : '#FFD700'}">${currentPlayer.name}</strong></p>
            <p style="margin: 5px 0; font-size: 1.1em;">🃏 牌堆剩餘: <strong>${gameState.tileCount}</strong> 張</p>
            ${gameState.lastDiscardedTile ? `<p style="margin: 5px 0; font-size: 1.1em;">🎯 最後出牌: <strong>${tileDisplay[gameState.lastDiscardedTile]}</strong></p>` : ''}
          </div>
          
          <!-- 状态提示 -->
          <div style="background: rgba(255, 255, 255, 0.15); padding: 10px; border-radius: 6px; margin-bottom: 15px; min-height: 40px;">
            ${getStatusMessage(canDiscard, hasResponseRight, gameState.gamePhase, gameState.currentPlayerIdx)}
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

        <!-- 右側預留（未來可加） -->
        <div style="width: 100px;"></div>
      </div>

      <!-- 底部：玩家手牌 -->
      <div style="background: rgba(255, 255, 255, 0.95); border-radius: 12px; padding: 20px; margin-top: 20px; flex: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0; color: #333;">
            你的手牌（${humanPlayer.hand.length} 張）
            ${humanPlayer.melds.length > 0 ? ` + ${humanPlayer.melds.length} 組` : ''}
          </h3>
        </div>
        
        <!-- 碰杠吃的牌组 -->
        ${humanPlayer.melds.length > 0 ? `
          <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
            <strong style="color: #666;">已組牌：</strong>
            ${renderMelds(humanPlayer.melds)}
          </div>
        ` : ''}
        
        <!-- 响应按钮 -->
        ${hasResponseRight ? `
          <div style="margin-bottom: 15px; padding: 15px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 6px;">
            <strong style="color: #856404;">⚡ 你可以響應！</strong>
            <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
              ${availableActions.includes('win') ? '<button onclick="playerResponse(\'win\')" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🎉 和牌</button>' : ''}
              ${availableActions.includes('kong') ? '<button onclick="playerResponse(\'kong\')" style="padding: 8px 16px; background: #ff9800; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🔄 槓</button>' : ''}
              ${availableActions.includes('pong') ? '<button onclick="playerResponse(\'pong\')" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🤝 碰</button>' : ''}
              ${availableActions.includes('chow') ? '<button onclick="playerResponse(\'chow\')" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">➡️ 吃</button>' : ''}
              <button onclick="playerResponse('pass')" style="padding: 8px 16px; background: #9e9e9e; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">⏭️ 過</button>
            </div>
          </div>
        ` : ''}
        
        <!-- 手牌 -->
        <div style="display: flex; flex-wrap: wrap; gap: 8px; min-height: 80px; align-content: flex-start;">
          ${renderPlayerHand(humanPlayer.hand, canDiscard)}
        </div>
        
        <!-- 弃牌堆 -->
        ${humanPlayer.discardPile.length > 0 ? `
          <div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
            <strong style="color: #666;">已出牌：</strong>
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px;">
              ${humanPlayer.discardPile.slice(-12).map(t => `<span style="background: #e0e0e0; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;">${tileDisplay[t] || t}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `
}

function getStatusMessage(canDiscard: boolean, hasResponseRight: boolean, phase: string, currentPlayerIdx: number): string {
  if (phase === 'end') {
    return '<span style="color: #FFD700; font-size: 1.2em;">🎊 遊戲結束！</span>'
  }
  
  if (hasResponseRight) {
    return '<span style="color: #ffc107; font-size: 1.1em;">⚡ 請選擇響應動作</span>'
  }
  
  if (currentPlayerIdx === 0) {
    if (canDiscard) {
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

function renderMelds(melds: any[]): string {
  return melds.map(meld => {
    const typeIcon = meld.type === 'pong' ? '🤝' : meld.type === 'kong' ? '🔄' : '➡️'
    return `<span style="display: inline-block; margin: 4px; padding: 6px 10px; background: white; border: 2px solid #4CAF50; border-radius: 6px;">
      ${typeIcon} ${meld.tiles.map((t: string) => tileDisplay[t] || t).join(' ')}
    </span>`
  }).join('')
}

function renderAIPlayer(player: any, isCurrentPlayer: boolean = false, orientation: 'horizontal' | 'vertical' = 'horizontal') {
  const borderColor = isCurrentPlayer ? '#4CAF50' : '#FFF'
  const borderWidth = isCurrentPlayer ? '3px' : '2px'
  
  if (orientation === 'vertical') {
    return `
      <div style="background: rgba(255, 255, 255, 0.1); border: ${borderWidth} solid ${borderColor}; border-radius: 8px; padding: 15px; color: white; text-align: center; writing-mode: vertical-rl; text-orientation: mixed;">
        <p style="margin: 0 0 10px 0; font-weight: bold;">${player.name} ${isCurrentPlayer ? '👈' : ''}</p>
        <p style="margin: 0 0 10px 0; font-size: 0.9em;">🃏 ${player.hand.length} 張</p>
        ${player.melds && player.melds.length > 0 ? `<p style="margin: 0 0 10px 0; font-size: 0.9em;">📦 ${player.melds.length} 組</p>` : ''}
        <div style="border-top: 1px solid #FFF; padding-top: 10px; writing-mode: initial;">
          ${player.discardPile.slice(-6).map((t: string) => `<span style="display: inline-block; margin: 2px; background: rgba(255,255,255,0.2); padding: 4px 6px; border-radius: 4px; font-size: 0.8em;">${tileDisplay[t] || t}</span>`).join('')}
        </div>
      </div>
    `
  }

  return `
    <div style="background: rgba(255, 255, 255, 0.1); border: ${borderWidth} solid ${borderColor}; border-radius: 8px; padding: 15px; color: white; flex: 1; min-width: 200px;">
      <h4 style="margin: 0 0 10px 0; color: ${isCurrentPlayer ? '#4CAF50' : '#FFD700'};">${player.name} ${isCurrentPlayer ? '👈' : ''}</h4>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.9em;">
        <span>🃏 ${player.hand.length} 張</span>
        ${player.melds && player.melds.length > 0 ? `<span>📦 ${player.melds.length} 組</span>` : ''}
        <span>💰 ${player.score}</span>
      </div>
      <div style="background: rgba(0, 0, 0, 0.3); padding: 8px; border-radius: 6px; min-height: 40px; display: flex; flex-wrap: wrap; gap: 4px;">
        ${player.discardPile.slice(-12).map((t: string) => `
          <span style="background: rgba(255,255,255,0.2); padding: 4px 6px; border-radius: 4px; font-size: 0.8em;">
            ${tileDisplay[t] || t}
          </span>
        `).join('')}
      </div>
    </div>
  `
}

function renderPlayerHand(hand: string[], canDiscard: boolean) {
  return hand.map((tile, idx) => {
    const disabled = !canDiscard
    const opacity = disabled ? '0.5' : '1'
    const cursor = disabled ? 'not-allowed' : 'pointer'
    
    return `
      <button 
        onclick="${disabled ? '' : `selectTile(${idx})`}" 
        style="
          padding: 12px 16px;
          background: linear-gradient(to bottom, #FFFFFF, #E8E8E8);
          border: 3px solid #333;
          border-radius: 8px;
          cursor: ${cursor};
          font-weight: bold;
          font-size: 1em;
          min-width: 70px;
          text-align: center;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          transition: transform 0.1s, box-shadow 0.1s;
          opacity: ${opacity};
        "
        ${disabled ? 'disabled' : ''}
        onmouseover="${disabled ? '' : "this.style.transform='translateY(-4px)'; this.style.boxShadow='0 6px 12px rgba(0,0,0,0.3)';"}"
        onmouseout="${disabled ? '' : "this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.2)';"}">
        ${tileDisplay[tile] || tile}
      </button>
    `
  }).join('')
}

function selectTile(idx: number) {
  if (!gameController) {
    console.warn('游戏控制器未初始化')
    return
  }
  
  // 玩家出牌
  gameController.playerDiscard(idx)
}

function playerResponse(action: string) {
  if (!gameController) {
    console.warn('游戏控制器未初始化')
    return
  }
  
  // 如果是吃牌，需要选择组合
  if (action === 'chow' && gameState.lastDiscardedTile) {
    const chowOptions = gameController.getChowOptions(0, gameState.lastDiscardedTile)
    
    if (chowOptions.length === 0) {
      alert('无法吃牌')
      return
    }
    
    // 如果有多个选项，让玩家选择
    if (chowOptions.length > 1) {
      const optionTexts = chowOptions.map((tiles, idx) => 
        `${idx + 1}. ${tiles.map(t => tileDisplay[t] || t).join(' ')}`
      ).join('\n')
      
      const choice = prompt(`請選擇吃牌組合：\n${optionTexts}\n\n輸入數字 (1-${chowOptions.length}):`)
      const choiceIdx = parseInt(choice || '1') - 1
      
      if (choiceIdx >= 0 && choiceIdx < chowOptions.length) {
        gameController.playerResponse('chow', chowOptions[choiceIdx])
      }
    } else {
      gameController.playerResponse('chow', chowOptions[0])
    }
  } else {
    gameController.playerResponse(action as any)
  }
}

// 全局函數
Object.assign(window, {
  showMenu,
  startGame,
  showRules,
  selectTile,
  playerResponse,
})

// 啟動應用
init()
