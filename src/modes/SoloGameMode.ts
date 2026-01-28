import type { Scene } from "phaser";
import {
  GameModeBase,
  type PlayerData,
  type EventCallback,
} from "./GameModeBase";
import GameManager from "../managers/GameManager";
import Player from "../objects/Player";
import type TrickArea from "../objects/TrickArea";
import type { CardData } from "../type";
import { EVENTS } from "../utils/constants";

/**
 * Solo game mode implementation (vs AI bots)
 * Delegates to GameManager for game logic
 */
export default class SoloGameMode extends GameModeBase {
  private gameManager!: GameManager;
  private players: Player[] = [];
  private trickArea!: TrickArea;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  override async initialize(scene: Scene, data: any): Promise<void> {
    this.trickArea = data.trickArea;

    // Create game manager
    this.gameManager = new GameManager(scene);
    this.gameManager.setTrickArea(this.trickArea);

    // Create players
    this.players = this.createPlayers(scene);
    this.gameManager.setPlayers(this.players);

    // Setup event forwarding from GameManager to IGameMode events
    this.setupEventForwarding();
  }

  override createPlayers(scene: Scene): Player[] {
    const players: Player[] = [];
    const playerInfo = this.gameManager.playerInfo;

    for (let i = 0; i < 4; i++) {
      const player = new Player(
        scene,
        i,
        playerInfo[i].name,
        playerInfo[i].emoji,
        playerInfo[i].isHuman,
        playerInfo[i].isHuman
          ? (cardData: CardData) => this.onCardPlayed(cardData)
          : undefined,
      );
      players.push(player);
    }

    return players;
  }

  override async startGame(): Promise<void> {
    await this.gameManager.startGame();
  }

  override cleanup(): void {
    // Clean up event listeners
    this.gameManager.removeAllListeners();
    this.eventListeners.clear();
  }

  override getPlayers(): PlayerData[] {
    return this.gameManager.getPlayers().map((player) => ({
      name: player.name,
      emoji: player.emoji,
      bid: player.bid,
      tricksWon: player.tricksWon,
      score: player.score,
      roundScore: player.roundScore,
      isHuman: player.isHuman,
      isLocal: player.isHuman, // In solo mode, human = local
    }));
  }

  override getCurrentRound(): number {
    return this.gameManager.getCurrentRound();
  }

  override getPhase(): string {
    return this.gameManager.getPhase();
  }

  override onBidSelected(bid: number): void {
    this.gameManager.placeHumanBid(bid);
  }

  override onCardPlayed(cardData: CardData): void {
    this.gameManager.playCard(cardData, 0);
  }

  override continueToNextRound(): void {
    this.gameManager.continueToNextRound();
  }

  override async restartGame(): Promise<void> {
    this.trickArea?.clear();
    await this.gameManager.restartGame();
  }

  override returnToMenu(): void {
    // Will be handled by GameScene
    this.cleanup();
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
          console.error(`SoloGameMode: Error in ${event} listener`, error);
        }
      });
    }
  }

  /**
   * Forward events from GameManager to IGameMode event system
   * This translates GameManager events to the unified IGameMode event API
   */
  private setupEventForwarding(): void {
    // Phase changed
    this.gameManager.on(EVENTS.PHASE_CHANGED, (phase: string) => {
      this.emit("phaseChanged", phase);
    });

    // Turn changed
    this.gameManager.on(EVENTS.TURN_CHANGED, (playerIndex: number) => {
      this.emit("turnChanged", { playerIndex, isMyTurn: playerIndex === 0 });
    });

    // Card played
    this.gameManager.on(EVENTS.CARD_PLAYED, (data: any) => {
      this.emit("cardPlayed", data);
    });

    // Trick complete
    this.gameManager.on(EVENTS.TRICK_COMPLETE, (data: any) => {
      this.emit("trickComplete", data);
    });

    // Round complete
    this.gameManager.on(EVENTS.ROUND_COMPLETE, (data: any) => {
      this.emit("roundComplete", data);
    });

    // Game complete
    this.gameManager.on(EVENTS.GAME_COMPLETE, (data: any) => {
      this.emit("gameComplete", data);
    });

    // Bid placed
    this.gameManager.on(EVENTS.BID_PLACED, (data: any) => {
      this.emit("bidPlaced", data);
    });
  }
}
