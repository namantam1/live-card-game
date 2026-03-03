import { BaseMode } from './BaseMode';
import type { BaseGame } from '../games/BaseGame';
import type { CardData, PlayerData, GameState } from '../type.d';
import type { Scene } from 'phaser';
import GameManager from '../managers/GameManager';
import Player from '../objects/Player';
import { EVENTS } from '../utils/constants';
import { calculateBid, TRUMP_SUIT } from '@call-break/shared';

/**
 * Solo mode - uses GameManager internally
 * Plays against AI bots
 */
export class SoloMode extends BaseMode {
  readonly id = 'solo';
  readonly name = 'Solo (vs AI)';
  readonly requiresNetwork = false;

  private gameManager!: GameManager;
  private scene!: Scene;
  private players: Player[] = [];
  private trickArea: any;

  async initialize(game: BaseGame, scene?: Scene, data?: any): Promise<void> {
    this.game = game;
    if (!scene) {
      throw new Error('SoloMode requires a Phaser scene');
    }
    this.scene = scene;
    this.trickArea = data?.trickArea;

    // Create game manager
    this.gameManager = new GameManager(scene);
    this.gameManager.setTrickArea(this.trickArea);

    // Create players
    this.players = this.createPlayers(scene);
    this.gameManager.setPlayers(this.players);

    // Setup event forwarding from GameManager
    this.setupEventForwarding();
  }

  private createPlayers(scene: Scene): Player[] {
    const players: Player[] = [];
    const playerInfo = this.gameManager.playerInfo;

    for (let i = 0; i < 4; i++) {
      const playerData: PlayerData = {
        id: `player-${i}`,
        name: playerInfo[i].name,
        emoji: playerInfo[i].emoji,
        seatIndex: i,
        isLocal: playerInfo[i].isLocal,
        bid: 0,
        tricksWon: 0,
        score: 0,
        roundScore: 0,
        isBot: !playerInfo[i].isLocal,
        isReady: true,
        isConnected: true,
      };

      const player = new Player(
        scene,
        playerData,
        i,
        playerInfo[i].isLocal
          ? (cardData: CardData) => this.onCardPlayed(cardData)
          : undefined
      );
      players.push(player);
    }

    return players;
  }

  private onCardPlayed(cardData: CardData): void {
    this.gameManager.playCard(cardData, 0);
  }

  private setupEventForwarding(): void {
    // Forward events from GameManager to BaseMode listeners
    this.gameManager.on(EVENTS.PHASE_CHANGED, (phase: string) => {
      this.emit('phaseChanged', phase);
    });

    this.gameManager.on(EVENTS.TURN_CHANGED, (playerIndex: number) => {
      this.emit('turnChanged', { playerIndex });
    });

    this.gameManager.on(EVENTS.CARD_PLAYED, (data: any) => {
      this.emit('cardPlayed', data);
    });

    this.gameManager.on(EVENTS.BID_PLACED, (data: any) => {
      this.emit('bidPlaced', data);
    });

    this.gameManager.on(EVENTS.TRICK_COMPLETE, (data: any) => {
      this.emit('trickComplete', data);
    });

    this.gameManager.on(EVENTS.ROUND_COMPLETE, (data: any) => {
      this.emit('roundComplete', data);
    });

    this.gameManager.on(EVENTS.GAME_COMPLETE, (data: any) => {
      this.emit('gameComplete', data);
    });
  }

  async cleanup(): Promise<void> {
    this.gameManager?.removeAllListeners();
    this.removeAllListeners();
  }

  async startGame(): Promise<void> {
    await this.gameManager.startGame();
  }

  sendMove(card: CardData): void {
    // GameManager handles this internally via player callbacks
  }

  sendBid(bid: number): void {
    this.placeBid(bid);
  }

  getPlayers(): PlayerData[] {
    const playerObjects = this.gameManager.getPlayers();
    return playerObjects.map((player) => player.data);
  }

  getCurrentPlayer(): PlayerData | null {
    const players = this.getPlayers();
    return players[0] || null;
  }

  getGameState(): GameState {
    const players = this.getPlayers();
    const currentPlayer = this.getCurrentPlayer();

    return {
      phase: this.gameManager.getPhase(),
      currentRound: this.gameManager.getCurrentRound(),
      currentTurn: '', // Solo mode doesn't track this the same way
      leadSuit: this.gameManager.leadSuit,
      trickNumber: this.gameManager.trickNumber,
      currentTrick: this.gameManager.currentTrick,
      players,
      currentPlayer: currentPlayer!,
    };
  }

  // Additional methods for backward compatibility
  placeBid(bid: number): void {
    this.gameManager.placeHumanBid(bid);
  }

  restartGame(): void {
    this.gameManager.restartGame();
  }

  continueToNextRound(): void {
    this.gameManager.continueToNextRound();
  }

  getRecommendedBid(): number | undefined {
    const playerObjects = this.gameManager.getPlayers();
    const localPlayer = playerObjects[0];
    const hand = localPlayer?.getCardData() || [];
    if (hand.length === 0) return undefined;
    return calculateBid(hand, TRUMP_SUIT);
  }

  getCurrentRound(): number {
    return this.gameManager.getCurrentRound();
  }

  getPhase(): string {
    return this.gameManager.getPhase();
  }

  getLocalPlayer(): PlayerData | null {
    return this.getCurrentPlayer();
  }

  isLocalPlayersTurn(): boolean {
    return this.gameManager.getCurrentTurn() === 0;
  }

  isLocalPlayer(playerIndex: number): boolean {
    return playerIndex === 0;
  }

  sendReaction(_type: string): void {
    // Solo mode doesn't support reactions
  }

  sendChat(_message: string): void {
    // Solo mode doesn't support chat
  }
}
