import type { Scene } from "phaser";
import type Player from "../objects/Player";
import type TrickArea from "../objects/TrickArea";
import type { CardData } from "../type";

/**
 * Unified player data interface for both solo and multiplayer modes
 */
export interface PlayerData {
  name: string;
  emoji: string;
  bid: number;
  tricksWon: number;
  score: number;
  roundScore: number;
  isHuman: boolean;
  isLocal?: boolean; // for multiplayer: is this the local player?
  id?: string; // for multiplayer: session/network ID
}

/**
 * Event callback function type
 */
export type EventCallback = (data?: any) => void;

/**
 * Game mode interface - all game modes must implement this
 * This provides a unified API for both Solo and Multiplayer modes
 */
export interface IGameMode {
  // ===== Lifecycle Methods =====

  /**
   * Initialize the game mode with scene and configuration
   * @param scene - The Phaser scene
   * @param data - Initialization data (trickArea, audioManager, etc.)
   */
  initialize(scene: Scene, data: any): Promise<void>;

  /**
   * Start the game (deal cards, begin first round)
   */
  startGame(): Promise<void>;

  /**
   * Clean up resources when exiting the game
   */
  cleanup(): void | Promise<void>;

  // ===== Player Management =====

  /**
   * Create and return player objects for rendering
   * @param scene - The Phaser scene
   * @returns Array of Player objects
   */
  createPlayers(scene: Scene): Player[];

  /**
   * Get current player data for UI display
   * @returns Array of PlayerData objects
   */
  getPlayers(): PlayerData[];

  /**
   * Get current round number
   */
  getCurrentRound(): number;

  /**
   * Get current game phase
   */
  getPhase(): string;

  // ===== Game Actions =====

  /**
   * Handle bid selection from user
   * @param bid - The bid amount (1-8)
   */
  onBidSelected(bid: number): void;

  /**
   * Handle card played by user
   * @param cardData - The card that was played
   */
  onCardPlayed(cardData: CardData): void;

  /**
   * Continue to the next round
   */
  continueToNextRound(): void;

  /**
   * Restart the game from round 1
   */
  restartGame(): void;

  /**
   * Return to main menu
   */
  returnToMenu(): void | Promise<void>;

  // ===== Event System =====

  /**
   * Register an event listener
   * @param event - Event name
   * @param callback - Callback function
   */
  on(event: string, callback: EventCallback): void;

  /**
   * Unregister an event listener
   * @param event - Event name
   * @param callback - Callback function
   */
  off(event: string, callback: EventCallback): void;
}

/**
 * Configuration for initializing a game mode
 */
export interface GameModeConfig {
  scene: Scene;
  trickArea: TrickArea;
  audioManager?: any;
  networkManager?: any; // For multiplayer mode
}
