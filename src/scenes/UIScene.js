import Phaser from 'phaser';
import { COLORS, PHASE, TOTAL_ROUNDS, MAX_BID } from '../utils/constants.js';

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
    this.createScoreboard();
    this.createBiddingUI();
    this.createModals();

    // Listen for game events
    this.setupEventListeners();
  }

  createControlButtons() {
    const { width, height } = this.cameras.main;

    // Calculate responsive sizing
    const isMobile = width < 600 || height < 500;
    const iconSize = isMobile ? 24 : 18;
    const fontSize = isMobile ? '28px' : '20px';
    const margin = isMobile ? 40 : 28;

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

    // Label
    const labelText = this.add.text(-100, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
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
    const container = this.add.container(x, y);
    const btnWidth = 180;
    const btnHeight = 44;
    const radius = btnHeight / 2; // Fully rounded (pill shape)

    // Shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(-btnWidth / 2 + 3, -btnHeight / 2 + 4, btnWidth, btnHeight, radius);

    const bg = this.add.graphics();
    const drawBg = (hover = false) => {
      bg.clear();
      if (isDanger) {
        bg.fillStyle(hover ? 0xb91c1c : 0x991b1b, 1);
      } else {
        bg.fillStyle(hover ? 0x7c3aed : 0x6366f1, 1);
      }
      bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, radius);
    };
    drawBg();

    const labelText = this.add.text(0, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([shadow, bg, labelText]);
    container.setInteractive(new Phaser.Geom.Rectangle(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight), Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      drawBg(true);
      this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 100 });
    });
    container.on('pointerout', () => {
      drawBg(false);
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    });
    container.on('pointerdown', () => {
      this.audioManager.playButtonSound();
      callback();
    });

    this.settingsOverlay.add(container);
    return container;
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

  createScoreboard() {
    const { width, height } = this.cameras.main;

    // Calculate responsive sizing
    const isMobile = width < 600 || height < 500;
    const margin = isMobile ? 15 : 20;
    const marginTop = isMobile ? 20 : 25;

    // Modern compact horizontal scoreboard (pill-shaped)
    this.scoreboard = this.add.container(margin, marginTop);
    this.scoreboard.setDepth(1000); // Ensure it's always on top

    // Store responsive values for updates
    this.scoreboardConfig = {
      isMobile,
      roundFontSize: isMobile ? '16px' : '14px',
      emojiFontSize: isMobile ? '22px' : '18px',
      scoreFontSize: isMobile ? '16px' : '13px',
      padding: isMobile ? 20 : 16,
      spacing: isMobile ? 8 : 6,
    };

    // We'll rebuild the scoreboard content on each update
    this.scoreboardBg = this.add.graphics();
    this.scoreboard.add(this.scoreboardBg);

    // Round text
    this.roundIndicator = this.add.text(this.scoreboardConfig.padding, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: this.scoreboardConfig.roundFontSize,
      fontStyle: 'bold',
      color: '#94a3b8',
    }).setOrigin(0, 0.5);
    this.scoreboard.add(this.roundIndicator);

    // Divider
    this.divider = this.add.graphics();
    this.scoreboard.add(this.divider);

    // Player score entries (emoji + score)
    this.playerScoreEntries = [];
    const players = this.getPlayersData();

    players.forEach((player, index) => {
      const entry = {
        emoji: this.add.text(0, 0, player.emoji, {
          fontFamily: 'Arial, sans-serif',
          fontSize: this.scoreboardConfig.emojiFontSize,
        }).setOrigin(0, 0.5),
        score: this.add.text(0, 0, '0.0', {
          fontFamily: 'Arial, sans-serif',
          fontSize: this.scoreboardConfig.scoreFontSize,
          fontStyle: 'bold',
          color: '#22c55e',
        }).setOrigin(0, 0.5),
        playerId: this.isMultiplayer ? player.id : index,
      };
      this.scoreboard.add([entry.emoji, entry.score]);
      this.playerScoreEntries.push(entry);
    });

    this.updateScoreboard();
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

  updateScoreboard() {
    const players = this.getPlayersData();
    const round = this.getCurrentRound();
    const config = this.scoreboardConfig;

    // Update round indicator
    this.roundIndicator.setText(`R${round}/${TOTAL_ROUNDS}`);

    // Sort players by score for coloring
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const topPlayer = sortedPlayers[0];

    // Calculate positions with responsive padding
    let xOffset = config.padding;
    const roundWidth = this.roundIndicator.width;
    xOffset += roundWidth + (config.isMobile ? 16 : 14);

    // Draw divider
    this.divider.clear();
    this.divider.fillStyle(0x475569, 1);
    const dividerHeight = config.isMobile ? 24 : 20;
    this.divider.fillRect(xOffset, -dividerHeight / 2, 2, dividerHeight);
    xOffset += config.isMobile ? 20 : 16;

    // Position each player entry
    this.playerScoreEntries.forEach((entry, index) => {
      const player = players[index];
      if (!player) return;

      const score = player.score;

      entry.emoji.setX(xOffset);
      entry.emoji.setY(0);
      xOffset += entry.emoji.width + config.spacing;

      entry.score.setText(score.toFixed(1));
      entry.score.setX(xOffset);
      entry.score.setY(0);

      // Color based on ranking and score
      const isTopPlayer = this.isMultiplayer ? player.id === topPlayer?.id : player === topPlayer;
      if (isTopPlayer && score > 0) {
        entry.score.setColor('#facc15'); // Yellow for leader
      } else if (score >= 0) {
        entry.score.setColor('#22c55e'); // Green for positive
      } else {
        entry.score.setColor('#ef4444'); // Red for negative
      }

      xOffset += entry.score.width + (config.isMobile ? 20 : 16);
    });

    // Draw background pill with responsive height
    const totalWidth = xOffset;
    const height = config.isMobile ? 44 : 36;

    this.scoreboardBg.clear();
    this.scoreboardBg.fillStyle(0x0f172a, 0.95);
    this.scoreboardBg.fillRoundedRect(0, -height / 2, totalWidth, height, height / 2);
    this.scoreboardBg.lineStyle(config.isMobile ? 2 : 1, 0x6366f1, 0.6);
    this.scoreboardBg.strokeRoundedRect(0, -height / 2, totalWidth, height, height / 2);
  }

  getPhase() {
    if (this.isMultiplayer && this.networkManager) {
      return this.networkManager.getPhase();
    } else if (this.gameManager) {
      return this.gameManager.getPhase();
    }
    return 'waiting';
  }

  createBiddingUI() {
    const { width, height } = this.cameras.main;

    // Bidding container (hidden by default) - positioned higher to avoid cards
    this.biddingUI = this.add.container(width / 2, height * 0.55);
    this.biddingUI.setVisible(false);
    this.biddingUI.setDepth(50);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.PANEL_BG, 0.95);
    bg.fillRoundedRect(-200, -40, 400, 80, 15);
    bg.lineStyle(2, COLORS.PRIMARY, 0.5);
    bg.strokeRoundedRect(-200, -40, 400, 80, 15);

    // Title
    const title = this.add.text(0, -25, 'Place Your Bid', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.biddingUI.add([bg, title]);

    // Bid buttons (1 to MAX_BID)
    this.bidButtons = [];
    const buttonWidth = 36;
    const spacing = 4;
    const totalWidth = MAX_BID * buttonWidth + (MAX_BID - 1) * spacing;
    const startX = -totalWidth / 2 + buttonWidth / 2;

    for (let i = 1; i <= MAX_BID; i++) {
      const x = startX + (i - 1) * (buttonWidth + spacing);

      const button = this.add.container(x, 10);

      const btnBg = this.add.graphics();
      btnBg.fillStyle(COLORS.PRIMARY, 1);
      btnBg.fillRoundedRect(-buttonWidth / 2, -15, buttonWidth, 30, 5);

      const btnText = this.add.text(0, 0, `${i}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      button.add([btnBg, btnText]);

      // Make interactive
      button.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth / 2, -15, buttonWidth, 30), Phaser.Geom.Rectangle.Contains);

      button.on('pointerover', () => {
        this.tweens.add({ targets: button, scaleY: 1.2, duration: 100 });
      });

      button.on('pointerout', () => {
        this.tweens.add({ targets: button, scaleY: 1, duration: 100 });
      });

      button.on('pointerdown', () => {
        this.audioManager.playButtonSound();
        this.onBidSelected(i);
      });

      this.biddingUI.add(button);
      this.bidButtons.push(button);
    }
  }

  showBiddingUI() {
    this.biddingUI.setVisible(true);
    this.biddingUI.alpha = 0;
    this.biddingUI.y = this.cameras.main.height * 0.6;
    this.tweens.add({
      targets: this.biddingUI,
      alpha: 1,
      y: this.cameras.main.height * 0.55,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  hideBiddingUI() {
    this.tweens.add({
      targets: this.biddingUI,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.biddingUI.setVisible(false);
      },
    });
  }

  onBidSelected(bid) {
    this.hideBiddingUI();
    if (this.isMultiplayer) {
      this.gameScene.onMultiplayerBid(bid);
    } else {
      this.gameScene.onHumanBid(bid);
    }
  }

  createModals() {
    // Round summary modal
    this.roundModal = this.createModal('Round Complete');
    this.roundModalContent = this.add.container(0, 0);
    this.roundModal.add(this.roundModalContent);

    // Game over modal
    this.gameOverModal = this.createModal('Game Over');
    this.gameOverModalContent = this.add.container(0, 0);
    this.gameOverModal.add(this.gameOverModalContent);
  }

  createModal(title) {
    const { width, height } = this.cameras.main;

    const modal = this.add.container(width / 2, height / 2);
    modal.setVisible(false);
    modal.setDepth(100);

    // Overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(-width / 2, -height / 2, width, height);

    // Modal background
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.PANEL_BG, 1);
    bg.fillRoundedRect(-200, -150, 400, 300, 20);
    bg.lineStyle(2, COLORS.PRIMARY, 0.5);
    bg.strokeRoundedRect(-200, -150, 400, 300, 20);

    // Title
    const titleText = this.add.text(0, -120, title, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    modal.add([overlay, bg, titleText]);

    return modal;
  }

  showRoundModal(data) {
    this.roundModalContent.removeAll(true);

    // Player results
    data.players.forEach((player, index) => {
      const y = -60 + index * 35;

      const name = this.add.text(-150, y, `${player.name}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
      });

      const result = this.add.text(0, y, `${player.tricksWon}/${player.bid}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#94a3b8',
      }).setOrigin(0.5);

      const score = this.add.text(150, y, player.roundScore >= 0 ? `+${player.roundScore.toFixed(1)}` : `${player.roundScore.toFixed(1)}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: player.roundScore >= 0 ? '#22c55e' : '#ef4444',
      }).setOrigin(1, 0);

      this.roundModalContent.add([name, result, score]);
    });

    // Continue button
    const button = this.createModalButton(0, 100, 'Continue', () => {
      this.hideRoundModal();
      this.gameScene.continueToNextRound();
    });
    this.roundModalContent.add(button);

    this.roundModal.setVisible(true);
    this.roundModal.alpha = 0;
    this.tweens.add({ targets: this.roundModal, alpha: 1, duration: 300 });
  }

  hideRoundModal() {
    this.tweens.add({
      targets: this.roundModal,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.roundModal.setVisible(false);
      },
    });
  }

  showGameOverModal(data) {
    this.gameOverModalContent.removeAll(true);

    // Winner announcement
    const winner = data.winner;
    const winnerText = this.add.text(0, -70, `${winner.emoji} ${winner.name} Wins!`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.gameOverModalContent.add(winnerText);

    // Final scores
    data.players.forEach((player, index) => {
      const y = -20 + index * 30;

      const name = this.add.text(-100, y, `${player.emoji} ${player.name}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: index === 0 ? '#fbbf24' : '#ffffff',
      });

      const score = this.add.text(100, y, player.score.toFixed(1), {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: index === 0 ? '#fbbf24' : '#94a3b8',
      }).setOrigin(1, 0);

      this.gameOverModalContent.add([name, score]);
    });

    // Buttons
    const playAgainBtn = this.createModalButton(-70, 110, 'Play Again', () => {
      this.hideGameOverModal();
      this.gameScene.restartGame();
    });

    const menuBtn = this.createModalButton(70, 110, 'Menu', () => {
      this.hideGameOverModal();
      this.gameScene.returnToMenu();
    });

    this.gameOverModalContent.add([playAgainBtn, menuBtn]);

    this.gameOverModal.setVisible(true);
    this.gameOverModal.alpha = 0;
    this.tweens.add({ targets: this.gameOverModal, alpha: 1, duration: 300 });
  }

  hideGameOverModal() {
    this.tweens.add({
      targets: this.gameOverModal,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.gameOverModal.setVisible(false);
      },
    });
  }

  createModalButton(x, y, text, callback) {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.PRIMARY, COLORS.SECONDARY, COLORS.PRIMARY, COLORS.SECONDARY);
    bg.fillRoundedRect(-60, -18, 120, 36, 8);

    const btnText = this.add.text(0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, btnText]);

    container.setInteractive(new Phaser.Geom.Rectangle(-60, -18, 120, 36), Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });

    container.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    });

    container.on('pointerdown', () => {
      this.audioManager.playButtonSound();
      callback();
    });

    return container;
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
      this.updateScoreboard();
      this.time.delayedCall(500, () => this.showRoundModal(data));
    });

    // Game complete
    this.gameScene.events.on('gameComplete', (data) => {
      this.updateScoreboard();
      this.time.delayedCall(500, () => this.showGameOverModal(data));
    });
  }

  setupSoloEventListeners() {
    // Listen for phase changes from game scene
    this.gameScene.events.on('phaseChanged', (phase) => {
      if (phase === PHASE.BIDDING) {
        // Check if it's human's turn to bid
        if (this.gameManager && this.gameManager.biddingPlayer === 0) {
          this.showBiddingUI();
        }
      }
    });

    // Bid placed
    this.gameScene.events.on('bidPlaced', ({ playerIndex }) => {
      // If next bidder is human, show bidding UI
      if (playerIndex < 3) {
        const nextBidder = playerIndex + 1;
        if (nextBidder === 0) {
          this.time.delayedCall(500, () => this.showBiddingUI());
        }
      }
    });
  }

  setupMultiplayerEventListeners() {
    // Listen for phase changes - show bidding UI when it's our turn
    this.gameScene.events.on('phaseChanged', (phase) => {
      this.updateScoreboard();
      if (phase === 'bidding') {
        // Add slight delay to ensure currentTurn state is updated
        this.time.delayedCall(100, () => {
          if (this.networkManager.isMyTurn()) {
            this.showBiddingUI();
          }
        });
      }
    });

    // Turn change - show bidding UI if it's bidding phase and our turn
    this.networkManager.on('turnChange', ({ isMyTurn }) => {
      const phase = this.networkManager.getPhase();
      if (phase === 'bidding' && isMyTurn) {
        this.time.delayedCall(300, () => this.showBiddingUI());
      }
    });

    // Score updates
    this.networkManager.on('playerScoreChange', () => {
      this.updateScoreboard();
    });

    // Bid placed
    this.networkManager.on('playerBid', () => {
      this.updateScoreboard();
    });

    // Tricks won update
    this.networkManager.on('playerTricksWon', () => {
      this.updateScoreboard();
    });
  }

}
