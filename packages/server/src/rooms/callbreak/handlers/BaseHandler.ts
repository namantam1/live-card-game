import type { Client } from 'colyseus';
import type { CallBreakRoom } from '../CallBreakRoom.js';

/**
 * Base handler class for organizing room message handlers
 * Each handler focuses on a specific domain (chat, reactions, bot AI, etc.)
 */
export abstract class BaseHandler {
  constructor(protected room: CallBreakRoom) {}

  /**
   * Register message handlers for this domain
   * Called during room onCreate
   */
  abstract registerMessages(): void;

  /**
   * Optional cleanup when handler is disposed
   */
  dispose(): void {
    // Override if cleanup needed
  }

  /**
   * Helper to get a player safely
   */
  protected getPlayer(clientOrId: Client | string) {
    const id =
      typeof clientOrId === 'string' ? clientOrId : clientOrId.sessionId;
    return this.room.state.players.get(id);
  }

  /**
   * Helper to broadcast to all clients
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected broadcast(type: string, data?: any, options?: any): void {
    this.room.broadcast(type, data, options);
  }

  /**
   * Helper to send to specific client
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected send(client: Client, type: string, data?: any): void {
    client.send(type, data);
  }
}
