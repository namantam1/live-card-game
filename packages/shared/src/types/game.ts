/**
 * Game state and gameplay type definitions
 */

import type { CardData } from "./card";

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
  | "idle"
  | "waiting"
  | "dealing"
  | "bidding"
  | "playing"
  | "trickEnd"
  | "roundEnd"
  | "gameOver";

/**
 * Difficulty levels for bot AI
 */
export type DifficultyLevel = "easy" | "medium" | "hard";

/**
 * Context information for bot AI decision making
 */
export interface BotContext {
  /** Number of tricks the bot needs to win */
  tricksNeeded?: number;
  /** Number of tricks the bot has won */
  tricksWon?: number;
}
