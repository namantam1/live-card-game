import { Room } from '@colyseus/sdk';
import type { ConnectionQuality } from '../type';
import ConnectionManager from './network/ConnectionManager';
import ConnectionMonitor from './network/ConnectionMonitor';
import ReconnectionHandler from './network/ReconnectionHandler';
import RoomManager from './network/RoomManager';

/**
 * NetworkManager - Facade/Coordinator for network operations
 * Delegates to specialized managers for different concerns
 *
 * This provides a simpler API while maintaining separation of concerns
 */
export default class NetworkManager {
  private connectionManager: ConnectionManager;
  private connectionMonitor: ConnectionMonitor;
  private reconnectionHandler: ReconnectionHandler;
  private roomManager: RoomManager;

  constructor() {
    this.connectionManager = new ConnectionManager();
    this.connectionMonitor = new ConnectionMonitor();
    this.reconnectionHandler = new ReconnectionHandler();
    this.roomManager = new RoomManager();

    this.setupHandlers();
  }

  /**
   * Setup handlers between components
   */
  private setupHandlers(): void {
    // Forward room manager events
    this.roomManager.on(
      'leave',
      async ({
        code: _code,
        wasUnexpected,
      }: {
        code: number;
        wasUnexpected: boolean;
      }) => {
        this.connectionMonitor.stop();

        if (wasUnexpected) {
          console.log(
            'NetworkManager: Unexpected disconnect, attempting reconnection...'
          );
          this.connectionMonitor.setQuality('offline');

          const client = this.connectionManager.getClient();
          if (client) {
            const room =
              await this.reconnectionHandler.handleDisconnect(client);
            if (room) {
              // Reconnection successful
              this.roomManager.updateRoom(room);
              this.reconnectionHandler.saveToken(room.reconnectionToken);
              this.connectionMonitor.start();
              this.connectionMonitor.setQuality('good');
            }
          }
        }
      }
    );

    // Forward reconnection events
    this.reconnectionHandler.on('reconnecting', (data: unknown) => {
      this.roomManager.emit('reconnecting', data);
    });

    this.reconnectionHandler.on('succeeded', (_data: unknown) => {
      this.roomManager.emit('reconnected', { message: 'Reconnected to game' });
    });

    this.reconnectionHandler.on('failed', (data: unknown) => {
      this.roomManager.emit('reconnectionFailed', data);
    });

    // Forward connection quality changes
    this.connectionMonitor.on('qualityChange', (data: unknown) => {
      this.roomManager.emit('connectionQualityChange', data);
    });
  }

  /**
   * Expose playerId for backward compatibility
   */
  get playerId(): string | null {
    return this.roomManager.playerId;
  }

  /**
   * Connect to the server
   */
  async connect(serverUrl: string): Promise<boolean> {
    const success = await this.connectionManager.connect(serverUrl);
    if (success) {
      this.connectionMonitor.setQuality('good');
      this.roomManager.emit('connectionChange', {
        quality: 'good',
        connected: true,
      });
    } else {
      this.connectionMonitor.setQuality('offline');
      this.roomManager.emit('connectionChange', {
        quality: 'offline',
        connected: false,
      });
    }
    return success;
  }

  /**
   * Create a new room
   */
  async createRoom(playerName: string): Promise<Room | null> {
    const client = this.connectionManager.getClient();
    if (!client) {
      console.error('NetworkManager: Not connected to server');
      return null;
    }

    const room = await this.roomManager.createRoom(client, playerName);
    if (room) {
      this.reconnectionHandler.saveToken(room.reconnectionToken);
      this.connectionMonitor.start(() => {
        // Record activity on state changes
        if (room.state) {
          const originalOnChange = room.state.onChange || (() => {});
          room.state.onChange = () => {
            this.connectionMonitor.recordActivity();
            originalOnChange();
          };
        }
      });
    }
    return room;
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomCode: string, playerName: string): Promise<Room | null> {
    const client = this.connectionManager.getClient();
    if (!client) {
      console.error('NetworkManager: Not connected to server');
      return null;
    }

    try {
      const room = await this.roomManager.joinRoom(
        client,
        roomCode,
        playerName
      );
      if (room) {
        this.reconnectionHandler.saveToken(room.reconnectionToken);
        this.connectionMonitor.start(() => {
          // Record activity on state changes
          if (room.state) {
            const originalOnChange = room.state.onChange || (() => {});
            room.state.onChange = () => {
              this.connectionMonitor.recordActivity();
              originalOnChange();
            };
          }
        });
      }
      return room;
    } catch (error) {
      console.error('NetworkManager: Failed to join room', error);
      throw error;
    }
  }

  /**
   * Get the room instance
   */
  getRoom(): Room | null {
    return this.roomManager.getRoom();
  }

  /**
   * Get room state (for direct access by game mode)
   */
  getState(): unknown {
    return this.roomManager.getRoom()?.state || null;
  }

  /**
   * Get room code
   */
  getRoomCode(): string | null {
    return this.roomManager.getRoomCode();
  }

  /**
   * Get players list (for lobby)
   */
  getPlayers() {
    return this.roomManager.getPlayers();
  }

  /**
   * Send ready message
   */
  sendReady(): void {
    this.roomManager.send('ready');
  }

  /**
   * Send bid
   */
  sendBid(bid: number): void {
    this.roomManager.send('bid', { bid });
  }

  /**
   * Send play card
   */
  sendPlayCard(cardId: string): void {
    this.roomManager.send('playCard', { cardId });
  }

  /**
   * Send next round
   */
  sendNextRound(): void {
    this.roomManager.send('nextRound');
  }

  /**
   * Send restart
   */
  sendRestart(): void {
    this.roomManager.send('restart');
  }

  /**
   * Send reaction
   */
  sendReaction(reactionType: string): void {
    this.roomManager.send('reaction', { type: reactionType });
  }

  /**
   * Send chat message
   */
  sendChat(message: string): void {
    if (!message || message.trim().length === 0) {
      console.warn('NetworkManager: Cannot send empty chat message');
      return;
    }
    this.roomManager.send('chat', { message: message.trim() });
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    await this.roomManager.leave();
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.connectionMonitor.stop();
    this.reconnectionHandler.reset();
    this.roomManager.leave();
    this.connectionManager.disconnect();
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  /**
   * Check if in a room
   */
  isInRoom(): boolean {
    return this.roomManager.isInRoom();
  }

  /**
   * Get connection quality
   */
  getConnectionQuality(): ConnectionQuality {
    return this.connectionMonitor.getQuality();
  }

  /**
   * Check if currently reconnecting
   */
  isReconnecting(): boolean {
    return this.reconnectionHandler.isReconnecting();
  }

  /**
   * Event methods - delegate to room manager
   */
  on(event: string, callback: (data?: unknown) => void): void {
    this.roomManager.on(event, callback);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.roomManager.removeAllListeners(event);
    } else {
      this.roomManager.removeAllListeners();
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.connectionMonitor.destroy();
    this.reconnectionHandler.destroy();
    this.roomManager.destroy();
  }
}
