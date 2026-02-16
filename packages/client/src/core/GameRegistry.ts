import type { BaseGame } from '../games/BaseGame';

/**
 * Registry of all available games
 * Games are registered at bootstrap in main.ts
 */
export class GameRegistry {
  private static games: Map<string, typeof BaseGame> = new Map();

  static register(id: string, gameClass: typeof BaseGame): void {
    if (this.games.has(id)) {
      throw new Error(`Game ${id} already registered`);
    }
    this.games.set(id, gameClass);
  }

  static get(id: string): typeof BaseGame {
    const game = this.games.get(id);
    if (!game) {
      throw new Error(
        `Game ${id} not found. Available: ${this.getAvailableGames()}`
      );
    }
    return game;
  }

  static has(id: string): boolean {
    return this.games.has(id);
  }

  static getAll(): Array<{ id: string; game: typeof BaseGame }> {
    return Array.from(this.games.entries()).map(([id, game]) => ({
      id,
      game,
    }));
  }

  static getAvailableGames(): string[] {
    return Array.from(this.games.keys());
  }

  static clear(): void {
    this.games.clear();
  }
}
