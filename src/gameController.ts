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
  canAddKong,
  executeAddKong,
} from './actionChecker'
import { checkWin as checkWinNew, WinResult, WinContext } from './winChecker'
import { getAIResponse, getAIDiscard } from './aiLogic'
import { GameEngine } from './wasm'

/**
 * 游戏控制器
 * 负责管理游戏状态转移和流程控制
 */
export class GameController {
  private state: GameState
  private onStateChange?: (state: GameState) => void
  private drawnTile: string | null = null        // 新摸的牌
  private canWinAfterDraw: boolean = false        // 摸牌后是否可以和
  private winResultAfterDraw: WinResult | null = null  // 摸牌后的和牌结果
  private availableKongs: string[] = []           // 摸牌後可加槓/暗槓的牌
  
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
   * 摸牌後可加槓/暗槓的牌（加槓用 addKong，暗槓用 concealedKong）
   */
  getAvailableKongs(): string[] {
    return this.availableKongs
  }

  /**
   * 玩家執行加槓（自己回合中）
   */
  async playerAddKong(tile: string): Promise<void> {
    const player = this.state.players[0]
    if (!executeAddKong(player, tile)) return

    player.hand = sortHand(player.hand)
    await this._afterSelfKong(0, true)
  }

  /**
   * 玩家執行暗槓（自己回合中）
   */
  async playerConcealedKong(tile: string): Promise<void> {
    const player = this.state.players[0]
    if (!executeConcealedKong(player, tile)) return

    player.hand = sortHand(player.hand)
    await this._afterSelfKong(0, false)
  }

