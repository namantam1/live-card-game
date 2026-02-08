import type { Client } from 'colyseus';
import { BaseHandler } from './BaseHandler.js';
import {
  decideBotReaction,
  type ReactionType,
  type Suit,
} from '@call-break/shared';

interface ReactionData {
  type: ReactionType;
}

/**
 * Handles player reactions (emojis) and bot reaction AI
 * Manages both human-triggered and bot-triggered reactions
 */
export class ReactionHandler extends BaseHandler {
  registerMessages(): void {
    this.room.onMessage('reaction', (client, data: ReactionData) =>
      this.handleReaction(client, data)
    );
  }

  private handleReaction(client: Client, data: ReactionData): void {
    const player = this.getPlayer(client);
    if (!player) {
      console.warn('Reaction from unknown player:', client.sessionId);
      return;
    }

    // Broadcast reaction to all other players
    this.broadcast(
      'playerReaction',
      {
        playerId: client.sessionId,
        playerName: player.name,
        seatIndex: player.seatIndex,
        type: data.type,
        timestamp: Date.now(),
      },
      { except: client }
    );

    console.log(
      `${player.name} sent reaction: ${data.type} in room ${this.room.state.roomCode}`
    );
  }

  /**
   * Trigger bot reactions after a trick is completed
   */
  triggerBotTrickReactions(winnerId: string): void {
    this.room.state.players.forEach((player, playerId) => {
      if (!player.isBot) return;

      const wonTrick = playerId === winnerId;
      const reaction = decideBotReaction({
        event: wonTrick ? 'trickWon' : 'trickLost',
        botTricksWon: player.tricksWon,
        botBid: player.bid,
        trumpSuit: this.room.state.trumpSuit as Suit,
      });

      if (reaction) {
        // Stagger bot reactions for realism
        const delay = player.seatIndex * 200;
        this.room.clock.setTimeout(() => {
          this.broadcast('playerReaction', {
            playerId: playerId,
            playerName: player.name,
            seatIndex: player.seatIndex,
            type: reaction,
            timestamp: Date.now(),
          });
          console.log(`${player.name} (bot) reacted: ${reaction}`);
        }, delay);
      }
    });
  }

  /**
   * Trigger bot reactions at the end of a round
   */
  triggerBotRoundEndReactions(): void {
    this.room.state.players.forEach((player) => {
      if (!player.isBot) return;

      const reaction = decideBotReaction({
        event: 'roundEnd',
        botTricksWon: player.tricksWon,
        botBid: player.bid,
        trumpSuit: this.room.state.trumpSuit as Suit,
      });

      if (reaction) {
        // Stagger bot reactions for realism
        const delay = player.seatIndex * 300;
        this.room.clock.setTimeout(() => {
          this.broadcast('playerReaction', {
            playerId: player.id,
            playerName: player.name,
            seatIndex: player.seatIndex,
            type: reaction,
            timestamp: Date.now(),
          });
          console.log(`${player.name} (bot) reacted at round end: ${reaction}`);
        }, delay);
      }
    });
  }
}
