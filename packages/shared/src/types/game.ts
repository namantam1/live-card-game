/**
 * Game state and gameplay type definitions
 */

import type { CardData } from './card';

/**
 * Represents a card played in a trick
 */
export interface TrickEntry {
  /** Index of the player who played this card (0-3) */
  playerIndex: number;
  /** The card that was played */
  card: CardData;
}

/**
 * Game phase states
 */
export type GamePhase =
  | 'idle'
  | 'waiting'
  | 'dealing'
  | 'bidding'
  | 'playing'
  | 'trickEnd'
  | 'roundEnd'
  | 'gameOver';

/**
 * Difficulty levels for bot AI
 */
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

/**
 * Context information for bot AI decision making
 */
export interface BotContext {
  /** Number of tricks the bot needs to win */
  tricksNeeded?: number;
  /** Number of tricks the bot has won */
  tricksWon?: number;
}

/**
 * Available reaction emojis for player interactions
 */
export type ReactionType =
  | '👍'
  | '👎'
  | '😂'
  | '😮'
  | '😍'
  | '😡'
  | '🔥'
  | '💯';

/**
 * Reaction event data broadcast to players
 */
export interface ReactionData {
  /** ID of the player who sent the reaction */
  playerId: string;
  /** Name of the player who sent the reaction */
  playerName: string;
  /** Seat index of the player */
  seatIndex: number;
  /** The reaction emoji type */
  type: ReactionType;
  /** Timestamp when reaction was sent */
  timestamp: number;
}