  /**
   * 自己回合中槓牌後補牌共用邏輯
   * @param playerIdx  執行槓的玩家
   * @param isAddKong  是加槓（true）還是暗槓（false）
   */
  private async _afterSelfKong(playerIdx: number, isAddKong: boolean): Promise<void> {
    const player = this.state.players[playerIdx]

    // 加槓時讓其他玩家有搶槓機會（只有加槓才能搶槓，暗槓不能搶）
    if (isAddKong) {
      const tile = player.melds[player.melds.length - 1].tiles[0]
      const robbers: Array<{ playerIdx: number; action: 'win'; winResult: ReturnType<typeof checkWinNew> }> = []

      for (let i = 1; i <= 3; i++) {
        const otherIdx = (playerIdx + i) % 4
        const other = this.state.players[otherIdx]
        const winCheck = checkWinNew(other.hand, other.melds, undefined, tile,
          this.buildWinContext(otherIdx, { isRobKong: true }))
        if (winCheck.canWin) {
          if (other.isHuman) {
            // 玩家搶槓功能留待後續實作（目前讓 AI 優先搶槓）
          } else {
            robbers.push({ playerIdx: otherIdx, action: 'win', winResult: winCheck })
          }
        }
      }

      if (robbers.length > 0) {
        const { playerIdx: robberIdx, winResult: robberWin } = robbers[0]
        this.state.winner = robberIdx
        this.state.winResult = {
          fans: robberWin.fans,
          pattern: robberWin.pattern,
          winType: '搶槓',
        }
        this.state.gamePhase = 'end'
        this.updateState()
        return
      }
    }

    // 補牌
    const drawResult = GameEngine.drawTile() as any
    if (!drawResult?.tile) {
      this.state.gamePhase = 'end'
      this.updateState()
      return
    }

    const drawnTile = drawResult.tile
    player.hand.push(drawnTile)
    player.hand = sortHand(player.hand)
    this.state.tileCount = drawResult.remaining || 0

    // 槓上開花檢查
    const winResult = checkWinNew(
      player.hand, player.melds, drawnTile, undefined,
      this.buildWinContext(playerIdx, { isKongDraw: true })
    )

    if (winResult.canWin) {
      if (player.isHuman) {
        this.drawnTile = drawnTile
        this.canWinAfterDraw = true
        this.winResultAfterDraw = winResult
        this.availableKongs = []
      } else {
        this.state.winner = playerIdx
        this.state.winResult = {
          fans: winResult.fans,
          pattern: winResult.pattern,
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
      // 補牌後再次檢查是否可再次加槓/暗槓
      this.availableKongs = [
        ...canAddKong(player.hand, player.melds),
        ...canConcealedKong(player.hand),
      ]
    }

    this.state.currentPlayerIdx = playerIdx
    this.state.gamePhase = 'discard'
    this.state.waitingForResponse = false
    this.state.players.forEach(p => { p.canAction = false })
    this.updateState()

    if (!player.isHuman) {
      await this.delay(800)
      await this.aiDiscard()
    }
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
      this.state.gamePhase = 'end'
      this.updateState()
      return
    }

    // 从 WASM 摸牌
    const result = GameEngine.drawTile() as any
    if (result && result.tile) {
      const tile = result.tile

      this.drawnTile = tile

      // 检查自摸和牌（传入新牌，hand 还未加入该牌）
      const winResult = checkWinNew(currentPlayer.hand, currentPlayer.melds, tile, undefined,
        this.buildWinContext(this.state.currentPlayerIdx, { isKongDraw: false }))

      // 检查成功后再加牌
      currentPlayer.hand.push(tile)
      currentPlayer.hand = sortHand(currentPlayer.hand)
      this.state.tileCount = result.remaining || 0

      if (winResult.canWin) {
        if (currentPlayer.isHuman) {
          this.canWinAfterDraw = true
          this.winResultAfterDraw = winResult
        } else {
          this.state.winner = this.state.currentPlayerIdx
          this.state.winResult = {
            fans: winResult.fans,
            pattern: winResult.pattern,
            winType: '自摸',
          }
          this.state.gamePhase = 'end'
          this.updateState()
          return
        }
      } else {
        this.canWinAfterDraw = false
        this.winResultAfterDraw = null
      }

      // 摸牌後檢查加槓/暗槓
      if (currentPlayer.isHuman) {
        this.availableKongs = [
          ...canAddKong(currentPlayer.hand, currentPlayer.melds),
          ...canConcealedKong(currentPlayer.hand),
        ]
      } else {
        // AI 考慮加槓/暗槓（簡單策略：有就槓）
        const addKongs = canAddKong(currentPlayer.hand, currentPlayer.melds)
        const concKongs = canConcealedKong(currentPlayer.hand)
        if (addKongs.length > 0 && !winResult.canWin) {
          executeAddKong(currentPlayer, addKongs[0])
          currentPlayer.hand = sortHand(currentPlayer.hand)
          await this._afterSelfKong(this.state.currentPlayerIdx, true)
          return
        } else if (concKongs.length > 0 && !winResult.canWin) {
          executeConcealedKong(currentPlayer, concKongs[0])
          currentPlayer.hand = sortHand(currentPlayer.hand)
          await this._afterSelfKong(this.state.currentPlayerIdx, false)
          return
        }
        this.availableKongs = []
      }

      // 进入出牌阶段
      this.state.gamePhase = 'discard'
      this.updateState()

      // 如果是 AI 玩家，自动出牌
      if (!currentPlayer.isHuman) {
        await this.delay(800)
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
      
      if (excludePlayer !== undefined && playerIdx === excludePlayer) continue

      const player = this.state.players[playerIdx]
      const isNextPlayer = (i === 1)  // 下家（右邊）才能吃，且不能槓上家牌

      if (player.isHuman) {
        const actions = this.getAvailableActions(playerIdx, tile, isNextPlayer)
        if (actions.length > 0) {
          player.canAction = true
          this.updateState()
          return
        }
      } else {
        const response = getAIResponse(player, tile, isNextPlayer)
        if (response.action !== 'pass') {
          responses.push({ playerIdx, action: response.action, tiles: response.tiles })
        }
      }
    }

    if (responses.length > 0) {
      await this.executeResponse(responses)
    } else {
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
    
    if (!player.canAction) return

    player.canAction = false

    if (action === 'pass') {
      await this.checkOthersResponse(0)
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
      case 'win': {
        const winCheckResult = checkWinNew(player.hand, player.melds, undefined, tile,
          this.buildWinContext(chosen.playerIdx))
        // 點胡：把打出的牌加入手牌（用於顯示）
        player.hand.push(tile)
        player.hand = sortHand(player.hand)
        this.state.winner = chosen.playerIdx
        this.state.winResult = {
          fans: winCheckResult.fans,
          pattern: winCheckResult.pattern,
          winType: '點胡',
        }
        this.state.gamePhase = 'end'
        this.updateState()
        break
      }

      case 'kong': {
        executeKong(player, tile)
        player.hand = sortHand(player.hand)

        // 明槓後補牌
        const kongDrawResult = GameEngine.drawTile() as any
        if (kongDrawResult && kongDrawResult.tile) {
          const drawnTile = kongDrawResult.tile
          
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
            // 明槓補牌後，再次檢查是否可繼續加槓/暗槓
            this.availableKongs = [
              ...canAddKong(player.hand, player.melds),
              ...canConcealedKong(player.hand),
            ]
          }
        }
        
        this.state.currentPlayerIdx = chosen.playerIdx
        this.state.gamePhase = 'discard'
        this.state.waitingForResponse = false
        this.state.players.forEach(p => { p.canAction = false })
        this.updateState()
        if (!player.isHuman) {
          await this.delay(800)
          await this.aiDiscard()
        }
        break
      }

      case 'pong':
        executePong(player, tile)
        player.hand = sortHand(player.hand)
        this.state.currentPlayerIdx = chosen.playerIdx
        this.state.gamePhase = 'discard'
        this.state.waitingForResponse = false
        this.state.players.forEach(p => { p.canAction = false })
        this.updateState()
        await this.delay(100)
        if (!player.isHuman) {
          await this.delay(800)
          await this.aiDiscard()
        }
        break

      case 'chow':
        if (!chosen.tiles) break
        if (!executeChow(player, chosen.tiles, tile)) {
          player.canAction = true
          this.updateState()
          break
        }
        player.hand = sortHand(player.hand)
        this.state.currentPlayerIdx = chosen.playerIdx
        this.state.gamePhase = 'discard'
        this.state.waitingForResponse = false
        this.state.players.forEach(p => { p.canAction = false })
        this.updateState()
        await this.delay(100)
        if (!player.isHuman) {
          await this.delay(800)
          await this.aiDiscard()
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
    this.availableKongs = []
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
