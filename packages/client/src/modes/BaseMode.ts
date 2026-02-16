import type { BaseGame } from '../games/BaseGame';
import Phaser from 'phaser';
import type { CardData, PlayerData, GameState } from '../type.d';

export abstract class BaseMode extends Phaser.Events.EventEmitter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly requiresNetwork: boolean;

  protected game!: BaseGame;

  abstract initialize(game: BaseGame, scene?: any, data?: any): Promise<void>;
  abstract cleanup(): Promise<void>;

  abstract startGame(): Promise<void>;
  abstract sendMove(card: CardData): void;
  abstract sendBid(bid: number): void;

  abstract getPlayers(): PlayerData[];
  abstract getCurrentPlayer(): PlayerData | null;
  abstract getGameState(): GameState;
}
