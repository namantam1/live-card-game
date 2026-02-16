import { BaseMode } from './BaseMode';
import type { BaseGame } from '../games/BaseGame';
import { ServiceLocator } from '../core/ServiceLocator';
import type { EventBus } from '../services/EventBus';
import type { NetworkService } from '../services/NetworkService';
import type { CardData, PlayerData, GameState } from '../type.d';

/**
 * Multiplayer mode using NetworkService and EventBus
 * NO direct Colyseus coupling - subscribes to events only
 */
export class MultiplayerMode extends BaseMode {
  readonly id = 'multiplayer';
  readonly name = 'Multiplayer (Online)';
  readonly requiresNetwork = true;

  private eventBus!: EventBus;
  private networkService!: NetworkService;
  private playerId!: string;

  async initialize(game: BaseGame, _scene?: any, _data?: any): Promise<void> {
    this.game = game;
    this.eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.networkService = ServiceLocator.get<NetworkService>('network');

    const room = this.networkService.getRoom();
    if (!room) {
      throw new Error('Not in a room. Join/create room first.');
    }

    this.playerId = room.sessionId;

    // Subscribe to game events from EventBus
    this.subscribeToGameEvents();
  }

  async cleanup(): Promise<void> {
    // Don't disconnect - NetworkService handles that
    this.removeAllListeners();
  }

  async startGame(): Promise<void> {
    // Server controls game start
  }

  sendMove(card: CardData): void {
    this.networkService.send('playCard', { cardId: card.id });
  }

  sendBid(bid: number): void {
    this.networkService.send('bid', { bid });
  }

  private subscribeToGameEvents(): void {
    // Subscribe to events published by NetworkService
    this.eventBus.onGameEvent('phaseChanged', ({ phase }) => {
      this.emit('phaseChanged', phase);
    });

    this.eventBus.onGameEvent('turnChanged', ({ playerId }) => {
      this.emit('turnChanged', { playerId });
    });

    this.eventBus.onGameEvent('cardPlayed', ({ playerId, card }) => {
      this.emit('cardPlayed', { playerId, card });
    });

    this.eventBus.onGameEvent('bidPlaced', ({ playerId, bid }) => {
      this.emit('bidPlaced', { playerId, bid });
    });

    this.eventBus.onGameEvent('trickComplete', ({ winnerId }) => {
      this.emit('trickComplete', { winnerId });
    });

    this.eventBus.onGameEvent('reaction', (data) => {
      this.emit('reaction', data);
    });

    this.eventBus.onGameEvent('chatMessage', (data) => {
      this.emit('chatMessage', data);
    });
  }

  getPlayers(): PlayerData[] {
    const room = this.networkService.getRoom();
    if (!room?.state?.players) return [];

    const players: PlayerData[] = [];
    room.state.players.forEach((player: any) => {
      players.push({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        seatIndex: player.seatIndex,
        isLocal: player.id === this.playerId,
        bid: player.bid,
        tricksWon: player.tricksWon,
        score: player.score,
        roundScore: player.roundScore,
        isBot: player.isBot,
        isReady: player.isReady,
        isConnected: player.isConnected,
      });
    });

    return players.sort((a, b) => a.seatIndex - b.seatIndex);
  }

  getCurrentPlayer(): PlayerData | null {
    return this.getPlayers().find((p) => p.isLocal) || null;
  }

  getGameState(): GameState {
    const room = this.networkService.getRoom();
    return {
      phase: room?.state.phase || 'waiting',
      currentRound: room?.state.currentRound || 1,
      currentTurn: room?.state.currentTurn,
      leadSuit: room?.state.leadSuit,
      trickNumber: room?.state.trickNumber || 0,
      currentTrick: this.getCurrentTrick(),
      players: this.getPlayers(),
      currentPlayer: this.getCurrentPlayer()!,
    };
  }

  private getCurrentTrick(): any[] {
    const room = this.networkService.getRoom();
    if (!room?.state.currentTrick) return [];

    return Array.from(room.state.currentTrick).map((entry: any) => ({
      playerIndex: entry.playerId,
      card: {
        id: entry.card.id,
        suit: entry.card.suit,
        rank: entry.card.rank,
        value: entry.card.value,
      },
    }));
  }
}
