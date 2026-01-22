import Phaser from 'phaser';
import { COLORS, PHASE, TOTAL_ROUNDS, MAX_BID } from '../utils/constants';
import {
  SETTINGS_ICON_CONFIG,
  SCOREBOARD_CONFIG,
  BIDDING_CONFIG,
  FONT_CONFIG,
  isMobile,
  getResponsiveConfig,
  getFontSize
} from '../config/uiConfig';
import Button from '../utils/Button';
import ScoreBoard from '../objects/game/ScoreBoard';
import BiddingUI from '../objects/game/BiddingUI';
import RoundModal from '../objects/game/RoundModal';
import GameOverModal from '../objects/game/GameOverModal';
import SettingsModal from '../objects/game/SettingsModal';
import NetworkManager from '../managers/NetworkManager';
import GameManager from '../managers/GameManager';
import AudioManager from '../managers/AudioManager';
import GameScene from './GameScene';

export default class UIScene extends Phaser.Scene {
  isMultiplayer: boolean;
  networkManager: NetworkManager | null;
  gameManager!: GameManager;
  audioManager!: AudioManager;
  gameScene!: GameScene;
  scoreBoard!: ScoreBoard;
  roundModal!: RoundModal;
  gameOverModal!: GameOverModal;
  settingsModal!: SettingsModal;
  biddingUI!: BiddingUI;

  constructor() {
    super({ key: 'UIScene' });
    this.isMultiplayer = false;
    this.networkManager = null;
  }

  init(data: any) {
    this.gameManager = data.gameManager;
    this.audioManager = data.audioManager;
    this.isMultiplayer = data.isMultiplayer || false;
    this.networkManager = data.networkManager || null;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Get reference to game scene
    this.gameScene = this.scene.get('GameScene') as GameScene;

    this.scoreBoard = new ScoreBoard(this, this.isMultiplayer, this.getPlayersData(), this.getCurrentRound());
    
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
    const config = getResponsiveConfig(SETTINGS_ICON_CONFIG, width, height);
    const { iconSize, fontSize, margin } = config;
    Button.createIconButton(this, width - margin, margin, {
      iconSize,
      fontSize,
      icon: '\u2699',
      onClick: () => this.settingsModal.showSettings(),
      audioManager: this.audioManager
    });
    
    this.settingsModal = new SettingsModal(
      this, 
      { 
        audioManager: this.audioManager, 
        onQuit: () => this.gameScene.returnToMenu(),
        onNewGame: !this.isMultiplayer ? (() => this.gameScene.restartGame()) : null
      }
    );
    
    // Create bidding UI
    this.biddingUI = new BiddingUI(
      this,
      (bid) => this.onBidSelected(bid),
      this.audioManager
    );

    // Listen for game events
    this.setupEventListeners();
  }

  getPlayersData() {
    if (this.isMultiplayer && this.networkManager) {
      return this.networkManager.getPlayers();
    } else if (this.gameManager) {
      return this.gameManager.getPlayers();
    }
    return [];
  }

  getCurrentRound() {
    if (this.isMultiplayer && this.networkManager) {
      const state = this.networkManager.getState();
      return state?.currentRound || 1;
    } else if (this.gameManager) {
      return this.gameManager.getCurrentRound();
    }
    return 1;
  }

  getPhase() {
    if (this.isMultiplayer && this.networkManager) {
      return this.networkManager.getPhase();
    } else if (this.gameManager) {
      return this.gameManager.getPhase();
    }
    return 'waiting';
  }

  onBidSelected(bid: number) {
    if (this.isMultiplayer) {
      this.gameScene.onMultiplayerBid(bid);
    } else {
      this.gameScene.onHumanBid(bid);
    }
  }

  setupEventListeners() {
    if (this.isMultiplayer) {
      this.setupMultiplayerEventListeners();
    } else {
      this.setupSoloEventListeners();
    }

    // Common event listeners
    // Round complete
    this.gameScene.events.on('roundComplete', (data: any) => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
      this.time.delayedCall(500, () => this.roundModal.showRoundResults(data));
    });

    // Game complete
    this.gameScene.events.on('gameComplete', (data: any) => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
      this.time.delayedCall(500, () => this.gameOverModal.showGameResults(data));
    });
  }

  setupSoloEventListeners() {
    // Listen for phase changes from game scene
    this.gameScene.events.on('phaseChanged', (phase: any) => {
      if (phase === PHASE.BIDDING) {
        // Check if it's human's turn to bid
        if (this.gameManager && this.gameManager.biddingPlayer === 0) {
          this.biddingUI.show();
        }
      }
    });

    // Bid placed
    this.gameScene.events.on('bidPlaced', ({ playerIndex }: any) => {
      // If next bidder is human, show bidding UI
      if (playerIndex < 3) {
        const nextBidder = playerIndex + 1;
        if (nextBidder === 0) {
          this.time.delayedCall(500, () => this.biddingUI.show());
        }
      }
    });
  }

  setupMultiplayerEventListeners() {
    // Listen for phase changes - show bidding UI when it's our turn
    this.gameScene.events.on('phaseChanged', (phase: any) => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
      if (phase === 'bidding') {
        // Add slight delay to ensure currentTurn state is updated
        this.time.delayedCall(100, () => {
          if (this.networkManager!.isMyTurn()) {
            this.biddingUI.show();
          }
        });
      }
    });

    // Turn change - show bidding UI if it's bidding phase and our turn
    this.networkManager!.on('turnChange', ({ isMyTurn }: any) => {
      const phase = this.networkManager!.getPhase();
      if (phase === 'bidding' && isMyTurn) {
        this.time.delayedCall(300, () => this.biddingUI.show());
      }
    });

    // Score updates
    this.networkManager!.on('playerScoreChange', () => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
    });

    // Bid placed
    this.networkManager!.on('playerBid', () => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
    });

    // Tricks won update
    this.networkManager!.on('playerTricksWon', () => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
    });
  }

}
