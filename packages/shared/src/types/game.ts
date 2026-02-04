import type { CardData, Suit } from './card';

export interface TrickEntry {
  playerIndex: number; // 0-3
  card: CardData;
}

export type GamePhase =
  | 'idle'
  | 'waiting'
  | 'dealing'
  | 'bidding'
  | 'playing'
  | 'trickEnd'
  | 'roundEnd'
  | 'gameOver';

export interface BotContext {
  trumpSuit?: Suit;
  leadSuit?: Suit;
  tricksWon?: number;
  bid?: number;
  numPlayers?: number;
}

export type ReactionType =
  | '👍'
  | '👎'
  | '😂'
  | '😮'
  | '😍'
  | '😡'
  | '🔥'
  | '💯';

export interface ReactionData {
  playerId: string;
  playerName: string;
  seatIndex: number;
  type: ReactionType;
  timestamp: number;
}
