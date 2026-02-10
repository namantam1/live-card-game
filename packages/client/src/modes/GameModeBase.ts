import Phaser from 'phaser';
import type { Scene } from 'phaser';
import type Player from '../objects/Player';
import type TrickArea from '../objects/TrickArea';
import type { CardData, PlayerData } from '../type';
import { type GameEvent } from '../utils/constants';
import type NetworkManager from '../managers/NetworkManager';

export interface GameModeConfig {
  scene: Scene;
  trickArea: TrickArea;
  networkManager?: NetworkManager;
}

/**
 * Type-safe event names for GameMode events.
 * Uses GameEvent from constants for consistency across the codebase.
 */
export type GameModeEvent = GameEvent;

/**
 * Abstract base class for game modes.
 * Extends Phaser's EventEmitter for event handling with type-safe event names.
 *
 * @fires phaseChanged - When game phase changes (bidding, playing, roundEnd, gameOver)
 * @fires turnChanged - When active player changes
 * @fires cardPlayed - When any player plays a card
 * @fires trickComplete - When a trick is completed
 * @fires roundComplete - When a round ends
 * @fires gameComplete - When the game ends
 * @fires bidPlaced - When a player places a bid
 */
export abstract class GameModeBase extends Phaser.Events.EventEmitter {
  constructor() {
    super();
  }

  // ===== Type-Safe Event Methods =====

  /**
   * Add a listener for a given event.
   * @param event - The event name (type-safe)
   * @param fn - The listener function
   * @param context - The context to invoke the listener with
   */
  override on(
    event: GameModeEvent,
    fn: (data?: any) => void,
    context?: any
  ): this {
    return super.on(event, fn, context);
  }

  /**
   * Add a one-time listener for a given event.
   * @param event - The event name (type-safe)
   * @param fn - The listener function
   * @param context - The context to invoke the listener with
   */
  override once(event: GameModeEvent, fn: () => void, context?: any): this {
    return super.once(event, fn, context);
  }

  /**
   * Remove a listener for a given event.
   * @param event - The event name (type-safe)
   * @param fn - The listener function to remove
   * @param context - The context of the listener
   * @param once - Only remove one-time listeners
   */
  override off(
    event: GameModeEvent,
    fn?: () => void,
    context?: any,
    once?: boolean
  ): this {
    return super.off(event, fn, context, once);
  }

  /**
   * Emit an event.
   * @param event - The event name (type-safe)
   * @param args - Arguments to pass to listeners
   */
  override emit(event: GameModeEvent, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }

  // ===== Lifecycle =====

  async initialize(_scene: Scene, _data: any): Promise<void> {
    console.error(`${this.constructor.name}: initialize() not implemented`);
    throw new Error('initialize() must be implemented');
  }

  async startGame(): Promise<void> {
    console.error(`${this.constructor.name}: startGame() not implemented`);
    throw new Error('startGame() must be implemented');
  }

  cleanup(): void | Promise<void> {
    console.warn(`${this.constructor.name}: cleanup() not overridden`);
  }

  // Player Management

  createPlayers(_scene: Scene): Player[] {
    console.error(`${this.constructor.name}: createPlayers() not implemented`);
    throw new Error('createPlayers() must be implemented');
  }

  getPlayers(): PlayerData[] {
    console.error(`${this.constructor.name}: getPlayers() not implemented`);
    throw new Error('getPlayers() must be implemented');
  }

  getCurrentRound(): number {
    console.error(
      `${this.constructor.name}: getCurrentRound() not implemented`
    );
    throw new Error('getCurrentRound() must be implemented');
  }

  getPhase(): string {
    console.error(`${this.constructor.name}: getPhase() not implemented`);
    throw new Error('getPhase() must be implemented');
  }

  /**
   * Check if it is the local player's turn.
   * @returns true if the local player should act now
   */
  isLocalPlayersTurn(): boolean {
    console.error(
      `${this.constructor.name}: isLocalPlayersTurn() not implemented`
    );
    throw new Error('isLocalPlayersTurn() must be implemented');
  }

  /**
   * Get the local player (the player controlled by this client)
   * @returns The player data for the local player, or null if not found
   */
  getLocalPlayer(): PlayerData | null {
    console.error(`${this.constructor.name}: getLocalPlayer() not implemented`);
    throw new Error('getLocalPlayer() must be implemented');
  }

  /**
   * Check if a given player index is the local player
   * @param playerIndex - The index to check
   * @returns true if the player at this index is the local player
   */
  isLocalPlayer(playerIndex: number): boolean {
    const players = this.getPlayers();
    if (playerIndex < 0 || playerIndex >= players.length) {
      return false;
    }
    return players[playerIndex].isLocal === true;
  }

  /**
   * Get the recommended bid for the local player's current hand
   * @returns Recommended bid number (1-8), or undefined if unable to compute
   */
  getRecommendedBid(): number | undefined {
    console.error(
      `${this.constructor.name}: getRecommendedBid() not implemented`
    );
    throw new Error('getRecommendedBid() must be implemented');
  }

  // Game Actions

  onBidSelected(_bid: number): void {
    console.error(`${this.constructor.name}: onBidSelected() not implemented`);
    throw new Error('onBidSelected() must be implemented');
  }

  onCardPlayed(_cardData: CardData): void {
    console.error(`${this.constructor.name}: onCardPlayed() not implemented`);
    throw new Error('onCardPlayed() must be implemented');
  }

  continueToNextRound(): void {
    console.error(
      `${this.constructor.name}: continueToNextRound() not implemented`
    );
    throw new Error('continueToNextRound() must be implemented');
  }

  restartGame(): void {
    console.error(`${this.constructor.name}: restartGame() not implemented`);
    throw new Error('restartGame() must be implemented');
  }

  returnToMenu(): void | Promise<void> {
    console.warn(`${this.constructor.name}: returnToMenu() not overridden`);
  }

  sendReaction(_reactionType: string): void {
    console.error(`${this.constructor.name}: sendReaction() not implemented`);
    throw new Error('sendReaction() must be implemented');
  }

  sendChat(_message: string): void {
    console.error(`${this.constructor.name}: sendChat() not implemented`);
    throw new Error('sendChat() must be implemented');
  }

  // Event System inherited from Phaser.Events.EventEmitter
  // Available methods: on, off, once, emit, removeAllListeners, etc.
}
