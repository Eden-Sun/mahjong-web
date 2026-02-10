// 游戏状态管理

/**
 * 牌组类型（吃碰杠）
 */
export interface Meld {
  type: 'pong' | 'kong' | 'chow'  // 碰/杠/吃
  tiles: string[]                  // 牌组内容
  isConcealed: boolean             // 是否暗杠
  fromPlayer?: number              // 从哪个玩家获得（-1 表示自摸）
}

/**
 * 玩家信息
 */
export interface Player {
  name: string
  hand: string[]          // 手牌
  melds: Meld[]          // 碰、槓、吃的牌組
  discardPile: string[]  // 已出牌
  score: number
  isHuman: boolean
  canAction: boolean     // 是否有響應權（吃碰槓）
}

/**
 * 游戏阶段
 */
export type GamePhase = 'draw' | 'discard' | 'response' | 'end'

/**
 * 玩家动作类型
 */
export type PlayerAction = 'pong' | 'kong' | 'chow' | 'win' | 'pass'

/**
 * 响应动作信息
 */
export interface ResponseAction {
  playerIdx: number
  action: PlayerAction
  tiles?: string[]  // 用于吃牌时指定组合
}

/**
 * 游戏状态
 */
export interface GameState {
  players: Player[]
  currentPlayerIdx: number           // 當前玩家
  gamePhase: GamePhase              // 遊戲階段
  lastDiscardedTile: string | null  // 最後出的牌
  lastDiscardPlayer: number | null  // 出牌的玩家索引
  tileCount: number                 // 牌堆剩余数量
  round: number                     // 回合数
  waitingForResponse: boolean       // 是否等待响应
  pendingActions: ResponseAction[]  // 待处理的响应动作
}

/**
 * 创建初始游戏状态
 */
export function createInitialGameState(): GameState {
  return {
    players: [
      { name: '你', hand: [], melds: [], discardPile: [], score: 0, isHuman: true, canAction: false },
      { name: 'AI-東', hand: [], melds: [], discardPile: [], score: 0, isHuman: false, canAction: false },
      { name: 'AI-南', hand: [], melds: [], discardPile: [], score: 0, isHuman: false, canAction: false },
      { name: 'AI-西', hand: [], melds: [], discardPile: [], score: 0, isHuman: false, canAction: false },
    ],
    currentPlayerIdx: 0,
    gamePhase: 'draw',
    lastDiscardedTile: null,
    lastDiscardPlayer: null,
    tileCount: 144,
    round: 1,
    waitingForResponse: false,
    pendingActions: [],
  }
}

/**
 * 牌型排序权重
 */
export function getTileSortKey(tile: string): [number, number] {
  const type = tile[tile.length - 1]
  const num = parseInt(tile) || 0
  
  const typeOrder: { [key: string]: number } = {
    'm': 0,  // 萬
    's': 1,  // 索
    'p': 2,  // 筒
    'E': 3, 'S': 3, 'W': 3, 'N': 3,  // 風
    'B': 4, 'F': 4, 'Z': 4,  // 箭
  }
  
  return [typeOrder[type] ?? 5, num]
}

/**
 * 排序手牌
 */
export function sortHand(hand: string[]): string[] {
  return [...hand].sort((a, b) => {
    const [typeA, numA] = getTileSortKey(a)
    const [typeB, numB] = getTileSortKey(b)
    
    if (typeA !== typeB) return typeA - typeB
    return numA - numB
  })
}
