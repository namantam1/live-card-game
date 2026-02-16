import Phaser from 'phaser';
import ScoreBoard from '../components/game/panels/ScoreBoard';
import BiddingModal from '../components/game/modals/BiddingModal';
import RoundModal from '../components/game/modals/RoundModal';
import GameOverModal from '../components/game/modals/GameOverModal';
import SettingsModal from '../components/game/modals/SettingsModal';
import GameScene from './GameScene';
import { EVENTS, UI_TIMING } from '../utils/constants';
import ReactionPanel from '../components/shared/ReactionPanel';
import QuickChatPanel from '../components/shared/QuickChatPanel';
import ChatToast from '../components/shared/ChatToast';
import Button from '../components/shared/Button';
import { getResponsiveConfig, SETTINGS_ICON_CONFIG } from '../utils/uiConfig';
import type { ChatMessage } from '@call-break/shared';
import type { ReactionData } from '../type';
import type { GameInstance } from '../core/GameInstance';
import type { BaseMode } from '../modes/BaseMode';

export default class UIScene extends Phaser.Scene {
  private gameInstance!: GameInstance;
  private mode!: BaseMode;
  private gameScene!: GameScene;
  scoreBoard!: ScoreBoard;
  roundModal!: RoundModal;
  gameOverModal!: GameOverModal;
  settingsModal!: SettingsModal;
  biddingUI!: BiddingModal;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: any) {
    this.gameInstance = data.gameInstance;
    this.mode = this.gameInstance.getMode();
  }

  create() {
    // Get reference to game scene
    this.gameScene = this.scene.get('GameScene') as GameScene;

    // Create scoreboard
    this.scoreBoard = new ScoreBoard(
      this,
      false,
      this.mode.getPlayers(),
      this.getCurrentRound()
    );

    // Create modals
    this.roundModal = new RoundModal(this, () =>
      this.gameScene.continueToNextRound()
    );

    this.gameOverModal = new GameOverModal(
      this,
      () => this.gameScene.restartGame(),
      () => this.gameScene.returnToMenu()
    );

    // Get responsive sizing from centralized config
    const { width, height } = this.cameras.main;
    const iconConfig = getResponsiveConfig(SETTINGS_ICON_CONFIG, width, height);
    const { iconSize, fontSize, margin } = iconConfig;
    Button.createIconButton(this, width - margin, margin, {
      iconSize,
      fontSize,
      icon: '\u2699',
      onClick: () => this.settingsModal.showSettings(),
    });

    this.settingsModal = new SettingsModal(this, {
      onQuit: () => this.gameScene.returnToMenu(),
      onNewGame: this.isMultiplayer()
        ? null
        : () => this.gameScene.restartGame(),
    });

    // Create bidding UI
    this.biddingUI = new BiddingModal(this, (bid) => this.onBidSelected(bid));

    // Setup reaction UI for multiplayer mode
    this.setupReactionUI();

    // Setup unified event listeners
    this.setupEventListeners();
  }

  private getCurrentRound(): number {
    // Get from mode if available
    if ('getCurrentRound' in this.mode) {
      return (this.mode as any).getCurrentRound();
    }
    return 1;
  }

  private onBidSelected(bid: number): void {
    // Delegate to mode
    if ('placeBid' in this.mode) {
      (this.mode as any).placeBid(bid);
    } else {
      this.mode.sendBid(bid);
    }
  }

  setupEventListeners() {
    // Helper function to check and show bidding UI
    // This handles race conditions between phase and turn state updates
    const checkAndShowBiddingUI = () => {
      const phase = this.mode.getPhase();
      const localPlayer = this.mode.getLocalPlayer();

      if (!localPlayer) return;

      const isMyTurn = this.mode.isLocalPlayersTurn();

      if (phase === 'bidding' && isMyTurn) {
        console.log('UIScene: Showing bidding UI');
        // Small delay to allow card animations to settle before showing UI
        this.time.delayedCall(UI_TIMING.BIDDING_UI_DELAY, () => {
          // Double-check conditions haven't changed during delay
          if (this.mode.getPhase() === 'bidding') {
            const recommendedBid = this.mode.getRecommendedBid();
            this.biddingUI.show(recommendedBid);
          }
        });
      }
    };

    // Phase changed
    this.mode.on(EVENTS.PHASE_CHANGED, (_phase: string) => {
      // Update scoreboard
      this.scoreBoard.updateScoreboard(
        this.mode.getPlayers(),
        this.mode.getCurrentRound()
      );

      // Check if we should show bidding UI (handles race condition)
      checkAndShowBiddingUI();
    });

    // Turn changed
    this.mode.on(EVENTS.TURN_CHANGED, (_data: { isMyTurn: boolean }) => {
      // Check if we should show bidding UI (handles race condition)
      checkAndShowBiddingUI();
    });

    // Bid placed
    this.mode.on(EVENTS.BID_PLACED, ({ playerIndex }: any) => {
      // Update scoreboard
      this.scoreBoard.updateScoreboard(
        this.mode.getPlayers(),
        this.mode.getCurrentRound()
      );

      // Hide bidding UI if it was the local player
      if (this.mode.isLocalPlayer(playerIndex)) {
        this.biddingUI.hide();
      }
    });

    // Round complete
    this.mode.on(EVENTS.ROUND_COMPLETE, (data: any) => {
      this.scoreBoard.updateScoreboard(
        this.mode.getPlayers(),
        this.mode.getCurrentRound()
      );
      this.time.delayedCall(500, () => this.roundModal.showRoundResults(data));
    });

    // Game complete
    this.mode.on(EVENTS.GAME_COMPLETE, (data: any) => {
      this.scoreBoard.updateScoreboard(
        this.mode.getPlayers(),
        this.mode.getCurrentRound()
      );
      this.time.delayedCall(500, () =>
        this.gameOverModal.showGameResults(data)
      );
    });
  }

  private isMultiplayer(): boolean {
    // Check if any player has an id (multiplayer players have network IDs)
    const players = this.mode.getPlayers();
    return players.some((p) => p.id !== undefined);
  }

  private setupReactionUI(): void {
    const { width, height } = this.cameras.main;
    const rightEdge = width - 50;
    const startY = height * 0.3; // Position at 30% from top, away from bottom cards

    const reactionPanel = new ReactionPanel(
      this,
      (type: string) => this.mode.sendReaction(type),
      {
        position: {
          x: this.cameras.main.centerX,
          y: this.cameras.main.centerY - 160,
        },
      }
    );

    // Reaction button on right edge
    Button.createReactionbutton(this, rightEdge, startY, '😊', () =>
      reactionPanel.toggle()
    );

    // Setup reaction event listener for multiplayer mode only
    if (this.isMultiplayer()) {
      this.setupReactionListener();
      this.setupChatUI(rightEdge, startY);
    }
  }

  private setupReactionListener(): void {
    // Listen for incoming reactions and show them on the player (same pattern as chat)
    this.mode.on(EVENTS.REACTION, (data: ReactionData) => {
      const player = this.gameScene.players.find((p) => p.id === data.playerId);

      if (player) {
        player.showReaction(data.type);
      }
    });
  }

  private setupChatUI(rightEdge: number, startY: number): void {
    const { width } = this.cameras.main;

    // Get players from game scene
    const players = this.gameScene.players;

    // Create chat toast system for displaying messages near players
    const chatToast = new ChatToast(this, players);

    // Create quick chat panel
    const quickChatPanel = new QuickChatPanel(this, {
      position: {
        x: width - 390, // Position to the left of the button
        y: startY + 120, // Below the chat button
      },
      onSendMessage: (message: string) => this.mode.sendChat(message),
    });

    // Chat toggle button (positioned below reaction button)
    Button.createReactionbutton(this, rightEdge, startY + 80, '💬', () =>
      quickChatPanel.toggle()
    );

    // Listen for incoming chat messages and show as speech bubbles
    this.mode.on(EVENTS.CHAT_MESSAGE, (data: ChatMessage) => {
      chatToast.showMessage(data);
    });
  }
}
