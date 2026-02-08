import type { Scene } from 'phaser';
import { GameModeBase, type PlayerData } from './GameModeBase';
import NetworkManager from '../managers/NetworkManager';
import Player from '../objects/Player';
import type TrickArea from '../objects/TrickArea';
import type {
  CardData,
  CardSchema,
  PlayerSchema,
  ReactionData,
  TrickEntrySchema,
} from '../type';
import { EVENTS } from '../utils/constants';
import { calculateBid, TRUMP_SUIT } from '@call-break/shared';
import { getStateCallbacks } from '@colyseus/sdk';

/**
 * Multiplayer game mode implementation (via Colyseus)
 * Handles game logic interpretation and delegates networking to NetworkManager
 */
export default class MultiplayerGameMode extends GameModeBase {
  private networkManager!: NetworkManager;
  private scene!: Scene;
  private players: Player[] = [];
  private trickArea!: TrickArea;

  override async initialize(scene: Scene, data: any): Promise<void> {
    this.scene = scene;
    this.trickArea = data.trickArea;
    this.networkManager = data.networkManager;

    if (!this.networkManager) {
      throw new Error('NetworkManager required for multiplayer mode');
    }

    // Create players from network state
    this.players = this.createPlayers(scene);

    // Setup network event listeners
    this.setupNetworkListeners();

    // Sync initial hand state from server
    this.syncHandFromServer();
  }

  override createPlayers(scene: Scene): Player[] {
    const players: Player[] = [];
    const room = this.networkManager.getRoom();
    if (!room || !room.state) return players;

    const localId = this.networkManager.playerId;
    const networkPlayers: {
      id: string;
      name: string;
      emoji: string;
      seatIndex: number;
    }[] = [];

    // Get players from room state
    room.state.players.forEach((player: PlayerSchema, sessionId: string) => {
      networkPlayers.push({
        id: sessionId,
        name: player.name,
        emoji: player.emoji,
        seatIndex: player.seatIndex,
      });
    });

    // Find local player's seat index
    const localPlayer = networkPlayers.find((p) => p.id === localId);
    const localSeatIndex = localPlayer ? localPlayer.seatIndex : 0;

    // Create player objects with relative positioning
    // Local player should always be at position 0 (bottom)
    networkPlayers.forEach((netPlayer) => {
      const isLocal = netPlayer.id === localId;

      // Calculate relative position: local player at 0 (bottom), others clockwise
      const relativePosition = (netPlayer.seatIndex - localSeatIndex + 4) % 4;

      const player = new Player(
        scene,
        relativePosition,
        netPlayer.name,
        netPlayer.emoji,
        isLocal, // isHuman = isLocal in multiplayer
        isLocal
          ? (cardData: CardData) => this.onCardPlayed(cardData)
          : undefined
      );
      players.push(player);

      // Store network ID and absolute seat index for server communication
      player.networkId = netPlayer.id;
      player.absoluteSeatIndex = netPlayer.seatIndex;
    });

    // Sort players by relative position for consistent array indexing
    // This ensures players[0] is always local player (bottom)
    players.sort((a, b) => a.index - b.index);

    return players;
  }

  override async startGame(): Promise<void> {
    // In multiplayer, game is started by server
    // Just sync state
    await this.syncHandFromServer();

    // Emit initial connection quality to show network indicator
    // (Done here after all listeners are registered in GameScene)
    const initialQuality = this.networkManager.getConnectionQuality();
    this.emit(EVENTS.CONNECTION_QUALITY_CHANGED, {
      quality: initialQuality,
      connected: this.networkManager.isConnected(),
    });
  }

  override async cleanup(): Promise<void> {
    // Leave room first to properly disconnect
    if (this.networkManager.isInRoom()) {
      await this.networkManager.leaveRoom();
    }

    // Clean up network listeners
    this.networkManager.removeAllListeners();
    this.removeAllListeners();
  }

  override getPlayers(): PlayerData[] {
    const room = this.networkManager.getRoom();
    if (!room || !room.state || !room.state.players) return [];

    const players: PlayerData[] = [];
    room.state.players.forEach((player: PlayerSchema, sessionId: string) => {
      players.push({
        name: player.name,
        emoji: player.emoji,
        bid: player.bid,
        tricksWon: player.tricksWon,
        score: player.score,
        roundScore: player.roundScore,
        isHuman: sessionId === this.networkManager.playerId,
        isLocal: sessionId === this.networkManager.playerId,
        id: sessionId,
      });
    });
    return players.sort((a, b) => {
      const aPlayer = room.state.players.get(a.id as string);
      const bPlayer = room.state.players.get(b.id as string);
      return (aPlayer?.seatIndex || 0) - (bPlayer?.seatIndex || 0);
    });
  }

