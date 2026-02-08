import type { Client } from 'colyseus';
import { BaseHandler } from './BaseHandler.js';
import type { ChatMessage } from '@call-break/shared';

interface ChatData {
  message: string;
}

const MAX_MESSAGE_LENGTH = 200;
const MIN_MESSAGE_LENGTH = 1;

/**
 * Handles chat messaging between players
 * Validates messages and broadcasts to all clients
 */
export class ChatHandler extends BaseHandler {
  registerMessages(): void {
    this.room.onMessage('chat', (client, data: ChatData) =>
      this.handleChat(client, data)
    );
  }

  private handleChat(client: Client, data: ChatData): void {
    const player = this.getPlayer(client);
    if (!player) {
      console.warn('Chat from unknown player:', client.sessionId);
      return;
    }

    // Validate message
    const message = data.message?.trim();
    if (!message) {
      console.warn(`Empty message from ${player.name}`);
      return;
    }

    if (message.length < MIN_MESSAGE_LENGTH) {
      console.warn(`Message too short from ${player.name}`);
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      console.warn(`Message too long from ${player.name}`);
      this.send(client, 'chatError', {
        error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
      });
      return;
    }

    // Sanitize message (basic XSS prevention)
    const sanitizedMessage = this.sanitizeMessage(message);

    // Create chat message
    const chatMessage: ChatMessage = {
      id: `${client.sessionId}_${Date.now()}`,
      playerId: client.sessionId,
      playerName: player.name,
      seatIndex: player.seatIndex,
      message: sanitizedMessage,
      timestamp: Date.now(),
      isBot: player.isBot,
    };

    // Broadcast to all players
    this.broadcast('chatMessage', chatMessage);

    console.log(
      `[Chat] ${player.name}: ${sanitizedMessage.substring(0, 50)}${sanitizedMessage.length > 50 ? '...' : ''}`
    );
  }

  /**
   * Basic message sanitization
   * Prevents common XSS patterns
   */
  private sanitizeMessage(message: string): string {
    return message
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Broadcast a system message (e.g., "Player joined")
   */
  broadcastSystemMessage(message: string): void {
    const systemMessage: ChatMessage = {
      id: `system_${Date.now()}`,
      playerId: 'system',
      playerName: 'System',
      seatIndex: -1,
      message,
      timestamp: Date.now(),
      isBot: false,
    };

    this.broadcast('chatMessage', systemMessage);
  }
}
