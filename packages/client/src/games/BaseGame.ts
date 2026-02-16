import type { CardData, PlayerData, GameState } from '../type.d';
import type { Suit } from '../utils/constants';

/**
 * Base class for all card games
 * Each game implements its own rules, scoring, validation, and rendering config.
 *
 * Rendering config (getPhases, getActionPanels, getCardPlayHandler) allows
 * scenes to remain generic — they read config from the game class instead
 * of hardcoding game-specific conditionals.
 */
export abstract class BaseGame {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly minPlayers: number;
  abstract readonly maxPlayers: number;
  abstract readonly description?: string;

  // Game configuration
  abstract getPlayAreaConfig(): PlayAreaConfig;
  abstract getPlayerPositions(): PlayerPositionConfig[];
  abstract getUIConfig(): GameUIConfig;

  // Game rules
  abstract validateMove(card: CardData, state: GameState): boolean;
  abstract getValidMoves(
    hand: CardData[],
    leadSuit: Suit | null,
    currentTrick: unknown[]
  ): CardData[];
  abstract calculateScore(player: PlayerData, state: GameState): number;

  // Game flow
  abstract shouldEndRound(state: GameState): boolean;
  abstract shouldEndGame(state: GameState): boolean;

  // Default: highest score wins
  getWinner(players: PlayerData[]): PlayerData {
    return players.reduce((winner, player) =>
      player.score > winner.score ? player : winner
    );
  }

  // AI (for solo mode)
  abstract getAIMove(hand: CardData[], state: GameState): CardData;
  abstract getAIBid?(hand: CardData[]): number;

  // ===== Rendering Config =====

  /**
   * What phases does this game have?
   * Scenes use this to know what UI to show per phase.
   */
  abstract getPhases(): GamePhaseConfig[];

  /**
   * What action panels should be shown during gameplay?
   * e.g., Call Break has bidding; Mindi has trump-select.
   * Scenes create panels based on this config — no game-specific conditionals.
   */
  abstract getActionPanels(): ActionPanelConfig[];

  /**
   * How should a card play be rendered?
   * Default: trick-based (move card to center).
   * Override for different mechanics.
   */
  getCardPlayHandler(): CardPlayHandler {
    return 'trick';
  }
}

export interface PlayAreaConfig {
  type: 'trick' | 'tableau' | 'custom';
  positions: number;
}

export interface PlayerPositionConfig {
  x: number; // Percentage (0-1)
  y: number;
  rotation: number; // Degrees
}

export interface GameUIConfig {
  showBidding: boolean;
  showTricks: boolean;
  showScoreboard: boolean;
  cardBackStyle: string;
}

export interface GamePhaseConfig {
  id: string; // Phase identifier
  label: string; // Display label
  hasUI: boolean; // Whether this phase requires UI panel/modal
}

export interface ActionPanelConfig {
  type: 'bidding' | 'trump-select' | 'custom';
  showDuring: string; // Phase ID when visible
  config?: unknown;
}

export type CardPlayHandler = 'trick' | 'tableau' | 'discard';
