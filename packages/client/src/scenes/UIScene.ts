import Phaser from 'phaser';
import ScoreBoard from '../components/game/panels/ScoreBoard';
import BiddingModal from '../components/game/modals/BiddingModal';
import RoundModal from '../components/game/modals/RoundModal';
import GameOverModal from '../components/game/modals/GameOverModal';
import SettingsModal from '../components/game/modals/SettingsModal';
import GameScene from './GameScene';
import type { GameModeBase } from '../modes/GameModeBase';
import { EVENTS, UI_TIMING } from '../utils/constants';
import ReactionPanel from '../components/shared/ReactionPanel';
import QuickChatPanel from '../components/shared/QuickChatPanel';
import ChatToast from '../components/shared/ChatToast';
import Button from '../components/shared/Button';
import { getResponsiveConfig, SETTINGS_ICON_CONFIG } from '../utils/uiConfig';
import type { ChatMessage } from '@call-break/shared';
import type { ReactionData } from '../type';

export default class UIScene extends Phaser.Scene {
  private gameMode!: GameModeBase;
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
    this.gameMode = data.gameMode;
  }

  create() {
    // Get reference to game scene
    this.gameScene = this.scene.get('GameScene') as GameScene;

    // Create scoreboard - unified for both modes!
    this.scoreBoard = new ScoreBoard(
      this,
      false, // We'll update this based on game mode later if needed
      this.gameMode.getPlayers(),
      this.gameMode.getCurrentRound()
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
    this.biddingUI = new BiddingModal(this, (bid) =>
      this.gameMode.onBidSelected(bid)
    );

    // Setup reaction UI for multiplayer mode
    this.setupReactionUI();

    // Setup unified event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Helper function to check and show bidding UI
    // This handles race conditions between phase and turn state updates
    const checkAndShowBiddingUI = () => {
      const phase = this.gameMode.getPhase();
      const localPlayer = this.gameMode.getLocalPlayer();

      if (!localPlayer) return;

      const isMyTurn = this.gameMode.isLocalPlayersTurn();

      if (phase === 'bidding' && isMyTurn) {
        console.log('UIScene: Showing bidding UI');
        // Small delay to allow card animations to settle before showing UI
        this.time.delayedCall(UI_TIMING.BIDDING_UI_DELAY, () => {
          // Double-check conditions haven't changed during delay
          if (this.gameMode.getPhase() === 'bidding') {
            const recommendedBid = this.gameMode.getRecommendedBid();
            this.biddingUI.show(recommendedBid);
          }
        });
      }
    };

    // Phase changed
    this.gameMode.on(EVENTS.PHASE_CHANGED, (_phase: string) => {
      // Update scoreboard
      this.scoreBoard.updateScoreboard(
        this.gameMode.getPlayers(),
        this.gameMode.getCurrentRound()
      );

      // Check if we should show bidding UI (handles race condition)
      checkAndShowBiddingUI();
    });

    // Turn changed
    this.gameMode.on(EVENTS.TURN_CHANGED, (_data: { isMyTurn: boolean }) => {
      // Check if we should show bidding UI (handles race condition)
      checkAndShowBiddingUI();
    });

    // Bid placed
    this.gameMode.on(EVENTS.BID_PLACED, ({ playerIndex }: any) => {
      // Update scoreboard
      this.scoreBoard.updateScoreboard(
        this.gameMode.getPlayers(),
        this.gameMode.getCurrentRound()
      );

      // Hide bidding UI if it was the local player
      if (this.gameMode.isLocalPlayer(playerIndex)) {
        this.biddingUI.hide();
      }
    });

    // Round complete
    this.gameMode.on(EVENTS.ROUND_COMPLETE, (data: any) => {
      this.scoreBoard.updateScoreboard(
        this.gameMode.getPlayers(),
        this.gameMode.getCurrentRound()
      );
      this.time.delayedCall(500, () => this.roundModal.showRoundResults(data));
    });

    // Game complete
    this.gameMode.on(EVENTS.GAME_COMPLETE, (data: any) => {
      this.scoreBoard.updateScoreboard(
        this.gameMode.getPlayers(),
        this.gameMode.getCurrentRound()
      );
      this.time.delayedCall(500, () =>
        this.gameOverModal.showGameResults(data)
      );
    });
  }

  private isMultiplayer(): boolean {
    // Check if any player has an id (multiplayer players have network IDs)
    const players = this.gameMode.getPlayers();
    return players.some((p) => p.id !== undefined);
  }

  private setupReactionUI(): void {
    const { width, height } = this.cameras.main;
    const rightEdge = width - 50;
    const startY = height * 0.3; // Position at 30% from top, away from bottom cards

    const reactionPanel = new ReactionPanel(
      this,
      (type: string) => this.gameMode.sendReaction(type),
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
    this.gameMode.on(EVENTS.REACTION, (data: ReactionData) => {
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
      onSendMessage: (message: string) => this.gameMode.sendChat(message),
    });

    // Chat toggle button (positioned below reaction button)
    Button.createReactionbutton(this, rightEdge, startY + 80, '💬', () =>
      quickChatPanel.toggle()
    );

    // Listen for incoming chat messages and show as speech bubbles
    this.gameMode.on(EVENTS.CHAT_MESSAGE, (data: ChatMessage) => {
      chatToast.showMessage(data);
    });
  }
}
