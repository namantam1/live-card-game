import type { Scene } from "phaser";
import {
  GameModeBase,
  type PlayerData,
  type EventCallback,
} from "./GameModeBase";
import NetworkManager from "../managers/NetworkManager";
import Player from "../objects/Player";
import type TrickArea from "../objects/TrickArea";
import type { CardData } from "../type";
import type { Suit } from "../utils/constants";

/**
 * Multiplayer game mode implementation (via Colyseus)
 * Delegates to NetworkManager for server communication
 */
export default class MultiplayerGameMode extends GameModeBase {
  private networkManager!: NetworkManager;
  private scene!: Scene;
  private players: Player[] = [];
  private trickArea!: TrickArea;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

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
    this.syncHandFromServer();
  }

  override async cleanup(): Promise<void> {
    // Leave room first to properly disconnect
    if (this.networkManager.isInRoom()) {
      await this.networkManager.leaveRoom();
    }

    // Clean up network listeners
    this.networkManager.removeAllListeners();
    this.eventListeners.clear();
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

  // ===== Event System =====

  override on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  override off(event: string, callback: EventCallback): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.delete(callback);
    }
  }

  private emit(event: string, data?: any): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)!.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(
            `MultiplayerGameMode: Error in ${event} listener`,
            error,
          );
        }
      });
    }
  }

  /**
   * Setup network event listeners and forward to IGameMode event system
   */
  private setupNetworkListeners(): void {
    // Phase change
    this.networkManager.on("phaseChange", ({ phase }: any) => {
      this.emit("phaseChanged", phase);

      if (phase === "roundEnd") {
        const players = this.networkManager.getPlayers();
        this.emit("roundComplete", {
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
        this.emit("gameComplete", {
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
      this.players.forEach((p) => {
        if (p.networkId === playerId) {
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

      this.emit("turnChanged", { playerId, isMyTurn });
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

      this.emit("cardPlayed", { playerId, card });
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

        this.emit("trickComplete", { winnerIndex });
      }
    });

    // Player bid
    this.networkManager.on("playerBid", ({ playerId, bid }: any) => {
      const player = this.players.find((p) => p.networkId === playerId);
      if (player) {
        // Update the local player's bid and stats display
        player.setBid(bid);
        const playerIndex = this.players.indexOf(player);
        this.emit("bidPlaced", { playerIndex, bid });
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
   */
  private syncHandFromServer(): void {
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

      if (phase === "bidding" && isMyTurn) {
        // Emit phase changed event to trigger bidding UI
        this.scene.time.delayedCall(500, () => {
          this.emit("phaseChanged", phase);
        });
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
