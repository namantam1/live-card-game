import type { Scene } from "phaser";
import { GameModeBase, type PlayerData } from "./GameModeBase";
import NetworkManager from "../managers/NetworkManager";
import Player from "../objects/Player";
import type TrickArea from "../objects/TrickArea";
import type { CardData } from "../type";
import { EVENTS, type Suit } from "../utils/constants";

/**
 * Multiplayer game mode implementation (via Colyseus)
 * Delegates to NetworkManager for server communication
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
      throw new Error("NetworkManager required for multiplayer mode");
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
    const networkPlayers = this.networkManager.getPlayers();
    const localId = this.networkManager.playerId;

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
          : undefined,
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
    return this.networkManager.getPlayers().map((player) => ({
      name: player.name,
      emoji: player.emoji,
      bid: player.bid,
      tricksWon: player.tricksWon,
      score: player.score,
      roundScore: player.roundScore,
      isHuman: player.id === this.networkManager.playerId,
      isLocal: player.id === this.networkManager.playerId,
      id: player.id,
    }));
  }

  override getLocalPlayer(): PlayerData | null {
    // In multiplayer mode, local player is identified by networkId
    const players = this.getPlayers();
    return players.find((p) => p.isLocal) || null;
  }

  override getCurrentRound(): number {
    const state = this.networkManager.getState();
    return state?.currentRound || 1;
  }

  override getPhase(): string {
    return this.networkManager.getPhase();
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

  /**
   * Setup network event listeners and forward to IGameMode event system
   * Uses Phaser's EventEmitter for robust event handling
   */
  private setupNetworkListeners(): void {
    // Phase change
    this.networkManager.on("phaseChange", ({ phase }: any) => {
      this.emit(EVENTS.PHASE_CHANGED, phase);

      if (phase === "roundEnd") {
        const players = this.networkManager.getPlayers();
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

      if (phase === "gameOver") {
        const players = this.networkManager.getPlayers();
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

    // Turn change
    this.networkManager.on("turnChange", ({ playerId, isMyTurn }: any) => {
      // Convert network playerId to local player index
      const playerIndex = this.players.findIndex(
        (p) => p.networkId === playerId,
      );

      if (playerIndex === -1) {
        console.warn(`Player ${playerId} not found in local players array`);
        return;
      }

      this.players.forEach((p, i) => {
        if (i === playerIndex) {
          p.showTurnIndicator();
          if (isMyTurn) {
            // Enable card selection for local player with proper validation
            const leadSuit = this.networkManager.getLeadSuit();
            const currentTrick = this.networkManager.getCurrentTrick();
            const phase = this.networkManager.getPhase();
            if (phase === "playing") {
              p.hand.updatePlayableCards(leadSuit, currentTrick);
            }
          }
        } else {
          p.hideTurnIndicator();
          p.hand.disableAllCards();
        }
      });

      // Emit with playerIndex (array index) for consistency with SoloGameMode
      this.emit(EVENTS.TURN_CHANGED, { playerIndex, isMyTurn });
    });

    // Card added to hand
    this.networkManager.on("cardAdded", ({ card }: any) => {
      const localPlayer = this.players.find(
        (p) => p.networkId === this.networkManager.playerId,
      );
      if (localPlayer) {
        localPlayer.hand.addCard(card);
      }
    });

    // Card played by any player
    this.networkManager.on("cardPlayed", ({ playerId, card }: any) => {
      // Find player in local array
      let player = this.players.find((p) => p.networkId === playerId);
      let relativePosition;
      let removedCard = null;

      if (player) {
        // Use relative position for visual display
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
        console.warn(`Player ${playerId} not found in local players array`);
        relativePosition = 0;
      }

      // Add card to trick area using relative position for visual placement
      this.trickArea.playCard(card, relativePosition, removedCard);

      this.emit(EVENTS.CARD_PLAYED, { playerId, card });
    });

    // Trick cleared
    this.networkManager.on("trickCleared", () => {
      this.trickArea.clear();
    });

    // Trick winner
    this.networkManager.on("trickWinner", (winnerId: any) => {
      const winner = this.players.find((p) => p.networkId === winnerId);
      if (winner) {
        // Update tricks won count
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

        // Animate cards being collected to the winner
        const winnerIndex = this.players.indexOf(winner);
        this.scene.time.delayedCall(1000, () => {
          this.trickArea.collectTrick(winnerIndex, 400 as any);
        });

        this.emit(EVENTS.TRICK_COMPLETE, { winnerIndex });
      }
    });

    // Player bid
    this.networkManager.on("playerBid", ({ playerId, bid }: any) => {
      const player = this.players.find((p) => p.networkId === playerId);
      if (player) {
        // Update the local player's bid and stats display
        player.setBid(bid);
        const playerIndex = this.players.indexOf(player);
        this.emit(EVENTS.BID_PLACED, { playerIndex, bid });
      } else {
        console.warn(`Player ${playerId} not found for bid event`);
      }
    });

    // Round change
    this.networkManager.on("roundChange", () => {
      // Reset all players for new round
      this.players.forEach((player) => {
        player.reset();
      });
    });

    // Connection quality changes
    this.networkManager.on(
      "connectionQualityChange",
      ({ quality, connected }: any) => {
        this.emit(EVENTS.CONNECTION_QUALITY_CHANGED, { quality, connected });
      },
    );

    // Reconnecting
    this.networkManager.on("reconnecting", ({ attempt }: any) => {
      this.emit(EVENTS.RECONNECTING, { attempt });
    });

    // Reconnected
    this.networkManager.on("reconnected", ({ message }: any) => {
      this.emit(EVENTS.RECONNECTED, { message });
    });

    // Reconnection failed
    this.networkManager.on("reconnectionFailed", ({ message }: any) => {
      this.emit(EVENTS.RECONNECTION_FAILED, { message });
    });

    // Connection error
    this.networkManager.on("error", (data: any) => {
      this.emit(EVENTS.CONNECTION_ERROR, {
        message: data.message || "Unknown error",
        code: data.code,
      });
    });

    // Room left
    this.networkManager.on("roomLeft", (data: any) => {
      this.emit(EVENTS.ROOM_LEFT, { code: data.code });
    });

    // Lead suit changed - update playable cards if it's our turn
    this.networkManager.on("leadSuitChange", (leadSuit: Suit) => {
      if (
        this.networkManager.isMyTurn() &&
        this.networkManager.getPhase() === "playing"
      ) {
        const localPlayer = this.players.find(
          (p) => p.networkId === this.networkManager.playerId,
        );
        if (localPlayer) {
          const currentTrick = this.networkManager.getCurrentTrick();
          localPlayer.hand.updatePlayableCards(leadSuit, currentTrick);
        }
      }
    });

    // Remote player hand changes (for visual card backs)
    this.networkManager.on(
      "remoteHandChanged",
      ({ playerId, handCount }: any) => {
        const player = this.players.find((p) => p.networkId === playerId);
        if (player) {
          player.hand.updateCardCount(handCount);
        }
      },
    );
  }

  /**
   * Sync hand state from server
   * Returns a Promise that resolves when all sync operations are complete
   */
  private async syncHandFromServer(): Promise<void> {
    // Get current hand from server and display
    const hand = this.networkManager.getMyHand();
    const localPlayer = this.players.find(
      (p) => p.networkId === this.networkManager.playerId,
    );

    if (localPlayer) {
      console.log(
        "MultiplayerGameMode: Syncing hand from server. Cards:",
        hand.length,
      );
      localPlayer.hand.setCards(hand, false);
    }

    // Sync card counts for all remote players (show card backs)
    const state = this.networkManager.getState();
    if (state) {
      state.players.forEach((player: any, sessionId: string) => {
        if (sessionId !== this.networkManager.playerId) {
          const handCount = player.hand.length;
          const localPlayerObj = this.players.find(
            (p) => p.networkId === sessionId,
          );
          if (localPlayerObj) {
            console.log(
              `MultiplayerGameMode: Updating card count for ${player.name}: ${handCount}`,
            );
            localPlayerObj.hand.updateCardCount(handCount);
          }
        }
      });

      // Check current game state and update UI accordingly
      const phase = state.phase;
      const currentTurnPlayerId = state.currentTurn;
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
      // This ensures consistent behavior between normal phase changes and reconnection
      if (phase === "bidding" && isMyTurn) {
        this.emit(EVENTS.PHASE_CHANGED, phase);
      } else if (phase === "playing" && isMyTurn && localPlayer) {
        // If it's our turn to play, update playable cards
        const leadSuit = state.leadSuit || "";
        const currentTrick = this.networkManager.getCurrentTrick();
        console.log(
          "MultiplayerGameMode: Reconnected during our turn, updating playable cards. Lead suit:",
          leadSuit,
        );
        localPlayer.hand.updatePlayableCards(leadSuit, currentTrick);
      }
    }
  }
}
