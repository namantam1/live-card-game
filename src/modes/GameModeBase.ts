import type { Scene } from "phaser";
import type Player from "../objects/Player";
import type TrickArea from "../objects/TrickArea";
import type { CardData } from "../type";

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
 * Abstract base class for game modes.
 * Subclasses override methods using 'override' keyword.
 */
export abstract class GameModeBase {
  // Lifecycle

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
    console.error(`${this.constructor.name}: getCurrentRound() not implemented`);
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
    console.error(`${this.constructor.name}: continueToNextRound() not implemented`);
    throw new Error("continueToNextRound() must be implemented");
  }

  restartGame(): void {
    console.error(`${this.constructor.name}: restartGame() not implemented`);
    throw new Error("restartGame() must be implemented");
  }

  returnToMenu(): void | Promise<void> {
    console.warn(`${this.constructor.name}: returnToMenu() not overridden`);
  }

  // Event System

  on(_event: string, _callback: EventCallback): void {
    console.error(`${this.constructor.name}: on() not implemented`);
    throw new Error("on() must be implemented");
  }

  off(_event: string, _callback: EventCallback): void {
    console.error(`${this.constructor.name}: off() not implemented`);
    throw new Error("off() must be implemented");
  }
}
