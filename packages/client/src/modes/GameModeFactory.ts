import type { GameModeBase } from './GameModeBase';
import SoloGameMode from './SoloGameMode';
import MultiplayerGameMode from './MultiplayerGameMode';

/**
 * Game mode type constants
 */
export const GameModeType = {
  SOLO: 'solo' as const,
  MULTIPLAYER: 'multiplayer' as const,
};

export type GameModeTypeValue =
  (typeof GameModeType)[keyof typeof GameModeType];

/**
 * Factory for creating game mode instances
 * Implements the Abstract Factory pattern
 */
export default class GameModeFactory {
  /**
   * Create a game mode instance
   * @param type - The type of game mode to create
   * @returns GameModeBase instance
   * @throws Error if invalid type
   */
  static createGameMode(type: GameModeTypeValue): GameModeBase {
    switch (type) {
      case GameModeType.SOLO:
        return new SoloGameMode();

      case GameModeType.MULTIPLAYER:
        return new MultiplayerGameMode();

      default:
        throw new Error(`Unknown game mode: ${type}`);
    }
  }

  /**
   * Helper method to determine game mode type from init data
   * @param data - Scene init data
   * @returns GameModeType
   */
  static getTypeFromInitData(data?: any): GameModeTypeValue {
    return data?.isMultiplayer ? GameModeType.MULTIPLAYER : GameModeType.SOLO;
  }
}
