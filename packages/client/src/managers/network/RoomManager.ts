import { Client, Room, getStateCallbacks } from '@colyseus/sdk';
import Phaser from 'phaser';
import type { PlayerData, PlayerSchema } from '../../type';

/**
 * RoomManager - Handles Colyseus room operations
 * Single Responsibility: Manage room lifecycle and expose room events
 * Emits lobby-related events but not game-specific events
 */
export default class RoomManager extends Phaser.Events.EventEmitter {
  private room: Room | null = null;
  private roomCode: string | null = null;
  private seatIndex: number = -1;
  public playerId: string | null = null;

  constructor() {
    super();
  }

  /**
   * Create a new room
   */
  async createRoom(client: Client, playerName: string): Promise<Room | null> {
    if (!client) {
      console.error('RoomManager: Client not provided');
      return null;
    }

    try {
      this.room = await client.create('call_break', { name: playerName });
      this.playerId = this.room.sessionId;
      this.setupRoomListeners();
      return this.room;
    } catch (error) {
      console.error('RoomManager: Failed to create room', error);
      return null;
    }
  }

  /**
   * Join an existing room
   */
  async joinRoom(
    client: Client,
    roomCode: string,
    playerName: string
  ): Promise<Room | null> {
    if (!client) {
      console.error('RoomManager: Client not provided');
      return null;
    }

    try {
      this.room = await client.join('call_break', {
        name: playerName,
        roomCode: roomCode,
      });
      this.playerId = this.room.sessionId;
      this.setupRoomListeners();

      console.log('RoomManager: Joined room');
      return this.room;
    } catch (error) {
      console.error('RoomManager: Failed to join room', error);
      throw error;
    }
  }

  /**
   * Setup raw room listeners - expose events without interpretation
   * Game logic should be handled by the game mode, not here
   */
  private setupRoomListeners(): void {
    if (!this.room) return;

    // Expose room events directly
    const room = this.room;

    // Room messages - forward as-is
    room.onMessage(
      'seated',
      (data: { seatIndex: number; roomCode: string }) => {
        this.seatIndex = data.seatIndex;
        this.roomCode = data.roomCode;
        // console.log(
        //   `RoomManager: Seated at ${this.seatIndex}, room code: ${this.roomCode}`
        // );
        this.emit('message:seated', data);
      }
    );

    room.onMessage('dealt', () => {
      this.emit('message:dealt');
    });

    room.onMessage('playerLeft', (data: { name: string }) => {
      this.emit('message:playerLeft', data);
    });

    room.onMessage('playerReaction', (data: unknown) => {
      this.emit('message:playerReaction', data);
    });

    room.onMessage('chatMessage', (data: unknown) => {
      this.emit('message:chatMessage', data);
    });

    room.onMessage('chatError', (data: { error: string }) => {
      this.emit('message:chatError', data);
    });

    // Room state changes - expose raw state object
    // Let the game mode interpret what these mean
    room.onStateChange((state) => {
      this.emit('stateChange', state);
    });

    // Setup lobby-specific state listeners
    this.setupLobbyListeners();

    // Error handling
    room.onError((code: number, message?: string) => {
      console.error(`RoomManager: Room error ${code}: ${message}`);
      this.emit('error', { code, message });
    });

    // Leave handling
    room.onLeave((code: number) => {
      console.log(`RoomManager: Left room with code ${code}`);

      // Emit leave event with code and whether it was unexpected
      const wasUnexpected = code !== 1000 && code !== 4000;
      this.emit('leave', { code, wasUnexpected });

      // Clean up on clean disconnect
      if (!wasUnexpected) {
        this.cleanup();
      }
    });
  }

  /**
   * Setup lobby-specific state listeners
   * These are needed for LobbyScene to work properly
   */
  private setupLobbyListeners(): void {
    if (!this.room) return;

    const $ = getStateCallbacks(this.room);

    // Listen to player additions (for lobby player list)
    $(this.room.state).players.onAdd((player: PlayerSchema) => {
      // console.log(`RoomManager: Player ${player.name} joined`);
      this.emit('playerJoined', { player, playerId: player.id });

      // Listen to player ready status changes
      $(player).listen('isReady', (value: boolean) => {
        this.emit('playerReady', { playerId: player.id, isReady: value });
      });
    });

    // Listen to player removals (for lobby player list)
    $(this.room.state).players.onRemove((player: PlayerSchema) => {
      console.log(`RoomManager: Player ${player.name} removed`);
      this.emit('playerRemoved', { player, playerId: player.id });
    });

    // Listen to phase changes (to start game from lobby)
    $(this.room.state).listen('phase', (value: string) => {
      // console.log(`RoomManager: Phase changed to ${value}`);
      this.emit('phaseChange', { phase: value });
    });
  }

  /**
   * Send a message to the room
   */
  send(type: string, data?: unknown): void {
    if (!this.room) {
      console.warn(`RoomManager: Cannot send ${type} - not in a room`);
      return;
    }
    this.room.send(type, data);
    console.log(`RoomManager: Sent ${type}`, data ? `with data` : '');
  }

  /**
   * Leave the current room
   */
  async leave(): Promise<void> {
    if (this.room) {
      await this.room.leave();
      this.cleanup();
    }
  }

  /**
   * Cleanup room state
   */
  private cleanup(): void {
    this.room = null;
    this.roomCode = null;
    this.seatIndex = -1;
    this.playerId = null;
  }

  /**
   * Update room reference (used after reconnection)
   */
  updateRoom(room: Room): void {
    this.room = room;
    this.playerId = room.sessionId;
    this.setupRoomListeners();
  }

  /**
   * Get players list (for lobby)
   */
  getPlayers(): PlayerData[] {
    if (!this.room || !this.room.state || !this.room.state.players) return [];
    const players: PlayerData[] = [];
    this.room.state.players.forEach((player: PlayerSchema) => {
      players.push({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        seatIndex: player.seatIndex,
        isReady: player.isReady,
        isConnected: player.isConnected,
        isBot: player.isBot,
        bid: player.bid,
        tricksWon: player.tricksWon,
        score: player.score,
        roundScore: player.roundScore,
        isLocal: player.id === this.playerId,
      });
    });
    return players.sort((a, b) => a.seatIndex - b.seatIndex);
  }

  /**
   * Get the current room
   */
  getRoom(): Room | null {
    return this.room;
  }

  /**
   * Get room code
   */
  getRoomCode(): string | null {
    return this.roomCode;
  }

  /**
   * Get seat index
   */
  getSeatIndex(): number {
    return this.seatIndex;
  }

  /**
   * Check if in a room
   */
  isInRoom(): boolean {
    return this.room !== null;
  }

  /**
   * Get reconnection token
   */
  getReconnectionToken(): string | null {
    return this.room?.reconnectionToken || null;
  }

  /**
   * Cleanup resources
   */
  override destroy(): void {
    this.cleanup();
    this.removeAllListeners();
  }
}
