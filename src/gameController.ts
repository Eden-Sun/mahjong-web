// 游戏控制器和状态机

import { GameState, GamePhase, PlayerAction, ResponseAction, sortHand } from './gameState'
import { 
  canPong, 
  canKong, 
  canChow, 
  checkWin,
  executePong,
  executeKong,
  executeChow,
  canConcealedKong,
  executeConcealedKong,
} from './actionChecker'
import { getAIResponse, getAIDiscard, checkAISelfWin } from './aiLogic'
import { GameEngine } from './wasm'

/**
 * 游戏控制器
 * 负责管理游戏状态转移和流程控制
 */
export class GameController {
  private state: GameState
  private onStateChange?: (state: GameState) => void
  
  constructor(state: GameState, onStateChange?: (state: GameState) => void) {
    this.state = state
    this.onStateChange = onStateChange
  }
  
  /**
   * 获取当前游戏状态
   */
  getState(): GameState {
    return this.state
  }
  
  /**
   * 更新状态并触发回调
   */
  private updateState() {
    if (this.onStateChange) {
      this.onStateChange(this.state)
    }
  }
  
  /**
   * 检查玩家是否可以出牌
   */
  canPlayerDiscard(): boolean {
    return (
      this.state.gamePhase === 'discard' &&
      this.state.currentPlayerIdx === 0 &&
      this.state.players[0].hand.length > 0 &&
      !this.state.waitingForResponse
    )
  }
  
  /**
   * 开始新回合 - 当前玩家摸牌
   */
  async playerDraw(): Promise<void> {
    if (this.state.gamePhase !== 'draw') {
      console.warn('不在摸牌阶段')
      return
    }
    
    const currentPlayer = this.state.players[this.state.currentPlayerIdx]
    
    // 检查牌堆是否还有牌
    if (this.state.tileCount <= 0) {
      console.log('牌堆已空，流局')
      this.state.gamePhase = 'end'
      this.updateState()
      return
    }
    
    // 从 WASM 摸牌
    const result = GameEngine.drawTile() as any
    if (result && result.tile) {
      currentPlayer.hand.push(result.tile)
      currentPlayer.hand = sortHand(currentPlayer.hand)
      this.state.tileCount = result.remaining || 0
      
      console.log(`${currentPlayer.name} 摸牌: ${result.tile}`)
      
      // 检查自摸和牌
      if (!currentPlayer.isHuman) {
        if (checkAISelfWin(currentPlayer)) {
          console.log(`${currentPlayer.name} 自摸！`)
          this.state.gamePhase = 'end'
          this.updateState()
          return
        }
      }
      
      // 进入出牌阶段
      this.state.gamePhase = 'discard'
      this.updateState()
      
      // 如果是 AI 玩家，自动出牌
      if (!currentPlayer.isHuman) {
        await this.delay(800)  // 延迟一下让玩家看到
        await this.aiDiscard()
      }
    }
  }
  
  /**
   * 玩家出牌
   */
  async playerDiscard(tileIdx: number): Promise<void> {
    if (!this.canPlayerDiscard()) {
      console.warn('当前不能出牌')
      return
    }
    
    const player = this.state.players[0]
    
    if (tileIdx < 0 || tileIdx >= player.hand.length) {
      console.warn('无效的牌索引')
      return
    }
    
    // 出牌
    const tile = player.hand[tileIdx]
    player.hand.splice(tileIdx, 1)
    player.discardPile.push(tile)
    
    this.state.lastDiscardedTile = tile
    this.state.lastDiscardPlayer = this.state.currentPlayerIdx
    
    console.log(`${player.name} 出牌: ${tile}`)
    
    // 进入响应阶段
    this.state.gamePhase = 'response'
    this.state.waitingForResponse = true
    this.updateState()
    
    // 检查其他玩家的响应
    await this.checkOthersResponse()
  }
  
  /**
   * AI 出牌
   */
  private async aiDiscard(): Promise<void> {
    const currentPlayer = this.state.players[this.state.currentPlayerIdx]
    
    if (currentPlayer.hand.length === 0) {
      console.warn('AI 手牌为空')
      return
    }
    
    // AI 选择要出的牌
    const discardIdx = getAIDiscard(currentPlayer.hand)
    const tile = currentPlayer.hand[discardIdx]
    
    currentPlayer.hand.splice(discardIdx, 1)
    currentPlayer.discardPile.push(tile)
    
    this.state.lastDiscardedTile = tile
    this.state.lastDiscardPlayer = this.state.currentPlayerIdx
    
    console.log(`${currentPlayer.name} 出牌: ${tile}`)
    
    // 进入响应阶段
    this.state.gamePhase = 'response'
    this.state.waitingForResponse = true
    this.updateState()
    
    // 检查其他玩家的响应
    await this.delay(500)
    await this.checkOthersResponse()
  }
  
  /**
   * 检查其他玩家的响应（吃碰杠和）
   */
  private async checkOthersResponse(): Promise<void> {
    if (!this.state.lastDiscardedTile || this.state.lastDiscardPlayer === null) {
      return
    }
    
    const tile = this.state.lastDiscardedTile
    const discardPlayerIdx = this.state.lastDiscardPlayer
    
    // 收集所有玩家的响应
    const responses: ResponseAction[] = []
    
    // 检查其他 3 个玩家
    for (let i = 1; i <= 3; i++) {
      const playerIdx = (discardPlayerIdx + i) % 4
      const player = this.state.players[playerIdx]
      
      if (player.isHuman) {
        // 人类玩家 - 检查可用动作
        const actions = this.getAvailableActions(playerIdx, tile, i === 1)
        if (actions.length > 0) {
          player.canAction = true
          // 等待玩家选择（通过 UI）
          // 这里不做处理，等待 playerResponse 调用
          this.updateState()
          return
        }
      } else {
        // AI 玩家 - 自动决策
        const response = getAIResponse(player, tile, i === 1)
        if (response.action !== 'pass') {
          responses.push({
            playerIdx,
            action: response.action,
            tiles: response.tiles,
          })
        }
      }
    }
    
    // 处理响应（按优先级）
    if (responses.length > 0) {
      await this.executeResponse(responses)
    } else {
      // 没有人响应，进入下一轮
      await this.nextPlayer()
    }
  }
  
