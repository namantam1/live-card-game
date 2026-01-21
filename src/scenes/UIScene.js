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

export default class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene' });
    this.isMultiplayer = false;
    this.networkManager = null;
  }

  init(data) {
    this.gameManager = data.gameManager;
    this.audioManager = data.audioManager;
    this.isMultiplayer = data.isMultiplayer || false;
    this.networkManager = data.networkManager || null;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Get reference to game scene
    this.gameScene = this.scene.get('GameScene');

    // Create UI elements
    this.createControlButtons();
    // this.createScoreboard();

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
    
    // Create bidding UI
    this.biddingUI = new BiddingUI(
      this,
      (bid) => this.onBidSelected(bid),
      this.audioManager
    );

    // Listen for game events
    this.setupEventListeners();
  }

  createControlButtons() {
    const { width, height } = this.cameras.main;

    // Get responsive sizing from centralized config
    const config = getResponsiveConfig(SETTINGS_ICON_CONFIG, width, height);
    const { iconSize, fontSize, margin } = config;

    // Settings gear icon button - ensure it's visible with proper margin
    const settingsBtn = this.add.container(width - margin, margin);
    settingsBtn.setDepth(1000); // Ensure it's on top

    // Simple circular background
    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 0.9);
    bg.fillCircle(0, 0, iconSize);
    bg.lineStyle(2, 0x6366f1, 0.5);
    bg.strokeCircle(0, 0, iconSize);

    const icon = this.add.text(0, 0, '\u2699', {
      fontFamily: 'Arial, sans-serif',
      fontSize: fontSize,
      color: '#94a3b8',
    }).setOrigin(0.5);

    settingsBtn.add([bg, icon]);
    settingsBtn.setInteractive(new Phaser.Geom.Circle(0, 0, iconSize + 5), Phaser.Geom.Circle.Contains);

    settingsBtn.on('pointerover', () => {
      icon.setColor('#ffffff');
      this.tweens.add({ targets: settingsBtn, scaleX: 1.1, scaleY: 1.1, duration: 100 });
    });
    settingsBtn.on('pointerout', () => {
      icon.setColor('#94a3b8');
      this.tweens.add({ targets: settingsBtn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    settingsBtn.on('pointerdown', () => {
      this.audioManager.playButtonSound();
      this.showSettingsOverlay();
    });

    this.createSettingsOverlay();
  }

  createSettingsOverlay() {
    const { width, height } = this.cameras.main;

    this.settingsOverlay = this.add.container(width / 2, height / 2);
    this.settingsOverlay.setVisible(false);
    this.settingsOverlay.setDepth(200);

    // Blur overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(-width / 2, -height / 2, width, height);
    overlay.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', () => this.hideSettingsOverlay());

    // Modern panel
    const panelWidth = 260;
    const panelHeight = 280;

    // Glow effect
    const glow = this.add.graphics();
    glow.fillStyle(0x6366f1, 0.1);
    glow.fillRoundedRect(-panelWidth / 2 - 4, -panelHeight / 2 - 4, panelWidth + 8, panelHeight + 8, 18);

    const panel = this.add.graphics();
    panel.fillStyle(0x1a1a2e, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    panel.lineStyle(1, 0x6366f1, 0.4);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);

    // Make panel interactive to prevent click-through to overlay
    panel.setInteractive(new Phaser.Geom.Rectangle(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight), Phaser.Geom.Rectangle.Contains);
    panel.on('pointerdown', (_pointer, _localX, _localY, event) => {
      // Stop event propagation to prevent overlay from closing
      event.stopPropagation();
    });

    this.settingsOverlay.add([overlay, glow, panel]);

    // Settings items
    const startY = -90;
    const itemSpacing = 50;

    // Music row
    this.createSettingRow(0, startY, 'Music', this.audioManager.isMusicEnabled(), (enabled) => {
      this.audioManager.toggleMusic();
    });

    // Sound row
    this.createSettingRow(0, startY + itemSpacing, 'Sound', this.audioManager.isSoundEnabled(), (enabled) => {
      this.audioManager.toggleButtonSound();
    });

    // Divider
    const divider = this.add.graphics();
    divider.fillStyle(0x475569, 0.3);
    divider.fillRect(-100, startY + itemSpacing * 2 - 15, 200, 1);
    this.settingsOverlay.add(divider);

    // Action buttons
    this.createActionButton(0, startY + itemSpacing * 2 + 15, 'New Game', false, () => {
      this.hideSettingsOverlay();
      this.gameScene.restartGame();
    });

    this.createActionButton(0, startY + itemSpacing * 3 + 15, 'Quit', true, () => {
      this.hideSettingsOverlay();
      this.gameScene.returnToMenu();
    });
  }

  createSettingRow(x, y, label, initialState, callback) {
    const container = this.add.container(x, y);
    let isEnabled = initialState;
    const { width, height } = this.cameras.main;

    // Label with responsive font size
    const labelText = this.add.text(-100, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('settingsLabel', width, height),
      color: '#e2e8f0',
    }).setOrigin(0, 0.5);

    // Toggle pill
    const toggleWidth = 46;
    const toggleHeight = 26;
    const toggleBg = this.add.graphics();
    const toggleKnob = this.add.graphics();

    const drawToggle = () => {
      toggleBg.clear();
      toggleBg.fillStyle(isEnabled ? 0x6366f1 : 0x334155, 1);
      toggleBg.fillRoundedRect(100 - toggleWidth, -toggleHeight / 2, toggleWidth, toggleHeight, toggleHeight / 2);

      toggleKnob.clear();
      toggleKnob.fillStyle(0xffffff, 1);
      const knobX = isEnabled ? 100 - 14 : 100 - toggleWidth + 14;
      toggleKnob.fillCircle(knobX, 0, 10);
    };
    drawToggle();

    const hitArea = this.add.rectangle(100 - toggleWidth / 2, 0, toggleWidth + 10, toggleHeight + 10, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => {
      isEnabled = !isEnabled;
      drawToggle();
      this.audioManager.playButtonSound();
      callback(isEnabled);
    });

    container.add([labelText, toggleBg, toggleKnob, hitArea]);
    this.settingsOverlay.add(container);

    return { container, setEnabled: (val) => { isEnabled = val; drawToggle(); } };
  }

  createActionButton(x, y, label, isDanger, callback) {
    const { width, height } = this.cameras.main;

    const button = Button.createActionButton(this, x, y, {
      width: 180,
      height: 44,
      text: label,
      onClick: callback,
      isDanger,
      fontSize: getFontSize('actionButton', width, height),
      audioManager: this.audioManager
    });

    this.settingsOverlay.add(button);
    return button;
  }

  showSettingsOverlay() {
    this.settingsOverlay.setVisible(true);
    this.settingsOverlay.alpha = 0;
    this.settingsOverlay.setScale(0.95);
    this.tweens.add({
      targets: this.settingsOverlay,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }

  hideSettingsOverlay() {
    this.tweens.add({
      targets: this.settingsOverlay,
      alpha: 0,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 100,
      onComplete: () => {
        this.settingsOverlay.setVisible(false);
      },
    });
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

  onBidSelected(bid) {
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
    this.gameScene.events.on('roundComplete', (data) => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
      this.time.delayedCall(500, () => this.roundModal.showRoundResults(data));
    });

    // Game complete
    this.gameScene.events.on('gameComplete', (data) => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
      this.time.delayedCall(500, () => this.gameOverModal.showGameResults(data));
    });
  }

  setupSoloEventListeners() {
    // Listen for phase changes from game scene
    this.gameScene.events.on('phaseChanged', (phase) => {
      if (phase === PHASE.BIDDING) {
        // Check if it's human's turn to bid
        if (this.gameManager && this.gameManager.biddingPlayer === 0) {
          this.biddingUI.show();
        }
      }
    });

    // Bid placed
    this.gameScene.events.on('bidPlaced', ({ playerIndex }) => {
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
    this.gameScene.events.on('phaseChanged', (phase) => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
      if (phase === 'bidding') {
        // Add slight delay to ensure currentTurn state is updated
        this.time.delayedCall(100, () => {
          if (this.networkManager.isMyTurn()) {
            this.biddingUI.show();
          }
        });
      }
    });

    // Turn change - show bidding UI if it's bidding phase and our turn
    this.networkManager.on('turnChange', ({ isMyTurn }) => {
      const phase = this.networkManager.getPhase();
      if (phase === 'bidding' && isMyTurn) {
        this.time.delayedCall(300, () => this.biddingUI.show());
      }
    });

    // Score updates
    this.networkManager.on('playerScoreChange', () => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
    });

    // Bid placed
    this.networkManager.on('playerBid', () => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
    });

    // Tricks won update
    this.networkManager.on('playerTricksWon', () => {
      this.scoreBoard.updateScoreboard(this.getPlayersData(), this.getCurrentRound());
    });
  }

}
