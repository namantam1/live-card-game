import Hand from './Hand';
import {
  PLAYER_POSITIONS,
  COLORS,
  type Position,
  type Suit,
} from '../utils/constants';
import {
  TURN_INDICATOR_CONFIG,
  getFontSize,
  getResponsiveConfig,
} from '../utils/uiConfig';
import { Scene } from 'phaser';
import type { CardData, TrickEntry } from '../type';
import ReactionAnimation from '../components/shared/ReactionAnimation';

export default class Player {
  scene: Scene;
  index: number;
  name: string;
  emoji: string;
  isHuman: boolean;
  bid: number;
  tricksWon: number;
  score: number;
  roundScore: number;
  position: Position;
  hand: Hand;
  networkId: string | null = null;
  absoluteSeatIndex: number | null = null;
  nameLabel!: Phaser.GameObjects.Text;
  statsLabel!: Phaser.GameObjects.Text;
  labelBackground!: Phaser.GameObjects.Graphics;
  turnIndicator!: Phaser.GameObjects.Graphics;

  constructor(
    scene: Scene,
    index: number,
    name: string,
    emoji: string,
    isHuman = false,
    onCardPlay?: (data: CardData) => void
  ) {
    this.scene = scene;
    this.index = index;
    this.name = name;
    this.emoji = emoji;
    this.isHuman = isHuman;

    // Game state
    this.bid = 0;
    this.tricksWon = 0;
    this.score = 0;
    this.roundScore = 0;

    // Position mapping: 0=bottom (human), 1=left, 2=top, 3=right
    const positions: Position[] = ['bottom', 'left', 'top', 'right'];
    this.position = positions[index];

    // Create hand
    this.hand = new Hand(scene, {
      position: this.position,
      isHuman,
      onCardPlay,
    });

    // Create player label
    this.createLabel();
  }

  private createLabel() {
    const { width, height } = this.scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[this.position];

    let labelX, labelY;

    switch (this.position) {
      case 'bottom':
        labelX = width * 0.5;
        labelY = height * posConfig.labelY!;
        break;
      case 'top':
        labelX = width * 0.5;
        labelY = height * posConfig.labelY! - 20;
        break;
      case 'left':
        labelX = width * posConfig.labelX! - 20;
        labelY = height * 0.5;
        break;
      case 'right':
        labelX = width * posConfig.labelX! + 20;
        labelY = height * 0.5;
        break;
    }

    // Create background graphics
    this.labelBackground = this.scene.add.graphics();
    this.labelBackground.setDepth(99);

    // Player name with emoji using responsive font size
    this.nameLabel = this.scene.add
      .text(labelX, labelY, `${this.emoji} ${this.name}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: getFontSize('playerName', width, height),
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(100);

    // Bid/tricks indicator (shown during gameplay) with responsive font size
    // For top and bottom players, show stats to the right of name
    // For left and right players, show stats below name
    let statsX, statsY, statsOrigin;

    if (this.position === 'bottom' || this.position === 'top') {
      // Position to the right of the name label
      statsX = labelX + this.nameLabel.width / 2 + 15;
      statsY = labelY;
      statsOrigin = { x: 0, y: 0.5 };
    } else {
      // Position below the name label (left/right players)
      statsX = labelX;
      statsY = labelY + 25;
      statsOrigin = { x: 0.5, y: 0.5 };
    }

    this.statsLabel = this.scene.add
      .text(statsX, statsY, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: getFontSize('playerStats', width, height),
        fontStyle: 'bold',
        color: '#fbbf24',
        stroke: '#000000',
        strokeThickness: 2.5,
      })
      .setOrigin(statsOrigin.x, statsOrigin.y)
      .setDepth(100);

    // Turn indicator
    this.turnIndicator = this.scene.add.graphics();
    this.turnIndicator.setVisible(false);
    this.turnIndicator.setDepth(99); // Slightly below labels but above cards
  }

  private updateLabelBackground() {
    this.labelBackground.clear();

    const nameBounds = this.nameLabel.getBounds();
    const statsBounds = this.statsLabel.getBounds();

    let bgX, bgY, bgWidth, bgHeight;
    const padding = 8;
    const radius = 8;

    const leftMost = Math.min(nameBounds.left, statsBounds.left);
    const rightMost = Math.max(nameBounds.right, statsBounds.right);
    const topMost = Math.min(nameBounds.top, statsBounds.top);
    const bottomMost = Math.max(nameBounds.bottom, statsBounds.bottom);

    bgX = leftMost - padding;
    bgY = topMost - padding;
    bgWidth = rightMost - leftMost + padding * 2;
    bgHeight = bottomMost - topMost + padding * 2;

    // Draw rounded rectangle with border
    this.labelBackground.fillStyle(0x1e293b, 0.95);
    this.labelBackground.fillRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);

    this.labelBackground.lineStyle(2, 0x475569, 1);
    this.labelBackground.strokeRoundedRect(bgX, bgY, bgWidth, bgHeight, radius);
  }

  setCards(cardDataArray: CardData[], animate = true) {
    return this.hand.setCards(cardDataArray, animate);
  }

  updatePlayableCards(leadSuit: Suit, currentTrick: TrickEntry[] = []) {
    this.hand.updatePlayableCards(leadSuit, currentTrick);
  }

  disableAllCards() {
    this.hand.disableAllCards();
  }

  removeCard(cardData: CardData) {
    return this.hand.removeCard(cardData);
  }

  getCardData() {
    return this.hand.getCardData();
  }

  setBid(bid: number) {
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
      this.updateLabelBackground();
    } else {
      this.statsLabel.setText('');
      this.updateLabelBackground();
    }
  }

  setRoundScore(score: number) {
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
    this.bid = 0;
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

  showReaction(emoji: string): void {
    // Get actual x,y coordinates from the position
    const { width, height } = this.scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[this.position];
    const x = width * posConfig.x;
    const y = height * posConfig.y;
    ReactionAnimation.show(this.scene, x, y - 50, emoji, this.name);
  }

  destroy() {
    this.hand.clearCards();
    this.nameLabel.destroy();
    this.statsLabel.destroy();
    this.labelBackground.destroy();
    this.turnIndicator.destroy();
  }
}
