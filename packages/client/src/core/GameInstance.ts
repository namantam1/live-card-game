import type { BaseGame } from '../games/BaseGame';
import type { BaseMode } from '../modes/BaseMode';
import { ServiceLocator } from './ServiceLocator';
import type { EventBus } from '../services/EventBus';
import type { Scene } from 'phaser';

/**
 * Represents the current active game session
 * Coordinates between game rules and game mode
 */
export class GameInstance {
  private static currentInstance: GameInstance | null = null;

  private game: BaseGame;
  private mode: BaseMode;
  private eventBus: EventBus;
  private isActive: boolean = false;
  private scene?: Scene;
  private data?: any;

  constructor(game: BaseGame, mode: BaseMode, scene?: Scene, data?: any) {
    this.game = game;
    this.mode = mode;
    this.scene = scene;
    this.data = data;
    this.eventBus = ServiceLocator.get<EventBus>('eventBus');
  }

  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('GameInstance already started');
    }

    // Initialize mode with game
    await this.mode.initialize(this.game, this.scene, this.data);

    // Set as current instance
    GameInstance.currentInstance = this;
    this.isActive = true;

    this.eventBus.publishGameEvent('gameInstanceStarted', {
      gameId: this.game.id,
      modeId: this.mode.id,
    });
  }

  async stop(): Promise<void> {
    if (!this.isActive) return;

    await this.mode.cleanup();
    this.isActive = false;
    GameInstance.currentInstance = null;

    this.eventBus.publishGameEvent('gameInstanceStopped', {
      gameId: this.game.id,
      modeId: this.mode.id,
    });
  }

  getGame(): BaseGame {
    return this.game;
  }

  getMode(): BaseMode {
    return this.mode;
  }

  isGameActive(): boolean {
    return this.isActive;
  }

  static getCurrent(): GameInstance | null {
    return GameInstance.currentInstance;
  }

  static requireCurrent(): GameInstance {
    if (!GameInstance.currentInstance) {
      throw new Error('No active GameInstance. Did you call start()?');
    }
    return GameInstance.currentInstance;
  }
}
