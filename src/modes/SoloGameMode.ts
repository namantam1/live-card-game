import type { Scene } from "phaser";
import { GameModeBase, type PlayerData } from "./GameModeBase";
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
    this.removeAllListeners();
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

  /**
   * Forward events from GameManager to IGameMode event system
   * This translates GameManager events to the unified IGameMode event API
   * Uses Phaser's EventEmitter for robust event handling
   */
  private setupEventForwarding(): void {
    // Phase changed
    this.gameManager.on(EVENTS.PHASE_CHANGED, (phase: string) => {
      this.emit(EVENTS.PHASE_CHANGED, phase);
    });

    // Turn changed
    this.gameManager.on(EVENTS.TURN_CHANGED, (playerIndex: number) => {
      this.emit(EVENTS.TURN_CHANGED, {
        playerIndex,
        isMyTurn: playerIndex === 0,
      });
    });

    // Card played
    this.gameManager.on(EVENTS.CARD_PLAYED, (data: any) => {
      this.emit(EVENTS.CARD_PLAYED, data);
    });

    // Trick complete
    this.gameManager.on(EVENTS.TRICK_COMPLETE, (data: any) => {
      this.emit(EVENTS.TRICK_COMPLETE, data);
    });

    // Round complete
    this.gameManager.on(EVENTS.ROUND_COMPLETE, (data: any) => {
      this.emit(EVENTS.ROUND_COMPLETE, data);
    });

    // Game complete
    this.gameManager.on(EVENTS.GAME_COMPLETE, (data: any) => {
      this.emit(EVENTS.GAME_COMPLETE, data);
    });

    // Bid placed
    this.gameManager.on(EVENTS.BID_PLACED, (data: any) => {
      this.emit(EVENTS.BID_PLACED, data);
    });
  }
}
