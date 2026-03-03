import type { BaseGame } from '../games/BaseGame';
import Phaser from 'phaser';
import type { CardData, PlayerData, GameState } from '../type.d';

export abstract class BaseMode extends Phaser.Events.EventEmitter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly requiresNetwork: boolean;

  protected game!: BaseGame;

  // Core lifecycle methods
  abstract initialize(game: BaseGame, scene?: any, data?: any): Promise<void>;
  abstract cleanup(): Promise<void>;
  abstract startGame(): Promise<void>;

  // Game actions
  abstract sendMove(card: CardData): void;
  abstract sendBid(bid: number): void;
  abstract sendReaction(type: string): void;
  abstract sendChat(message: string): void;

  // State queries
  abstract getPlayers(): PlayerData[];
  abstract getCurrentPlayer(): PlayerData | null;
  abstract getGameState(): GameState;
  abstract getCurrentRound(): number;
  abstract getPhase(): string;
  abstract getLocalPlayer(): PlayerData | null;

  // Turn management
  abstract isLocalPlayersTurn(): boolean;
  abstract isLocalPlayer(playerIndex: number): boolean;

  // Game logic helpers
  abstract getRecommendedBid(): number | undefined;
}
