import Phaser from 'phaser';
import ScoreBoard from '../objects/game/ScoreBoard';
import BiddingUI from '../objects/game/BiddingUI';
import RoundModal from '../objects/game/RoundModal';
import GameOverModal from '../objects/game/GameOverModal';
import SettingsModal from '../objects/game/SettingsModal';
import AudioManager from '../managers/AudioManager';
import GameScene from './GameScene';
import Common from '../objects/game/Common';
import type { GameModeBase } from '../modes/GameModeBase';
import { EVENTS, UI_TIMING } from '../utils/constants';
import ReactionPanel from '../components/ReactionPanel';
import ChatPanel from '../components/ChatPanel';
import Button from '../components/Button';
import type { ChatMessage } from '@call-break/shared';

export default class UIScene extends Phaser.Scene {
  private gameMode!: GameModeBase;
  private audioManager!: AudioManager;
  private gameScene!: GameScene;
  scoreBoard!: ScoreBoard;
  roundModal!: RoundModal;
  gameOverModal!: GameOverModal;
  settingsModal!: SettingsModal;
  biddingUI!: BiddingUI;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: any) {
    this.gameMode = data.gameMode;
    this.audioManager = data.audioManager;
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
    this.roundModal = new RoundModal(
      this,
      () => this.gameScene.continueToNextRound(),
      this.audioManager
    );

    this.gameOverModal = new GameOverModal(
      this,
      () => this.gameScene.restartGame(),
      () => this.gameScene.returnToMenu(),
      this.audioManager
    );

    // Get responsive sizing from centralized config
    Common.createSettingIcon(this, {
      audioManager: this.audioManager,
      onClick: () => this.settingsModal.showSettings(),
    });

    this.settingsModal = new SettingsModal(this, {
      audioManager: this.audioManager,
      onQuit: () => this.gameScene.returnToMenu(),
      onNewGame: this.isMultiplayer()
        ? null
        : () => this.gameScene.restartGame(),
    });

    // Create bidding UI
    this.biddingUI = new BiddingUI(
      this,
      (bid) => this.gameMode.onBidSelected(bid),
      this.audioManager
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

      // Get current turn from game mode
      const players = this.gameMode.getPlayers();
      const currentTurnPlayer = players.find((p) => {
        // In multiplayer, check against network state
        if (this.isMultiplayer()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const networkManager = (this.gameMode as any).networkManager;
          if (networkManager) {
            const currentTurnId = networkManager.getState()?.currentTurn;
            return p.id === currentTurnId;
          }
        }
        return false;
      });

      const isMyTurn = currentTurnPlayer?.id === localPlayer.id;

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
    Button.createReactionbutton(
      this,
      this.cameras.main.width - 50,
      150,
      '😊',
      () => reactionPanel.toggle()
    );

    // Setup chat UI for multiplayer mode only
    if (this.isMultiplayer()) {
      this.setupChatUI();
    }
  }

  private setupChatUI(): void {
    const chatPanel = new ChatPanel(this, {
      position: {
        x: 20,
        y: this.cameras.main.height - 300,
      },
      onSendMessage: (message: string) => this.gameMode.sendChat(message),
    });

    // Chat toggle button
    Button.createReactionbutton(
      this,
      this.cameras.main.width - 50,
      230,
      '💬',
      () => chatPanel.toggle()
    );

    // Listen for incoming chat messages
    this.gameMode.on(EVENTS.CHAT_MESSAGE, (data: ChatMessage) => {
      chatPanel.addMessage(data);
    });
  }
}
