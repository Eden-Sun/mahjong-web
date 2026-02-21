// 游戏控制器和状态机

import { GameState, GamePhase, PlayerAction, ResponseAction, sortHand } from './gameState'
import { 
  canPong, 
  canKong, 
  canChow, 
  executePong,
  executeKong,
  executeChow,
  canConcealedKong,
  executeConcealedKong,
} from './actionChecker'
import { checkWin as checkWinNew, WinResult, WinContext } from './winChecker'
import { getAIResponse, getAIDiscard, checkAISelfWin } from './aiLogic'
import { GameEngine } from './wasm'

/**
 * 游戏控制器
 * 负责管理游戏状态转移和流程控制
 */
export class GameController {
  private state: GameState
  private onStateChange?: (state: GameState) => void
  private drawnTile: string | null = null  // 新摸的牌
  private canWinAfterDraw: boolean = false  // 摸牌后是否可以和
  private winResultAfterDraw: WinResult | null = null  // 摸牌后的和牌结果
  
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
   * 获取新摸的牌
   */
  getDrawnTile(): string | null {
    return this.drawnTile
  }
  
  /**
   * 获取摸牌后是否可以和
   */
  getCanWinAfterDraw(): boolean {
    return this.canWinAfterDraw
  }
  
  /**
   * 获取摸牌后的和牌结果
   */
  getWinResultAfterDraw(): WinResult | null {
    return this.winResultAfterDraw
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
    const result = (
      this.state.gamePhase === 'discard' &&
      this.state.currentPlayerIdx === 0 &&
      this.state.players[0].hand.length > 0 &&
      !this.state.waitingForResponse
    )
    console.log('🔍 canPlayerDiscard:', {
      result,
      gamePhase: this.state.gamePhase,
      currentPlayerIdx: this.state.currentPlayerIdx,
      handLength: this.state.players[0].hand.length,
      waitingForResponse: this.state.waitingForResponse,
      canAction: this.state.players[0].canAction
    })
    return result
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
      const tile = result.tile
      
      console.log(`${currentPlayer.name} 摸牌: ${tile}`)
      
      // 保存新摸的牌
      this.drawnTile = tile
      
      // 检查自摸和牌（传入新牌，hand 还未加入该牌）
      const winResult = checkWinNew(currentPlayer.hand, currentPlayer.melds, tile, undefined,
        this.buildWinContext(this.state.currentPlayerIdx, { isKongDraw: false }))
      
      // 检查成功后再加牌
      currentPlayer.hand.push(tile)
      currentPlayer.hand = sortHand(currentPlayer.hand)
      this.state.tileCount = result.remaining || 0
      
      if (winResult.canWin) {
        console.log(`${currentPlayer.name} 可以自摸！番数: ${winResult.fans}, 牌型: ${winResult.pattern}`)
        
        if (currentPlayer.isHuman) {
          // 人类玩家 - 保存和牌信息，等待玩家选择
          this.canWinAfterDraw = true
          this.winResultAfterDraw = winResult
        } else {
          // AI 玩家 - 自动和牌
          console.log(`🏆 ${currentPlayer.name} 自摸！番数: ${winResult.fans}, 牌型: ${winResult.pattern}`)
          
          // 保存贏家信息
          this.state.winner = this.state.currentPlayerIdx
          this.state.winResult = {
            fans: winResult.fans,
            pattern: winResult.pattern,
            winType: '自摸'
          }
          
          this.state.gamePhase = 'end'
          this.updateState()
          return
        }
      } else {
        this.canWinAfterDraw = false
        this.winResultAfterDraw = null
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
    
    // 更新統一捨牌池：先將舊的當下牌改為 false
    this.state.discardPool.forEach(d => d.isCurrentTile = false)
    // 加入新的當下牌（帶唯一 ID）
    this.state.discardPool.push({
      tile,
      player: this.state.currentPlayerIdx,
      timestamp: Date.now(),
      isCurrentTile: true,
      id: `discard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    })
    
    console.log(`${player.name} 出牌: ${tile}`)
    
    // 清除摸牌状态
    this.drawnTile = null
    this.canWinAfterDraw = false
    this.winResultAfterDraw = null
    
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
    
    // 更新統一捨牌池：先將舊的當下牌改為 false
    this.state.discardPool.forEach(d => d.isCurrentTile = false)
    // 加入新的當下牌（帶唯一 ID）
    this.state.discardPool.push({
      tile,
      player: this.state.currentPlayerIdx,
      timestamp: Date.now(),
      isCurrentTile: true,
      id: `discard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    })
    
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
  private async checkOthersResponse(excludePlayer?: number): Promise<void> {
    if (!this.state.lastDiscardedTile || this.state.lastDiscardPlayer === null) {
      return
    }
    
    const tile = this.state.lastDiscardedTile
    const discardPlayerIdx = this.state.lastDiscardPlayer
    
    // 收集所有玩家的响应
    const responses: ResponseAction[] = []
    
    // 檢查其他 3 個玩家（逆時針順序）
    // 逆時針：0→1→2→3→0，下家 = +1，對家 = +2，上家 = +3
    // i=1 → 下家（右邊，可以吃、不能槓上家牌）
    // i=2 → 對家
    // i=3 → 上家（左邊）
    for (let i = 1; i <= 3; i++) {
      const playerIdx = (discardPlayerIdx + i) % 4
      
      // 跳過已經響應過的玩家
      if (excludePlayer !== undefined && playerIdx === excludePlayer) {
        console.log(`跳過玩家 ${playerIdx}（已選擇「過」）`)
        continue
      }
      
      const player = this.state.players[playerIdx]
      const isNextPlayer = (i === 1)  // 下家（右邊）才能吃，且不能槓上家牌
      
      if (player.isHuman) {
        // 人类玩家 - 检查可用动作
        const actions = this.getAvailableActions(playerIdx, tile, isNextPlayer)
        if (actions.length > 0) {
          player.canAction = true
          // 等待玩家选择（通过 UI）
          // 这里不做处理，等待 playerResponse 调用
          console.log(`等待玩家 ${playerIdx} 響應`)
          this.updateState()
          return
        }
      } else {
        // AI 玩家 - 自动决策
        const response = getAIResponse(player, tile, isNextPlayer)
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
      console.log('所有玩家都選擇「過」，進入下一輪')
      await this.nextPlayer()
    }
  }
  
  /**
   * 获取玩家可用的动作
   */
  getAvailableActions(playerIdx: number, tile: string, isNextPlayer: boolean): PlayerAction[] {
    const player = this.state.players[playerIdx]
    const actions: PlayerAction[] = []
    
    // 检查和牌（点和）
    const winCheck = checkWinNew(player.hand, player.melds, undefined, tile,
      this.buildWinContext(playerIdx))
    if (winCheck.canWin) {
      actions.push('win')
    }
    
    // 检查槓（上家牌不能大明槓，只有非下家方向才可以）
    if (canKong(player.hand, tile) && !isNextPlayer) {
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
    
    console.log('🎯 gameController.playerResponse 被調用:', { 
      action, 
      tiles, 
      canAction: player.canAction,
      lastDiscardedTile: this.state.lastDiscardedTile,
      手牌: player.hand
    })
    
    if (!player.canAction) {
      console.warn('❌ 当前玩家没有响应权 (canAction = false)')
      return
    }
    
    player.canAction = false
    
    if (action === 'pass') {
      console.log('玩家選擇「過」，繼續檢查其他 AI 玩家')
      // 繼續檢查其他玩家（排除玩家0）
      await this.checkOthersResponse(0)
      return
    }
    
    console.log('📤 準備執行響應動作:', { playerIdx: 0, action, tiles })
    
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
      
      // 從統一捨牌池中標記該牌被吃/碰/杠
      const lastDiscard = this.state.discardPool.find(d => d.isCurrentTile)
      if (lastDiscard) {
        lastDiscard.claimedBy = chosen.playerIdx
        lastDiscard.claimType = chosen.action as any
        lastDiscard.isCurrentTile = false
      }
    }
    
    switch (chosen.action) {
      case 'win':
        // 重新檢查胡牌結果
        const winCheckResult = checkWinNew(player.hand, player.melds, undefined, tile,
          this.buildWinContext(chosen.playerIdx))
        console.log(`🏆 ${player.name} 胡牌！番数: ${winCheckResult.fans}, 牌型: ${winCheckResult.pattern}`)
        
        // 點胡：把打出的牌加入手牌（用於顯示）
        player.hand.push(tile)
        player.hand = sortHand(player.hand)
        console.log(`📋 點胡後手牌: ${player.hand.length} 張`)
        
        // 保存贏家信息
        this.state.winner = chosen.playerIdx
        this.state.winResult = {
          fans: winCheckResult.fans,
          pattern: winCheckResult.pattern,
          winType: '點胡'
        }
        
        this.state.gamePhase = 'end'
        this.updateState()
        break
        
      case 'kong':
        console.log('🔶 執行明槓:', { 玩家: player.name, 目標牌: tile, 手牌Before: player.hand.length })
        
        executeKong(player, tile)
        player.hand = sortHand(player.hand)
        
        console.log('🔶 明槓完成，手牌After:', player.hand.length, '準備補牌...')
        
        // 明槓後補牌（從牌堆尾端摸一張）
        const kongDrawResult = GameEngine.drawTile() as any
        if (kongDrawResult && kongDrawResult.tile) {
          const drawnTile = kongDrawResult.tile
          console.log('🔶 補牌:', drawnTile)
          
          // 加入手牌
          player.hand.push(drawnTile)
          player.hand = sortHand(player.hand)
          this.state.tileCount = kongDrawResult.remaining || 0
          
          // 明槓補牌後檢查槓上開花
          const kongWinResult = checkWinNew(
            player.hand, player.melds, drawnTile, undefined,
            this.buildWinContext(chosen.playerIdx, { isKongDraw: true })
          )

          if (kongWinResult.canWin) {
            if (player.isHuman) {
              this.drawnTile = drawnTile
              this.canWinAfterDraw = true
              this.winResultAfterDraw = kongWinResult
            } else {
              // AI 槓上開花
              this.state.winner = chosen.playerIdx
              this.state.winResult = {
                fans: kongWinResult.fans,
                pattern: kongWinResult.pattern,
                winType: '槓上開花',
              }
              this.state.gamePhase = 'end'
              this.updateState()
              return
            }
          } else if (player.isHuman) {
            this.drawnTile = drawnTile
            this.canWinAfterDraw = false
            this.winResultAfterDraw = null
          }
        }
        
        // 該玩家繼續出牌
        this.state.currentPlayerIdx = chosen.playerIdx
        this.state.gamePhase = 'discard'
        this.state.waitingForResponse = false
        
        // 清除所有玩家的響應權
        this.state.players.forEach(p => { p.canAction = false })
        
        console.log('🔶 進入出牌階段:', {
          currentPlayerIdx: this.state.currentPlayerIdx,
          gamePhase: this.state.gamePhase,
          isHuman: player.isHuman,
          handLength: player.hand.length
        })
        
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
        
        // 清除所有玩家的響應權
        this.state.players.forEach(p => { p.canAction = false })
        
        console.log('✅ 碰牌完成，狀態已更新:', {
          currentPlayerIdx: this.state.currentPlayerIdx,
          gamePhase: this.state.gamePhase,
          waitingForResponse: this.state.waitingForResponse,
          isHuman: player.isHuman,
          handLength: player.hand.length
        })
        
        this.updateState()
        
        // 強制等待一幀，確保 UI 更新
        await this.delay(100)
        
        console.log('🎯 碰牌後 canPlayerDiscard:', this.canPlayerDiscard())
        
        // 如果是 AI，自动出牌
        if (!player.isHuman) {
          await this.delay(800)
          await this.aiDiscard()
        }
        break
        
      case 'chow':
        console.log('🍴 開始執行吃牌:', { 
          玩家: player.name,
          tiles: chosen.tiles, 
          目標牌: tile,
          手牌Before: [...player.hand]
        })
        
        if (chosen.tiles) {
          const success = executeChow(player, chosen.tiles, tile)
          console.log('🍴 executeChow 結果:', { success, 手牌After: [...player.hand] })
          
          if (!success) {
            console.error('❌ 吃牌執行失敗！')
            // 恢復 canAction 讓玩家可以重新選擇
            player.canAction = true
            this.updateState()
            break
          }
          
          player.hand = sortHand(player.hand)
          
          // 该玩家继续出牌
          this.state.currentPlayerIdx = chosen.playerIdx
          this.state.gamePhase = 'discard'
          this.state.waitingForResponse = false
          
          // 清除所有玩家的響應權
          this.state.players.forEach(p => { p.canAction = false })
          
          console.log('✅ 吃牌完成，狀態已更新:', {
            currentPlayerIdx: this.state.currentPlayerIdx,
            gamePhase: this.state.gamePhase,
            waitingForResponse: this.state.waitingForResponse,
            isHuman: player.isHuman,
            handLength: player.hand.length,
            melds: player.melds
          })
          
          this.updateState()
          
          // 強制等待一幀，確保 UI 更新
          await this.delay(100)
          
          console.log('🎯 吃牌後 canPlayerDiscard:', this.canPlayerDiscard(), '手牌數:', player.hand.length)
          
          // 如果是 AI，自动出牌
          if (!player.isHuman) {
            await this.delay(800)
            await this.aiDiscard()
          }
        } else {
          console.error('❌ 吃牌失敗：沒有提供 tiles 參數')
        }
        break
    }
  }
  
  /**
   * 进入下一位玩家的回合（逆時針：0→1→2→3→0）
   * 下家 = +1，上家 = +3
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
  /** 建立胡牌 context（風牌、莊家、最後一張等） */
  private buildWinContext(playerIdx: number, options: Partial<WinContext> = {}): WinContext {
    const winds: string[] = ['E', 'S', 'W', 'N']
    return {
      isDealer: playerIdx === 0,          // 東家 = 莊家（簡化）
      seatWind: winds[playerIdx] ?? 'E',
      roundWind: 'E',                     // 第一圈東風
      isLastTile: this.state.tileCount === 0,
      isKongDraw: false,
      isRobKong: false,
      ...options,
    }
  }

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
  
  /**
   * 玩家放棄自摸胡牌，繼續出牌
   */
  clearWinState(): void {
    this.canWinAfterDraw = false
    this.winResultAfterDraw = null
    this.updateState()
  }

  /**
   * 玩家自摸和牌
   */
  async playerWin(): Promise<void> {
    if (!this.canWinAfterDraw || !this.winResultAfterDraw) {
      console.warn('当前不能和牌')
      return
    }
    
    const player = this.state.players[0]
    console.log(`🏆 ${player.name} 自摸！番数: ${this.winResultAfterDraw.fans}, 牌型: ${this.winResultAfterDraw.pattern}`)
    
    // 保存贏家信息
    this.state.winner = 0
    this.state.winResult = {
      fans: this.winResultAfterDraw.fans,
      pattern: this.winResultAfterDraw.pattern,
      winType: '自摸'
    }
    
    // 游戏结束
    this.state.gamePhase = 'end'
    this.updateState()
  }
}