  override getLocalPlayer(): PlayerData | null {
    // In multiplayer mode, local player is identified by networkId
    const players = this.getPlayers();
    return players.find((p) => p.isLocal) || null;
  }

  override getRecommendedBid(): number | undefined {
    const room = this.networkManager.getRoom();
    if (!room) return undefined;

    const player = room.state.players.get(this.networkManager.playerId || '');
    if (!player || !player.hand || player.hand.length === 0) return undefined;

    const hand = Array.from(player.hand).map((c) =>
      this.cardToObject(c as CardSchema)
    );
    return calculateBid(hand, TRUMP_SUIT);
  }

  override getCurrentRound(): number {
    const state = this.networkManager.getState() as any;
    return state?.currentRound || 1;
  }

  override getPhase(): string {
    const state = this.networkManager.getState() as any;
    return state?.phase || 'waiting';
  }

  override onBidSelected(bid: number): void {
    this.networkManager.sendBid(bid);
  }

  override onCardPlayed(cardData: CardData): void {
    this.networkManager.sendPlayCard(cardData.id);
  }

  override continueToNextRound(): void {
    this.networkManager.sendNextRound();
  }

  override async restartGame(): Promise<void> {
    this.trickArea?.clear();
    this.networkManager.sendRestart();
  }

  override async returnToMenu(): Promise<void> {
    // Cleanup will handle leaving the room
    await this.cleanup();
  }

  override sendReaction(reactionType: string): void {
    // Send to server (will broadcast to others)
    this.networkManager.sendReaction(reactionType);

    // Show reaction locally for immediate feedback
    const localPlayer = this.players.find(
      (p) => p.networkId === this.networkManager.playerId
    );
    if (localPlayer) {
      localPlayer.showReaction(reactionType);
    }
  }

  override sendChat(message: string): void {
    // Send to server (will broadcast to all including self)
    this.networkManager.sendChat(message);
  }

