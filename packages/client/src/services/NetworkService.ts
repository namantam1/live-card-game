import { Client, Room, getStateCallbacks } from '@colyseus/sdk';
import { ServiceLocator } from '../core/ServiceLocator';
import type { EventBus } from './EventBus';
import type { ConnectionQuality } from '../type.d';

/**
 * Network service - manages Colyseus connection
 * Absorbs: ConnectionManager, RoomManager, ConnectionMonitor, ReconnectionHandler, NetworkManager
 *
 * Responsibilities:
 *   - Server connection lifecycle
 *   - Room create/join/leave
 *   - Publish ALL room events to EventBus (no direct coupling)
 *   - Connection quality monitoring (heartbeat-based)
 *   - Automatic reconnection with exponential backoff
 *
 * NO game logic, NO scene coupling
 */
export class NetworkService {
  private client: Client | null = null;
  private room: Room | null = null;
  private eventBus!: EventBus;

  // Reconnection state
  private reconnectionToken: string | null = null;
  private reconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectBaseDelay = 2000; // ms, exponential backoff

  // Connection monitoring state
  private connectionQuality: ConnectionQuality = 'good';
  private lastActivityTime: number = Date.now();
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private readonly activityTimeout = 5000; // ms

  async initialize(serverUrl: string): Promise<void> {
    this.eventBus = ServiceLocator.get<EventBus>('eventBus');

    try {
      this.client = new Client(serverUrl);
      this.eventBus.publishNetworkEvent('connected');
    } catch (error) {
      this.eventBus.publishNetworkEvent('connectionFailed', { error });
      throw error;
    }
  }

  // ===== Room Operations =====

  async createRoom(
    gameType: string,
    userId: string,
    playerName: string
  ): Promise<Room | null> {
    if (!this.client) throw new Error('Not connected to server');

    try {
      this.room = await this.client.create(gameType, {
        userId,
        name: playerName,
      });
      this.reconnectionToken = this.room.reconnectionToken;
      this.setupRoomEventPublishers();
      this.startConnectionMonitor();
      return this.room;
    } catch (error) {
      this.eventBus.publishLobbyEvent('createRoomFailed', { error });
      return null;
    }
  }

  async joinRoom(
    gameType: string,
    roomCode: string,
    userId: string,
    playerName: string
  ): Promise<Room | null> {
    if (!this.client) throw new Error('Not connected to server');

    try {
      this.room = await this.client.join(gameType, {
        roomCode,
        userId,
        name: playerName,
      });
      this.reconnectionToken = this.room.reconnectionToken;
      this.setupRoomEventPublishers();
      this.startConnectionMonitor();
      return this.room;
    } catch (error) {
      this.eventBus.publishLobbyEvent('joinRoomFailed', { error });
      throw error;
    }
  }

  send(type: string, data?: any): void {
    if (!this.room) {
      console.warn(`NetworkService: Cannot send ${type} - no room`);
      return;
    }
    this.room.send(type, data);
  }

  getRoom(): Room | null {
    return this.room;
  }

  // isConnected(): boolean {
  //   return this.room !== null;
  // }

  isReconnecting(): boolean {
    return this.reconnecting;
  }

  getConnectionQuality(): ConnectionQuality {
    return this.connectionQuality;
  }

  // ===== Connection Monitor (absorbed from ConnectionMonitor.ts) =====

  private startConnectionMonitor(): void {
    this.stopConnectionMonitor();
    this.lastActivityTime = Date.now();
    this.setQuality('good');

    this.monitorInterval = setInterval(() => {
      const elapsed = Date.now() - this.lastActivityTime;

      if (elapsed > this.activityTimeout * 3) {
        this.setQuality('offline');
      } else if (elapsed > this.activityTimeout * 2) {
        this.setQuality('poor');
      } else if (elapsed > this.activityTimeout) {
        this.setQuality('fair');
      } else {
        this.setQuality('good');
      }
    }, 2000);
  }

  private stopConnectionMonitor(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  private setQuality(quality: ConnectionQuality): void {
    if (this.connectionQuality !== quality) {
      this.connectionQuality = quality;
      this.eventBus.publishNetworkEvent('connectionQualityChange', {
        quality,
        connected: quality !== 'offline',
      });
    }
  }

  // ===== Automatic Reconnection (absorbed from ReconnectionHandler.ts) =====

  private async handleUnexpectedDisconnect(): Promise<void> {
    if (this.reconnecting || !this.client || !this.reconnectionToken) return;

    this.reconnecting = true;
    this.reconnectAttempts = 0;
    this.stopConnectionMonitor();
    this.setQuality('offline');

    await this.attemptReconnection();
  }

  private async attemptReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.reconnecting = false;
      this.reconnectionToken = null;
      this.eventBus.publishNetworkEvent('reconnectionFailed', {
        message: 'Could not reconnect to the game',
      });
      return;
    }

    this.reconnectAttempts++;
    this.eventBus.publishNetworkEvent('reconnecting', {
      attempt: this.reconnectAttempts,
    });

