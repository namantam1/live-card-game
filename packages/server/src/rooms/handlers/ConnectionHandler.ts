import { CloseCode, type Client } from 'colyseus';
import { BaseHandler } from './BaseHandler.js';
import { Player } from '../GameState.js';

interface JoinOptions {
  name?: string;
  roomCode?: string;
}

export const EMOJIS = ['😎', '🤖', '🦊', '🐱'];
const RECONNECTION_TIMEOUT = 60; // seconds

/**
 * Handles player connections, disconnections, and reconnections
 * Manages player lifecycle and room occupancy
 */
export class ConnectionHandler extends BaseHandler {
  registerMessages(): void {
    // Connection handlers are registered via Colyseus lifecycle methods
    // (onJoin, onLeave) not via onMessage
  }

  /**
   * Handle player joining the room
   * Called from CallBreakRoom.onJoin()
   */
  handleJoin(client: Client, options: JoinOptions): void {
    // Validate room code if provided (for join attempts, not create)
    if (options.roomCode && options.roomCode !== this.room.state.roomCode) {
      throw new Error(
        `Invalid room code. Room code is ${this.room.state.roomCode}, but got ${options.roomCode}`
      );
    }

    // Check if room is full (defensive check, Colyseus should handle this)
    if (this.room.state.players.size >= this.room.maxClients) {
      throw new Error('Room is full');
    }

    // Validate player name
    const name =
      options.name?.trim() || `Player ${this.room.state.players.size + 1}`;
    if (name.length === 0) {
      throw new Error('Player name cannot be empty');
    }
    if (name.length > 20) {
      throw new Error('Player name too long (max 20 characters)');
    }

    const seatIndex = this.room.state.players.size;

    const player = new Player();
    player.id = client.sessionId;
    player.name = name;
    player.emoji = EMOJIS[seatIndex];
    player.seatIndex = seatIndex;

    this.room.state.players.set(client.sessionId, player);
    this.room.state.playerOrder.push(client.sessionId);

    console.log(
      `${name} joined room ${this.room.state.roomCode} (seat ${seatIndex})`
    );

    // Notify client of their seat
    this.send(client, 'seated', {
      seatIndex,
      roomCode: this.room.state.roomCode,
    });
  }

  /**
   * Handle player leaving the room
   * Called from CallBreakRoom.onLeave()
   */
  async handleLeave(client: Client, code: number): Promise<void> {
    const consented = code === CloseCode.CONSENTED;
    const player = this.getPlayer(client);

    if (!player) return;

    player.isConnected = false;
    console.log(
      `${player.name} disconnected (code: ${code}, consented: ${consented})`
    );

    // If player intentionally left (consented), remove them immediately
    if (consented) {
      await this.handleConsentedLeave(client, player.name);
      return;
    }

    // Handle unintentional disconnect with reconnection window
    await this.handleUnexpectedDisconnect(client, player.name);
  }

  /**
   * Handle intentional player departure
   */
  private async handleConsentedLeave(
    client: Client,
    playerName: string
  ): Promise<void> {
    console.log(`${playerName} left intentionally`);
    this.room.state.players.delete(client.sessionId);
    const orderIndex = this.room.state.playerOrder.indexOf(client.sessionId);
    if (orderIndex !== -1) {
      this.room.state.playerOrder.splice(orderIndex, 1);
    }
    if (this.room.state.phase !== 'waiting') {
      this.broadcast('playerLeft', { name: playerName });
    }

    // If we're in active gameplay and all human players left, end the room
    if (this.shouldEndRoom()) {
      console.log('All human players left, ending room');
      await this.room.disconnect();
    }
  }

  /**
   * Handle unexpected disconnect with reconnection window
   */
  private async handleUnexpectedDisconnect(
    client: Client,
    playerName: string
  ): Promise<void> {
    try {
      // Allow reconnection within timeout for unintentional disconnects
      console.log(
        `${playerName} disconnected unexpectedly. Allowing ${RECONNECTION_TIMEOUT}s for reconnection...`
      );
      await this.room.allowReconnection(client, RECONNECTION_TIMEOUT);

      const player = this.getPlayer(client);
      if (player) {
        player.isConnected = true;
        console.log(`${playerName} reconnected successfully`);

        // Notify player they've reconnected
        this.send(client, 'reconnected', {
          message: 'Successfully reconnected',
          roomCode: this.room.state.roomCode,
        });

        // Broadcast to other players
        this.broadcast(
          'playerReconnected',
          {
            playerId: client.sessionId,
            name: playerName,
          },
          { except: client }
        );
      }
    } catch (e) {
      // Player didn't reconnect, handle game state
      console.warn(`${playerName} failed to reconnect within timeout: ${e}`);
      if (this.room.state.phase !== 'waiting') {
        this.broadcast('playerLeft', { name: playerName });
      }

      // If all human players are gone, end the room
      if (this.shouldEndRoom()) {
        console.log('All human players disconnected, ending room');
        await this.room.disconnect();
      }
    }
  }

  /**
   * Check if room should be ended (no human players remaining)
   */
  private shouldEndRoom(): boolean {
    const remainingHumans = Array.from(this.room.state.players.values()).filter(
      (p) => !p.isBot && p.isConnected
    );
    return remainingHumans.length === 0 && this.room.state.phase !== 'waiting';
  }
}
