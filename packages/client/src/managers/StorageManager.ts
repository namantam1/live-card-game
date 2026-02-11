/**
 * StorageManager - Centralized storage wrapper with type safety
 * Provides consistent error handling and prefixing for game storage
 *
 * Storage Type:
 * - Uses sessionStorage when VITE_USE_SESSION_STORAGE=true (per-tab storage for testing)
 * - Uses localStorage by default (persistent across tabs)
 */
export class StorageManager {
  private readonly prefix = 'callbreak_';
  private readonly storage: Storage;

  constructor() {
    // Use sessionStorage for multi-tab testing, localStorage for production
    const useSessionStorage =
      import.meta.env.VITE_USE_SESSION_STORAGE === 'true';
    this.storage = useSessionStorage ? sessionStorage : localStorage;

    if (useSessionStorage) {
      console.log(
        '[StorageManager] Using sessionStorage (multi-tab testing mode)'
      );
    }
  }

  /**
   * Save a value to storage
   * @param key Storage key (will be prefixed)
   * @param value Value to store (will be JSON serialized)
   */
  save<T>(key: string, value: T): boolean {
    try {
      const serialized = JSON.stringify(value);
      this.storage.setItem(this.prefix + key, serialized);
      return true;
    } catch (error) {
      console.error(`[StorageManager] Failed to save "${key}":`, error);
      return false;
    }
  }

  /**
   * Load a value from storage
   * @param key Storage key (will be prefixed)
   * @param defaultValue Default value if key doesn't exist or parsing fails
   * @returns Parsed value or default value
   */
  load<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = this.storage.getItem(this.prefix + key);
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
   * Remove a value from storage
   * @param key Storage key (will be prefixed)
   */
  remove(key: string): void {
    try {
      this.storage.removeItem(this.prefix + key);
    } catch (error) {
      console.error(`[StorageManager] Failed to remove "${key}":`, error);
    }
  }

  /**
   * Check if a key exists in storage
   * @param key Storage key (will be prefixed)
   */
  has(key: string): boolean {
    return this.storage.getItem(this.prefix + key) !== null;
  }

  /**
   * Clear all game-related items from storage
   */
  clear(): void {
    try {
      const keys = Object.keys(this.storage);
      keys.forEach((key) => {
        if (key.startsWith(this.prefix)) {
          this.storage.removeItem(key);
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
