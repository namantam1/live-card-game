import Phaser from "phaser";
import type { Scene } from "phaser";
import type Player from "../objects/Player";
import type TrickArea from "../objects/TrickArea";
import type { CardData } from "../type";
import { type GameEvent } from "../utils/constants";

export interface PlayerData {
  name: string;
  emoji: string;
  bid: number;
  tricksWon: number;
  score: number;
  roundScore: number;
  isHuman: boolean;
  isLocal?: boolean;
  id?: string;
}

export type EventCallback = (data?: any) => void;

export interface GameModeConfig {
  scene: Scene;
  trickArea: TrickArea;
  audioManager?: any;
  networkManager?: any;
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
 *
 * @example
 * // Listen to events with autocomplete
 * gameMode.on('phaseChanged', (phase) => console.log('Phase:', phase));
 * gameMode.once('gameComplete', (data) => console.log('Winner:', data.winner));
 *
 * // Remove listeners
 * gameMode.off('turnChanged', callback);
 * gameMode.removeAllListeners('cardPlayed');
 * gameMode.removeAllListeners(); // Remove all listeners
 *
 * Subclasses override methods using 'override' keyword.
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
  override on(event: GameModeEvent, fn: Function, context?: any): this {
    return super.on(event, fn, context);
  }

  /**
   * Add a one-time listener for a given event.
   * @param event - The event name (type-safe)
   * @param fn - The listener function
   * @param context - The context to invoke the listener with
   */
  override once(event: GameModeEvent, fn: Function, context?: any): this {
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
    fn?: Function,
    context?: any,
    once?: boolean,
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
    throw new Error("initialize() must be implemented");
  }

  async startGame(): Promise<void> {
    console.error(`${this.constructor.name}: startGame() not implemented`);
    throw new Error("startGame() must be implemented");
  }

  cleanup(): void | Promise<void> {
    console.warn(`${this.constructor.name}: cleanup() not overridden`);
  }

  // Player Management

  createPlayers(_scene: Scene): Player[] {
    console.error(`${this.constructor.name}: createPlayers() not implemented`);
    throw new Error("createPlayers() must be implemented");
  }

  getPlayers(): PlayerData[] {
    console.error(`${this.constructor.name}: getPlayers() not implemented`);
    throw new Error("getPlayers() must be implemented");
  }

  getCurrentRound(): number {
    console.error(
      `${this.constructor.name}: getCurrentRound() not implemented`,
    );
    throw new Error("getCurrentRound() must be implemented");
  }

  getPhase(): string {
    console.error(`${this.constructor.name}: getPhase() not implemented`);
    throw new Error("getPhase() must be implemented");
  }

  // Game Actions

  onBidSelected(_bid: number): void {
    console.error(`${this.constructor.name}: onBidSelected() not implemented`);
    throw new Error("onBidSelected() must be implemented");
  }

  onCardPlayed(_cardData: CardData): void {
    console.error(`${this.constructor.name}: onCardPlayed() not implemented`);
    throw new Error("onCardPlayed() must be implemented");
  }

  continueToNextRound(): void {
    console.error(
      `${this.constructor.name}: continueToNextRound() not implemented`,
    );
    throw new Error("continueToNextRound() must be implemented");
  }

  restartGame(): void {
    console.error(`${this.constructor.name}: restartGame() not implemented`);
    throw new Error("restartGame() must be implemented");
  }

  returnToMenu(): void | Promise<void> {
    console.warn(`${this.constructor.name}: returnToMenu() not overridden`);
  }

  // Event System inherited from Phaser.Events.EventEmitter
  // Available methods: on, off, once, emit, removeAllListeners, etc.
}
