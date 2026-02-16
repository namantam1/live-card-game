import type { BaseMode } from '../modes/BaseMode';

/**
 * Registry of all available game modes
 * Modes are registered at bootstrap in main.ts
 */
export class ModeRegistry {
  private static modes: Map<string, typeof BaseMode> = new Map();

  static register(id: string, modeClass: typeof BaseMode): void {
    if (this.modes.has(id)) {
      throw new Error(`Mode ${id} already registered`);
    }
    this.modes.set(id, modeClass);
  }

  static get(id: string): typeof BaseMode {
    const mode = this.modes.get(id);
    if (!mode) {
      throw new Error(
        `Mode ${id} not found. Available: ${this.getAvailableModes()}`
      );
    }
    return mode;
  }

  static has(id: string): boolean {
    return this.modes.has(id);
  }

  static getAll(): Array<{ id: string; mode: typeof BaseMode }> {
    return Array.from(this.modes.entries()).map(([id, mode]) => ({
      id,
      mode,
    }));
  }

  static getAvailableModes(): string[] {
    return Array.from(this.modes.keys());
  }

  static clear(): void {
    this.modes.clear();
  }
}
