import { Client, Room } from '@colyseus/sdk';
import Phaser from 'phaser';

/**
 * ReconnectionHandler - Handles automatic reconnection logic
 * Single Responsibility: Manage reconnection attempts with exponential backoff
 */
export default class ReconnectionHandler extends Phaser.Events.EventEmitter {
  private reconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectionToken: string | null = null;

  private readonly maxReconnectAttempts: number = 3;
  private readonly reconnectDelay: number = 2000;

  constructor() {
    super();
  }

  /**
   * Save reconnection token from a room
   */
  saveToken(token: string): void {
    this.reconnectionToken = token;
  }

  /**
   * Clear reconnection token
   */
  clearToken(): void {
    this.reconnectionToken = null;
  }

  /**
   * Check if currently reconnecting
   */
  isReconnecting(): boolean {
    return this.reconnecting;
  }

  /**
   * Handle unexpected disconnect and start reconnection attempts
   */
  async handleDisconnect(client: Client): Promise<Room | null> {
    if (this.reconnecting) return null;

    this.reconnecting = true;
    this.emit('reconnecting', { attempt: this.reconnectAttempts + 1 });

    return await this.attemptReconnection(client);
  }

  /**
   * Attempt to reconnect to the server
   */
  private async attemptReconnection(client: Client): Promise<Room | null> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('ReconnectionHandler: Max reconnection attempts reached');
      this.reconnecting = false;
      this.emit('failed', {
        message: 'Could not reconnect to the game',
      });
      this.reconnectionToken = null;
      return null;
    }

    this.reconnectAttempts++;
    console.log(
      `ReconnectionHandler: Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
    );

    try {
      // Try to reconnect using the reconnectionToken
      if (this.reconnectionToken && client) {
        const room = await client.reconnect(this.reconnectionToken);

        // Reconnection successful
        console.log('ReconnectionHandler: Reconnection successful!');
        this.reconnecting = false;
        this.reconnectAttempts = 0;

        // Update reconnection token for future reconnections
        this.reconnectionToken = room.reconnectionToken;

        this.emit('succeeded', { room });
        return room;
      } else {
        throw new Error('No reconnection token available');
      }
    } catch (error) {
      console.error('ReconnectionHandler: Reconnection failed', error);

      // Schedule next attempt with exponential backoff
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`ReconnectionHandler: Retrying in ${delay}ms...`);

      return new Promise((resolve) => {
        this.reconnectTimer = setTimeout(async () => {
          const result = await this.attemptReconnection(client);
          resolve(result);
        }, delay);
      });
    }
  }

  /**
   * Cancel any ongoing reconnection attempts
   */
  cancel(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Reset the handler state
   */
  reset(): void {
    this.cancel();
    this.reconnectionToken = null;
  }

  /**
   * Cleanup resources
   */
  override destroy(): void {
    this.cancel();
    this.clearToken();
    this.removeAllListeners();
  }
}
