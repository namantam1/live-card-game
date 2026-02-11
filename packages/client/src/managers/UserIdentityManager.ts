import { storage } from './StorageManager';
import defaultNames from '../data/defaultNames.json';

export interface UserIdentity {
  userId: string;
  name: string;
}

/**
 * Design: userId Persistent, unique per device/app installation
 */
export class UserIdentityManager {
  private readonly USER_KEY = 'user';
  private readonly LEGACY_PLAYER_NAME_KEY = 'player_name';
  private cachedIdentity: UserIdentity | null = null;

  /**
   * Get or create user identity
   * Returns existing identity from storage or creates new one
   */
  getOrCreateIdentity(name?: string): UserIdentity {
    // Return cached if available
    if (this.cachedIdentity) {
      return this.cachedIdentity;
    }

    // Try to load from storage
    const stored = storage.load<UserIdentity>(this.USER_KEY);
    if (stored && stored.userId && stored.name) {
      this.cachedIdentity = stored;
      return stored;
    }

    // Check for legacy player name and migrate
    // TODO: Remove legacy name handling after migration period
    const legacyName = storage.load<string>(this.LEGACY_PLAYER_NAME_KEY);
    if (legacyName && !name) {
      name = legacyName;
      // Clean up legacy storage
      storage.remove(this.LEGACY_PLAYER_NAME_KEY);
    }

    // Create new identity
    const newIdentity: UserIdentity = {
      userId: this.generateUserId(),
      name: name || this.generateRandomName(),
    };

    this.saveIdentity(newIdentity);
    return newIdentity;
  }

  /**
   * Get current user identity
   * Returns null if no identity exists
   */
  getIdentity(): UserIdentity | null {
    if (this.cachedIdentity) {
      return this.cachedIdentity;
    }

    const stored = storage.load<UserIdentity>(this.USER_KEY);
    if (stored && stored.userId && stored.name) {
      this.cachedIdentity = stored;
      return stored;
    }

    return null;
  }

  updateName(name: string): UserIdentity {
    const identity = this.getOrCreateIdentity();
    identity.name = name;
    this.saveIdentity(identity);
    return identity;
  }

  private saveIdentity(identity: UserIdentity): void {
    storage.save(this.USER_KEY, identity);
    this.cachedIdentity = identity;
  }

  private generateRandomName(): string {
    return defaultNames.names[
      Math.floor(Math.random() * defaultNames.names.length)
    ];
  }

  private generateUserId(): string {
    // Use native crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback: UUID v4 implementation using Math.random()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  clearIdentity(): void {
    storage.remove(this.USER_KEY);
    this.cachedIdentity = null;
  }
}

// Singleton instance for easy access
export const userIdentity = new UserIdentityManager();
