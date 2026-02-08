import type { ConnectionQuality } from '../../type';
import Phaser from 'phaser';

/**
 * ConnectionMonitor - Monitors connection health and quality
 * Single Responsibility: Track connection quality metrics
 */
export default class ConnectionMonitor extends Phaser.Events.EventEmitter {
  private connectionQuality: ConnectionQuality = 'good';
  private lastPingTime: number = Date.now();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private readonly pingTimeout: number = 5000;

  constructor() {
    super();
  }

  /**
   * Start monitoring connection quality
   */
  start(onStateChange?: () => void): void {
    if (this.pingInterval) return;

    this.lastPingTime = Date.now();
    this.connectionQuality = 'good';

    // Monitor state updates to detect connection health
    this.pingInterval = setInterval(() => {
      const timeSinceLastPing = Date.now() - this.lastPingTime;

      if (timeSinceLastPing > this.pingTimeout * 3) {
        // No updates for a long time - poor connection or offline
        this.updateQuality('offline');
      } else if (timeSinceLastPing > this.pingTimeout * 2) {
        // Slow connection
        this.updateQuality('poor');
      } else if (timeSinceLastPing > this.pingTimeout) {
        // Fair connection
        this.updateQuality('fair');
      } else {
        // Good connection
        this.updateQuality('good');
      }
    }, 2000);

    // Call the state change callback if provided (for resetting ping time)
    if (onStateChange) {
      onStateChange();
    }
  }

  /**
   * Stop monitoring connection quality
   */
  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Update the last ping time (call when receiving updates from server)
   */
  recordActivity(): void {
    this.lastPingTime = Date.now();
  }

  /**
   * Update connection quality and emit event if changed
   */
  private updateQuality(quality: ConnectionQuality): void {
    if (this.connectionQuality !== quality) {
      this.connectionQuality = quality;
      this.emit('qualityChange', {
        quality,
        connected: quality !== 'offline',
      });
    }
  }

  /**
   * Force update quality (useful for manual override)
   */
  setQuality(quality: ConnectionQuality): void {
    this.updateQuality(quality);
  }

  /**
   * Get current connection quality
   */
  getQuality(): ConnectionQuality {
    return this.connectionQuality;
  }

  /**
   * Check if currently connected (not offline)
   */
  isHealthy(): boolean {
    return this.connectionQuality !== 'offline';
  }

  /**
   * Cleanup resources
   */
  override destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}