    try {
      const room = await this.client!.reconnect(this.reconnectionToken!);

      // Success — update state
      this.room = room;
      this.reconnectionToken = room.reconnectionToken;
      this.reconnecting = false;
      this.reconnectAttempts = 0;

      // CRITICAL: Re-attach all room listeners to the NEW room object
      this.setupRoomEventPublishers();
      this.startConnectionMonitor();
      this.setQuality('good');

      this.eventBus.publishNetworkEvent('reconnected', {
        message: 'Reconnected to game',
      });
    } catch (error) {
      // Retry with exponential backoff: 2s, 4s, 8s
      const delay =
        this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1);

      this.reconnectTimer = setTimeout(() => {
        this.attemptReconnection();
      }, delay);
    }
  }

  private cancelReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
    this.reconnectAttempts = 0;
  }

  // ===== Room Event Publishers (absorbed from RoomManager.ts) =====

  /**
   * Setup room listeners — ONLY publish to EventBus.
   * Any component can subscribe to what they need.
   *
   * IMPORTANT: Called after initial join AND after reconnection
   */
  private setupRoomEventPublishers(): void {
    if (!this.room) return;

    const $ = getStateCallbacks(this.room);

    // Record activity on ANY state change (for connection monitor)
    this.room.onStateChange(() => {
      this.recordActivity();
    });

    // Game state changes
    $(this.room.state).listen('phase', (value: string) => {
      this.eventBus.publishGameEvent('phaseChanged', { phase: value });
    });

    $(this.room.state).listen('currentTurn', (playerId: string) => {
      this.eventBus.publishGameEvent('turnChanged', { playerId });
    });

    $(this.room.state).listen('trickWinner', (winnerId: string) => {
      this.eventBus.publishGameEvent('trickComplete', { winnerId });
    });

    $(this.room.state).listen('currentRound', (round: number) => {
      this.eventBus.publishGameEvent('roundChanged', { round });
    });

    $(this.room.state).listen('leadSuit', (suit: string) => {
      this.eventBus.publishGameEvent('leadSuitChanged', { suit });
    });

    // Current trick
    $(this.room.state).currentTrick.onAdd((entry: any) => {
      this.eventBus.publishGameEvent('cardPlayed', {
        playerId: entry.playerId,
        card: entry.card,
      });
    });

    $(this.room.state).currentTrick.onRemove(() => {
      this.eventBus.publishGameEvent('trickCleared');
    });

    // Lobby events
    $(this.room.state).players.onAdd((player: any) => {
      this.eventBus.publishLobbyEvent('playerJoined', { player });

      $(player).listen('bid', (bid: number) => {
        this.eventBus.publishGameEvent('bidPlaced', {
          playerId: player.id,
          bid,
        });
      });

      $(player).listen('isReady', (isReady: boolean) => {
        this.eventBus.publishLobbyEvent('playerReady', {
          playerId: player.id,
          isReady,
        });
      });

      $(player).listen('isConnected', (isConnected: boolean) => {
        this.eventBus.publishLobbyEvent('playerConnectionChanged', {
          playerId: player.id,
          isConnected,
        });
      });
    });

    $(this.room.state).players.onRemove((player: any) => {
      this.eventBus.publishLobbyEvent('playerRemoved', { player });
    });

    // Network messages
    this.room.onMessage('seated', (data) => {
      this.eventBus.publishLobbyEvent('seated', data);
    });

    this.room.onMessage('dealt', () => {
      this.eventBus.publishGameEvent('dealt');
    });

    this.room.onMessage('playerReaction', (data) => {
      this.eventBus.publishGameEvent('reaction', data);
    });

    this.room.onMessage('chatMessage', (data) => {
      this.eventBus.publishGameEvent('chatMessage', data);
    });

    this.room.onMessage('chatError', (data) => {
      this.eventBus.publishGameEvent('chatError', data);
    });

    this.room.onMessage('playerLeft', (data) => {
      this.eventBus.publishLobbyEvent('playerLeft', data);
    });

    // Connection events
    this.room.onError((code, message) => {
      this.eventBus.publishNetworkEvent('error', {
        code,
        message: message ?? 'Unknown error',
      });
    });

    // CRITICAL: Handle unexpected disconnect → auto-reconnect
    this.room.onLeave((code) => {
      const wasUnexpected = code !== 1000 && code !== 4000;
      this.eventBus.publishNetworkEvent('disconnected', {
        code,
        wasUnexpected,
      });

      if (wasUnexpected) {
        this.handleUnexpectedDisconnect();
      } else {
        this.stopConnectionMonitor();
        this.cleanupRoom();
      }
    });
  }

  // ===== Cleanup =====

  private cleanupRoom(): void {
    this.room = null;
    this.reconnectionToken = null;
  }

  disconnect(): void {
    this.cancelReconnection();
    this.stopConnectionMonitor();
    this.room?.leave();
    this.cleanupRoom();
  }

  destroy(): void {
    this.disconnect();
    this.client = null;
  }
}
