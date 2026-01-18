import Hand from './Hand.js';
import { PLAYER_POSITIONS, COLORS } from '../utils/constants.js';
import { TURN_INDICATOR_CONFIG, isMobile, getFontSize, getResponsiveConfig } from '../config/uiConfig.js';

export default class Player {
  constructor(scene, index, name, emoji, isHuman = false) {
    this.scene = scene;
    this.index = index;
    this.name = name;
    this.emoji = emoji;
    this.isHuman = isHuman;

    // Game state
    this.bid = null;
    this.tricksWon = 0;
    this.score = 0;
    this.roundScore = 0;

    // Position mapping: 0=bottom (human), 1=left, 2=top, 3=right
    const positions = ['bottom', 'left', 'top', 'right'];
    this.position = positions[index];

    // Create hand
    this.hand = new Hand(scene, this.position, isHuman);

    // Create player label
    this.createLabel();
  }

  createLabel() {
    const { width, height } = this.scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[this.position];

    let labelX, labelY;

    switch (this.position) {
      case 'bottom':
        labelX = width * 0.5;
        labelY = height * posConfig.labelY;
        break;
      case 'top':
        labelX = width * 0.5;
        labelY = height * posConfig.labelY;
        break;
      case 'left':
        labelX = width * posConfig.labelX;
        labelY = height * 0.5;
        break;
      case 'right':
        labelX = width * posConfig.labelX;
        labelY = height * 0.5;
        break;
    }

    // Player name with emoji using responsive font size
    this.nameLabel = this.scene.add.text(labelX, labelY, `${this.emoji} ${this.name}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('playerName', width, height),
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: 'rgba(30, 41, 59, 0.8)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    // Bid/tricks indicator (shown during gameplay) with responsive font size
    // For top and bottom players, show stats to the right of name
    // For left and right players, show stats below name
    let statsX, statsY, statsOrigin;

    if (this.position === 'bottom' || this.position === 'top') {
      // Position to the right of the name label
      statsX = labelX + this.nameLabel.width / 2 + 10; // 10px gap from name
      statsY = labelY;
      statsOrigin = { x: 0, y: 0.5 }; // Left-aligned vertically centered
    } else {
      // Position below the name label (left/right players)
      statsX = labelX;
      statsY = labelY + 20;
      statsOrigin = { x: 0.5, y: 0.5 }; // Center-aligned
    }

    this.statsLabel = this.scene.add.text(statsX, statsY, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('playerStats', width, height),
      color: '#94a3b8',
    }).setOrigin(statsOrigin.x, statsOrigin.y);

    // Turn indicator
    this.turnIndicator = this.scene.add.graphics();
    this.turnIndicator.setVisible(false);
  }

  setCards(cardDataArray, animate = true) {
    return this.hand.setCards(cardDataArray, animate);
  }

  updatePlayableCards(leadSuit) {
    this.hand.updatePlayableCards(leadSuit);
  }

  disableAllCards() {
    this.hand.disableAllCards();
  }

  removeCard(cardData) {
    return this.hand.removeCard(cardData);
  }

  getCardData() {
    return this.hand.getCardData();
  }

  setBid(bid) {
    this.bid = bid;
    this.updateStats();
  }

  addTrick() {
    this.tricksWon++;
    this.updateStats();
  }

  updateStats() {
    if (this.bid !== null) {
      this.statsLabel.setText(`${this.tricksWon}/${this.bid}`);
    } else {
      this.statsLabel.setText('');
    }
  }

  setRoundScore(score) {
    this.roundScore = score;
    this.score += score;
  }

  showTurnIndicator() {
    const { width, height } = this.scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[this.position];
    const config = getResponsiveConfig(TURN_INDICATOR_CONFIG, width, height);

    this.turnIndicator.clear();
    this.turnIndicator.lineStyle(config.lineWidth, COLORS.PRIMARY, 1);

    // Draw circle around player area with responsive radius
    const x = width * posConfig.x;
    const y = height * posConfig.y;
    this.turnIndicator.strokeCircle(x, y, config.radius);

    this.turnIndicator.setVisible(true);

    // Pulse animation
    this.scene.tweens.add({
      targets: this.turnIndicator,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  hideTurnIndicator() {
    this.turnIndicator.setVisible(false);
    this.scene.tweens.killTweensOf(this.turnIndicator);
    this.turnIndicator.alpha = 1;
  }

  reset() {
    this.bid = null;
    this.tricksWon = 0;
    this.roundScore = 0;
    this.hand.clearCards();
    this.updateStats();
    this.hideTurnIndicator();
  }

  fullReset() {
    this.reset();
    this.score = 0;
  }

  destroy() {
    this.hand.clearCards();
    this.nameLabel.destroy();
    this.statsLabel.destroy();
    this.turnIndicator.destroy();
  }
}
