/**
 * StorageManager - Centralized localStorage wrapper with type safety
 * Provides consistent error handling and prefixing for game storage
 */
export class StorageManager {
  private readonly prefix = 'callbreak_';

  /**
   * Save a value to localStorage
   * @param key Storage key (will be prefixed)
   * @param value Value to store (will be JSON serialized)
   */
  save<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.prefix + key, serialized);
      return true;
    } catch (error) {
      console.error(`[StorageManager] Failed to save "${key}":`, error);
      return false;
    }
  }

  /**
   * Load a value from localStorage
   * @param key Storage key (will be prefixed)
   * @param defaultValue Default value if key doesn't exist or parsing fails
   * @returns Parsed value or default value
   */
  load<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (item === null) {
        return defaultValue ?? null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`[StorageManager] Failed to load "${key}":`, error);
      return defaultValue ?? null;
    }
  }

  /**
   * Remove a value from localStorage
   * @param key Storage key (will be prefixed)
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (error) {
      console.error(`[StorageManager] Failed to remove "${key}":`, error);
    }
  }

  /**
   * Check if a key exists in localStorage
   * @param key Storage key (will be prefixed)
   */
  has(key: string): boolean {
    return localStorage.getItem(this.prefix + key) !== null;
  }

  /**
   * Clear all game-related items from localStorage
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('[StorageManager] Failed to clear storage:', error);
    }
  }

  /**
   * Get the raw storage key with prefix
   * @param key Storage key
   */
  getKey(key: string): string {
    return this.prefix + key;
  }
}

// Singleton instance for easy access
export const storage = new StorageManager();