  /**
   * Setup network event listeners directly on the room
   * This class handles ALL game logic interpretation
   */
  private setupNetworkListeners(): void {
    const room = this.networkManager.getRoom();
    if (!room) return;

    // Get state callbacks proxy (Colyseus 0.17.x recommended pattern)
    const $ = getStateCallbacks(room);

    // Listen to room messages (non-game-logic events)
    this.networkManager.on('message:seated', (_data?: unknown) => {
      // These are handled by RoomManager already
    });

    this.networkManager.on('message:dealt', () => {
      console.log('MultiplayerGameMode: Cards dealt');
    });

    this.networkManager.on('message:playerLeft', (data?: unknown) => {
      const playerData = data as { name: string };
      console.log(`MultiplayerGameMode: ${playerData.name} left`);
    });

    this.networkManager.on('message:playerReaction', (data?: unknown) => {
      const reactionData = data as ReactionData;
      const player = this.players.find(
        (p) => p.networkId === reactionData.playerId
      );
      if (player) {
        player.showReaction(reactionData.type);
      }
    });

    this.networkManager.on('message:chatMessage', (_data?: unknown) => {
      // Chat messages are handled by UIScene
    });

    this.networkManager.on('message:chatError', (data?: unknown) => {
      const errorData = data as { error: string };
      console.warn(`MultiplayerGameMode: Chat error - ${errorData.error}`);
    });

    // ===== Game State Listeners (using Colyseus $ proxy) =====

    // Phase changes
    $(room.state).listen('phase', (value: string, previousValue: string) => {
      console.log(
        `MultiplayerGameMode: Phase changed from ${previousValue} to ${value}`
      );
      this.emit(EVENTS.PHASE_CHANGED, value);

      if (value === 'roundEnd') {
        const players = this.getPlayers();
        this.emit(EVENTS.ROUND_COMPLETE, {
          players: players.map((p) => ({
            name: p.name,
            emoji: p.emoji,
            bid: p.bid,
            tricksWon: p.tricksWon,
            roundScore: p.roundScore,
            totalScore: p.score,
          })),
        });
      }

      if (value === 'gameOver') {
        const players = this.getPlayers();
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        const winner = sortedPlayers[0];
        this.emit(EVENTS.GAME_COMPLETE, {
          winner: {
            name: winner.name,
            emoji: winner.emoji,
            score: winner.score,
          },
          players: sortedPlayers.map((p) => ({
            name: p.name,
            emoji: p.emoji,
            score: p.score,
          })),
        });
      }
    });

    // Turn changes
    $(room.state).listen('currentTurn', (value: string) => {
      const playerId = value;
      const isMyTurn = value === this.networkManager.playerId;

      // Convert network playerId to local player index
      const playerIndex = this.players.findIndex(
        (p) => p.networkId === playerId
      );

      if (playerIndex === -1) {
        console.warn(`MultiplayerGameMode: Player ${playerId} not found`);
        return;
      }

      this.players.forEach((p, i) => {
        if (i === playerIndex) {
          p.showTurnIndicator();
          if (isMyTurn) {
            // Enable card selection for local player with proper validation
            const leadSuit = room.state.leadSuit || '';
            const currentTrick = this.getCurrentTrick();
            const phase = room.state.phase;
            if (phase === 'playing') {
              p.hand.updatePlayableCards(leadSuit, currentTrick);
            }
          }
        } else {
          p.hideTurnIndicator();
          p.hand.disableAllCards();
        }
      });

      this.emit(EVENTS.TURN_CHANGED, { playerIndex, isMyTurn });
    });

    // Lead suit changed
    $(room.state).listen('leadSuit', (value: string) => {
      if (
        room.state.currentTurn === this.networkManager.playerId &&
        room.state.phase === 'playing'
      ) {
        const localPlayer = this.players.find(
          (p) => p.networkId === this.networkManager.playerId
        );
        if (localPlayer) {
          const currentTrick = this.getCurrentTrick();
          localPlayer.hand.updatePlayableCards(value as any, currentTrick);
        }
      }
    });

    // Trick winner
    $(room.state).listen('trickWinner', (winnerId: string) => {
      if (winnerId) {
        const winner = this.players.find((p) => p.networkId === winnerId);
        if (winner) {
          winner.addTrick();

          if (winner.nameLabel) {
            this.scene.tweens.add({
              targets: winner.nameLabel,
              scaleX: 1.2,
              scaleY: 1.2,
              duration: 200,
              yoyo: true,
            });
          }

          const winnerIndex = this.players.indexOf(winner);
          this.scene.time.delayedCall(1000, () => {
            this.trickArea.collectTrick(winnerIndex, 400);
          });

          this.emit(EVENTS.TRICK_COMPLETE, { winnerIndex });
        }
      }
    });

    // Round change
    $(room.state).listen('currentRound', () => {
      this.players.forEach((player) => {
        player.reset();
      });
    });

    // Player state changes
    $(room.state).players.onAdd((player: PlayerSchema, sessionId: string) => {
      console.log(`MultiplayerGameMode: Player ${player.name} joined`);

      // Listen to player property changes
      $(player).listen('bid', (value: number) => {
        const localPlayer = this.players.find((p) => p.networkId === sessionId);
        if (localPlayer) {
          localPlayer.setBid(value);
          const playerIndex = this.players.indexOf(localPlayer);
          this.emit(EVENTS.BID_PLACED, { playerIndex, bid: value });
        }
      });

      $(player).listen('tricksWon', (_value: number) => {
        // Handled by trickWinner event
      });

      $(player).listen('score', (_value: number) => {
        // Score updates are handled in round/game complete events
      });

      $(player).listen('roundScore', (_value: number) => {
        // Round score updates are handled in round complete events
      });

      $(player).listen('isReady', (_value: boolean) => {
        // Ready state can be used for UI updates if needed
      });

      $(player).listen('isConnected', (value: boolean) => {
        // Connection state updates
        const localPlayer = this.players.find((p) => p.networkId === sessionId);
        if (localPlayer && !value) {
          console.log(
            `MultiplayerGameMode: Player ${player.name} disconnected`
          );
        }
      });

      // Hand changes
      $(player).hand.onAdd((card: CardSchema, _index: number) => {
        if (sessionId === this.networkManager.playerId) {
          // For local player, add the actual card
          const localPlayer = this.players.find(
            (p) => p.networkId === sessionId
          );
          if (localPlayer) {
            localPlayer.hand.addCard(this.cardToObject(card));
          }
        } else {
          // For remote players, update card count
          const remotePlayer = this.players.find(
            (p) => p.networkId === sessionId
          );
          if (remotePlayer) {
            remotePlayer.hand.updateCardCount(player.hand.length);
          }
        }
      });

      $(player).hand.onRemove((_card: CardSchema, _index: number) => {
        // Card removal is handled by cardPlayed event in current trick
      });
    });

    $(room.state).players.onRemove(
      (player: PlayerSchema, _sessionId: string) => {
        console.log(`MultiplayerGameMode: Player ${player.name} removed`);
      }
    );

    // Current trick changes
    $(room.state).currentTrick.onAdd((entry: TrickEntrySchema) => {
      const playerId = entry.playerId;
      const card = this.cardToObject(entry.card);

      console.log(`MultiplayerGameMode: Card played by ${playerId}`);

      // Find player in local array
      let player = this.players.find((p) => p.networkId === playerId);
      let relativePosition;
      let removedCard = null;

      if (player) {
        relativePosition = player.index;

        // Remove card from player's hand for animation
        if (player.networkId === this.networkManager.playerId) {
          // Local player - remove the actual card
          removedCard = player.hand.removeCard(card.id);
        } else {
          // Remote player - remove any placeholder card for animation
          removedCard = player.hand.removeFirstCard();
        }
      } else {
        console.warn(`MultiplayerGameMode: Player ${playerId} not found`);
        relativePosition = 0;
      }

      // Add card to trick area using relative position
      this.trickArea.playCard(card, relativePosition, removedCard);

      this.emit(EVENTS.CARD_PLAYED, { playerId, card });
    });

    $(room.state).currentTrick.onRemove(() => {
      this.trickArea.clear();
    });

    // Connection quality changes
    this.networkManager.on(
      'connectionQualityChange',
      ({ quality, connected }: any) => {
        this.emit(EVENTS.CONNECTION_QUALITY_CHANGED, { quality, connected });
      }
    );

    // Reconnection events
    this.networkManager.on('reconnecting', ({ attempt }: any) => {
      this.emit(EVENTS.RECONNECTING, { attempt });
    });

    this.networkManager.on('reconnected', ({ message }: any) => {
      this.emit(EVENTS.RECONNECTED, { message });
      // Re-sync state after reconnection
      this.syncHandFromServer();
    });

    this.networkManager.on('reconnectionFailed', ({ message }: any) => {
      this.emit(EVENTS.RECONNECTION_FAILED, { message });
    });

    // Room errors
    this.networkManager.on('error', (data: any) => {
      this.emit(EVENTS.CONNECTION_ERROR, {
        message: data.message || 'Unknown error',
        code: data.code,
      });
    });
  }

