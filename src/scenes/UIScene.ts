import Phaser from 'phaser';
import { COLORS, PHASE, TOTAL_ROUNDS, MAX_BID, GamePhase, EVENTS } from '../utils/constants';
import GameScene from './GameScene';
import Player from '../objects/Player';

export default class UIScene extends Phaser.Scene {
  gameManager: any;
  audioManager: any;
  gameScene!: GameScene;
  settingsOverlay!: Phaser.GameObjects.Container;
  scoreboard!: Phaser.GameObjects.Container;
  scoreboardBg!: Phaser.GameObjects.Graphics;
  roundIndicator!: Phaser.GameObjects.Text;
  divider!: Phaser.GameObjects.Graphics;
  playerScoreEntries?: any[];
  biddingUI!: Phaser.GameObjects.Container;
  bidButtons?: Phaser.GameObjects.Container[];
  roundModal!: Phaser.GameObjects.Container;
  roundModalContent!: Phaser.GameObjects.Container;
  gameOverModal!: Phaser.GameObjects.Container;
  gameOverModalContent!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'UIScene' });
  }

  init(data: any) {
    this.gameManager = data.gameManager;
    this.audioManager = data.audioManager;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Get reference to game scene
    this.gameScene = this.scene.get('GameScene') as GameScene;

    // Create UI elements
    this.createControlButtons();
    this.createScoreboard();
    this.createBiddingUI();
    this.createModals();

    // Listen for game events
    this.setupEventListeners();
  }

  createControlButtons() {
    const { width } = this.cameras.main;

    // Settings gear icon button
    const settingsBtn = this.add.container(width - 28, 28);

    // Simple circular background
    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 0.8);
    bg.fillCircle(0, 0, 18);

    const icon = this.add.text(0, 0, '\u2699', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    settingsBtn.add([bg, icon]);
    settingsBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains);

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
    this.createSettingRow(0, startY, 'Music', this.audioManager.isMusicEnabled(), (enabled: boolean) => {
      this.audioManager.toggleMusic();
    });

    // Sound row
    this.createSettingRow(0, startY + itemSpacing, 'Sound', this.audioManager.isSoundEnabled(), (enabled: boolean) => {
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

  createSettingRow(x: number, y: number, label: string, initialState: any, callback: Function) {
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

    if (!this.settingsOverlay) console.warn('Settings overlay not initialized');
    this.settingsOverlay?.add(container);

    return { container, setEnabled: (val: any) => { isEnabled = val; drawToggle(); } };
  }

  createActionButton(x: number, y: number, label: string, isDanger: boolean, callback: Function) {
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

    if (!this.settingsOverlay) console.warn('Settings overlay not initialized');
    this.settingsOverlay?.add(container);
    return container;
  }

  showSettingsOverlay() {
    if (!this.settingsOverlay) {
      console.warn('Settings overlay not initialized');
      return;
    }
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
        if (!this.settingsOverlay) console.warn('Settings overlay not initialized');
        this.settingsOverlay?.setVisible(false);
      },
    });
  }

  createScoreboard() {
    // Modern compact horizontal scoreboard (pill-shaped)
    this.scoreboard = this.add.container(20, 25);

    // We'll rebuild the scoreboard content on each update
    this.scoreboardBg = this.add.graphics();
    this.scoreboard.add(this.scoreboardBg);

    // Round text
    this.roundIndicator = this.add.text(16, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#94a3b8',
    }).setOrigin(0, 0.5);
    this.scoreboard.add(this.roundIndicator);

    // Divider
    this.divider = this.add.graphics();
    this.scoreboard.add(this.divider);

    // Player score entries (emoji + score)
    this.playerScoreEntries = [];
    const players = this.gameManager.getPlayers();

    players.forEach((player: Player, index: number) => {
      const entry = {
        emoji: this.add.text(0, 0, player.emoji, {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
        }).setOrigin(0, 0.5),
        score: this.add.text(0, 0, '0.0', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#22c55e',
        }).setOrigin(0, 0.5),
        player: player,
      };
      if (!this.scoreboard) console.warn('Scoreboard not initialized');
      this.scoreboard?.add([entry.emoji, entry.score]);
      if (!this.playerScoreEntries) console.warn('Player score entries not initialized');
      this.playerScoreEntries?.push(entry);
    });

    this.updateScoreboard();
  }

  updateScoreboard() {
    const players = this.gameManager.getPlayers();
    const round = this.gameManager.getCurrentRound();

    // Update round indicator
    if (!this.roundIndicator) console.warn('Round indicator not initialized');
    this.roundIndicator?.setText(`R${round}/${TOTAL_ROUNDS}`);

    // Sort players by score for coloring
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const topPlayer = sortedPlayers[0];

    // Calculate positions
    let xOffset = 16; // Starting padding
    const roundWidth = this.roundIndicator.width;
    xOffset += roundWidth + 14;

    // Draw divider
    this.divider.clear();
    this.divider.fillStyle(0x475569, 1);
    this.divider.fillRect(xOffset, -10, 2, 20);
    xOffset += 16;

    // Position each player entry
    this.playerScoreEntries?.forEach((entry, index) => {
      const player = entry.player;
      const score = player.score;

      entry.emoji.setX(xOffset);
      entry.emoji.setY(0);
      xOffset += entry.emoji.width + 4;

      entry.score.setText(score.toFixed(1));
      entry.score.setX(xOffset);
      entry.score.setY(0);

      // Color based on ranking and score
      if (player === topPlayer && score > 0) {
        entry.score.setColor('#facc15'); // Yellow for leader
      } else if (score >= 0) {
        entry.score.setColor('#22c55e'); // Green for positive
      } else {
        entry.score.setColor('#ef4444'); // Red for negative
      }

      xOffset += entry.score.width + 16;
    });

    // Draw background pill
    const totalWidth = xOffset;
    const height = 36;

    this.scoreboardBg.clear();
    this.scoreboardBg.fillStyle(0x0f172a, 0.9);
    this.scoreboardBg.fillRoundedRect(0, -height / 2, totalWidth, height, height / 2);
    this.scoreboardBg.lineStyle(1, 0x475569, 0.5);
    this.scoreboardBg.strokeRoundedRect(0, -height / 2, totalWidth, height, height / 2);
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

  onBidSelected(bid: number) {
    this.hideBiddingUI();
    this.gameScene.onHumanBid(bid);
  }

  createModals() {
    const { width, height } = this.cameras.main;

    // Round summary modal
    this.roundModal = this.createModal('Round Complete');
    this.roundModalContent = this.add.container(0, 0);
    this.roundModal.add(this.roundModalContent);

    // Game over modal
    this.gameOverModal = this.createModal('Game Over');
    this.gameOverModalContent = this.add.container(0, 0);
    this.gameOverModal.add(this.gameOverModalContent);
  }

  createModal(title: string) {
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

  showRoundModal(data: any) {
    this.roundModalContent.removeAll(true);

    // Player results
    data.players.forEach((player: Player, index: number) => {
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

  showGameOverModal(data: any) {
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
    data.players.forEach((player: Player, index: number) => {
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
        if (!this.gameOverModal) console.warn('Game over modal not initialized');
        this.gameOverModal?.setVisible(false);
      },
    });
  }

  createModalButton(x: number, y: number, text: string, callback: Function) {
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
    // Listen for phase changes from game scene
    this.gameScene.events.on(EVENTS.PHASE_CHANGED, (phase: GamePhase) => {
      if (phase === PHASE.BIDDING) {
        // Check if it's human's turn to bid
        const biddingPlayer = this.gameManager.biddingPlayer;
        if (biddingPlayer === 0) {
          this.showBiddingUI();
        }
      }
    });

    // Bid placed
    this.gameScene.events.on(EVENTS.BID_PLACED, ({ playerIndex, bid }: any) => {
      // If next bidder is human, show bidding UI
      if (playerIndex < 3) {
        const nextBidder = playerIndex + 1;
        if (nextBidder === 0) {
          this.time.delayedCall(500, () => this.showBiddingUI());
        }
      }
    });

    // Round complete
    this.gameScene.events.on(EVENTS.ROUND_COMPLETE, (data: any) => {
      this.updateScoreboard();
      this.time.delayedCall(500, () => this.showRoundModal(data));
    });

    // Game complete
    this.gameScene.events.on(EVENTS.GAME_COMPLETE, (data: any) => {
      this.updateScoreboard();
      this.time.delayedCall(500, () => this.showGameOverModal(data));
    });
  }
}