  /**
   * 获取玩家可用的动作
   */
  getAvailableActions(playerIdx: number, tile: string, isNextPlayer: boolean): PlayerAction[] {
    const player = this.state.players[playerIdx]
    const actions: PlayerAction[] = []
    
    // 检查和牌
    const winCheck = checkWin(player.hand, player.melds, tile)
    if (winCheck.canWin) {
      actions.push('win')
    }
    
    // 检查杠
    if (canKong(player.hand, tile)) {
      actions.push('kong')
    }
    
    // 检查碰
    if (canPong(player.hand, tile)) {
      actions.push('pong')
    }
    
    // 检查吃（只有下家）
    if (isNextPlayer) {
      const chowOptions = canChow(player.hand, tile)
      if (chowOptions.length > 0) {
        actions.push('chow')
      }
    }
    
    return actions
  }
  
  /**
   * 玩家响应（吃碰杠和或过）
   */
  async playerResponse(action: PlayerAction, tiles?: string[]): Promise<void> {
    const player = this.state.players[0]
    
    if (!player.canAction) {
      console.warn('当前玩家没有响应权')
      return
    }
    
    player.canAction = false
    
    if (action === 'pass') {
      // 继续检查其他玩家或进入下一轮
      await this.checkOthersResponse()
      return
    }
    
    // 执行响应动作
    await this.executeResponse([{
      playerIdx: 0,
      action,
      tiles,
    }])
  }
  
  /**
   * 执行响应动作
   * 按优先级处理：和 > 杠 > 碰 > 吃
   */
  private async executeResponse(responses: ResponseAction[]): Promise<void> {
    // 按优先级排序
    const priority: { [key in PlayerAction]: number } = {
      'win': 4,
      'kong': 3,
      'pong': 2,
      'chow': 1,
      'pass': 0,
    }
    
    responses.sort((a, b) => priority[b.action] - priority[a.action])
    
    const chosen = responses[0]
    const player = this.state.players[chosen.playerIdx]
    const tile = this.state.lastDiscardedTile!
    
    console.log(`${player.name} 响应: ${chosen.action}`)
    
    // 从出牌玩家的弃牌堆中移除最后一张牌
    if (this.state.lastDiscardPlayer !== null) {
      const discardPlayer = this.state.players[this.state.lastDiscardPlayer]
      discardPlayer.discardPile.pop()
    }
    
    switch (chosen.action) {
      case 'win':
        console.log(`${player.name} 和牌！`)
        this.state.gamePhase = 'end'
        this.updateState()
        break
        
      case 'kong':
        executeKong(player, tile)
        player.hand = sortHand(player.hand)
        
        // 杠后补花（再摸一张）
        const result = GameEngine.drawTile() as any
        if (result && result.tile) {
          player.hand.push(result.tile)
          player.hand = sortHand(player.hand)
          this.state.tileCount = result.remaining || 0
        }
        
        // 该玩家继续出牌
        this.state.currentPlayerIdx = chosen.playerIdx
        this.state.gamePhase = 'discard'
        this.state.waitingForResponse = false
        this.updateState()
        
        // 如果是 AI，自动出牌
        if (!player.isHuman) {
          await this.delay(800)
          await this.aiDiscard()
        }
        break
        
      case 'pong':
        executePong(player, tile)
        player.hand = sortHand(player.hand)
        
        // 该玩家继续出牌
        this.state.currentPlayerIdx = chosen.playerIdx
        this.state.gamePhase = 'discard'
        this.state.waitingForResponse = false
        this.updateState()
        
        // 如果是 AI，自动出牌
        if (!player.isHuman) {
          await this.delay(800)
          await this.aiDiscard()
        }
        break
        
      case 'chow':
        if (chosen.tiles) {
          executeChow(player, chosen.tiles)
          player.hand = sortHand(player.hand)
          
          // 该玩家继续出牌
          this.state.currentPlayerIdx = chosen.playerIdx
          this.state.gamePhase = 'discard'
          this.state.waitingForResponse = false
          this.updateState()
          
          // 如果是 AI，自动出牌
          if (!player.isHuman) {
            await this.delay(800)
            await this.aiDiscard()
          }
        }
        break
    }
  }
  
  /**
   * 进入下一位玩家的回合
   */
  private async nextPlayer(): Promise<void> {
    this.state.currentPlayerIdx = (this.state.currentPlayerIdx + 1) % 4
    this.state.gamePhase = 'draw'
    this.state.waitingForResponse = false
    this.state.lastDiscardedTile = null
    this.state.lastDiscardPlayer = null
    
    this.updateState()
    
    // 自动开始下一轮
    await this.delay(500)
    await this.playerDraw()
  }
  
  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * 获取吃牌选项
   */
  getChowOptions(playerIdx: number, tile: string): string[][] {
    const player = this.state.players[playerIdx]
    return canChow(player.hand, tile)
  }
}
