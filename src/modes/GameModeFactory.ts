import type { IGameMode } from "./IGameMode";
import SoloGameMode from "./SoloGameMode";
import MultiplayerGameMode from "./MultiplayerGameMode";

/**
 * Game mode type constants
 */
export const GameModeType = {
  SOLO: "solo" as const,
  MULTIPLAYER: "multiplayer" as const,
};

export type GameModeTypeValue = typeof GameModeType[keyof typeof GameModeType];

/**
 * Factory for creating game mode instances
 * Implements the Abstract Factory pattern
 */
export default class GameModeFactory {
  /**
   * Create a game mode instance
   * @param type - The type of game mode to create
   * @param data - Optional initialization data (networkManager for multiplayer)
   * @returns IGameMode instance
   * @throws Error if invalid type or missing required data
   */
  static createGameMode(type: GameModeTypeValue, data?: any): IGameMode {
    switch (type) {
      case GameModeType.SOLO:
        return new SoloGameMode();

      case GameModeType.MULTIPLAYER:
        if (!data?.networkManager) {
          throw new Error("NetworkManager required for multiplayer mode");
        }
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