  /**
   * Helper to convert CardSchema to CardData
   */
  private cardToObject(card: CardSchema): CardData {
    return {
      id: card.id,
      suit: card.suit as CardData['suit'],
      rank: card.rank as CardData['rank'],
      value: card.value,
    };
  }

  /**
   * Get current trick from room state
   */
  private getCurrentTrick(): any[] {
    const room = this.networkManager.getRoom();
    if (!room?.state.currentTrick) return [];
    return Array.from(room.state.currentTrick).map((entry) => ({
      playerIndex: (entry as TrickEntrySchema).playerId,
      card: this.cardToObject((entry as TrickEntrySchema).card),
    }));
  }

  /**
   * Sync hand state from server
   * Returns a Promise that resolves when all sync operations are complete
   */
  private async syncHandFromServer(): Promise<void> {
    const room = this.networkManager.getRoom();
    if (!room || !room.state) return;

    // Get current hand from server and display
    const player = room.state.players.get(this.networkManager.playerId || '');
    const localPlayer = this.players.find(
      (p) => p.networkId === this.networkManager.playerId
    );

    if (localPlayer && player) {
      const hand = Array.from(player.hand).map((c) =>
        this.cardToObject(c as CardSchema)
      );
      console.log(
        'MultiplayerGameMode: Syncing hand from server. Cards:',
        hand.length
      );
      localPlayer.hand.setCards(hand, false);
    }

    // Sync card counts for all remote players (show card backs)
    room.state.players.forEach((player: PlayerSchema, sessionId: string) => {
      if (sessionId !== this.networkManager.playerId) {
        const handCount = player.hand.length;
        const localPlayerObj = this.players.find(
          (p) => p.networkId === sessionId
        );
        if (localPlayerObj) {
          console.log(
            `MultiplayerGameMode: Updating card count for ${player.name}: ${handCount}`
          );
          localPlayerObj.hand.updateCardCount(handCount);
        }
      }
    });

    // Check current game state and update UI accordingly
    const phase = room.state.phase;
    const currentTurnPlayerId = room.state.currentTurn;
    const isMyTurn = currentTurnPlayerId === this.networkManager.playerId;

    // Update turn indicators for all players
    this.players.forEach((p) => {
      if (p.networkId === currentTurnPlayerId) {
        p.showTurnIndicator();
      } else {
        p.hideTurnIndicator();
        p.hand.disableAllCards();
      }
    });

    // Emit phase changed event immediately after state sync completes
    if (phase === 'bidding' && isMyTurn) {
      this.emit(EVENTS.PHASE_CHANGED, phase);
      this.emit(EVENTS.TURN_CHANGED, { isMyTurn });
    } else if (phase === 'playing' && isMyTurn && localPlayer) {
      // If it's our turn to play, update playable cards
      const leadSuit = room.state.leadSuit || '';
      const currentTrick = this.getCurrentTrick();
      console.log(
        'MultiplayerGameMode: Reconnected during our turn, updating playable cards. Lead suit:',
        leadSuit
      );
      localPlayer.hand.updatePlayableCards(leadSuit, currentTrick);
    }
  }
}
