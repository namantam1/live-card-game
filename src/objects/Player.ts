import Hand from './Hand';
import { PLAYER_POSITIONS, COLORS, Suit } from '../utils/constants';
import { Scene } from 'phaser';
import { CardType, Position } from '../types';

export default class Player {
  scene: Scene;
  index: number;
  name: string;
  emoji: string;
  isHuman: boolean;
  bid: number | null;
  tricksWon: number;
  score: number;
  roundScore: number;
  handPostion: Position;
  hand: Hand;
  nameLabel: any;
  statsLabel: any;
  turnIndicator: any;

  constructor(scene: Scene, index: number, name: string, emoji: string, isHuman = false) {
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
    const positions: Position[] = ['bottom', 'left', 'top', 'right'];
    this.handPostion = positions[index];

    // Create hand
    this.hand = new Hand(scene, this.handPostion, isHuman);

    // Create player label
    this.createLabel();
  }

  createLabel() {
    const { width, height } = this.scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[this.handPostion];

    let labelX, labelY;

    switch (this.handPostion) {
      case 'bottom':
        labelX = width * 0.5;
        labelY = height * posConfig.labelY!;
        break;
      case 'top':
        labelX = width * 0.5;
        labelY = height * posConfig.labelY!;
        break;
      case 'left':
        labelX = width * posConfig.labelX!;
        labelY = height * 0.5;
        break;
      case 'right':
        labelX = width * posConfig.labelX!;
        labelY = height * 0.5;
        break;
    }

    // Player name with emoji
    this.nameLabel = this.scene.add.text(labelX, labelY, `${this.emoji} ${this.name}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffffff',
      backgroundColor: 'rgba(30, 41, 59, 0.8)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    // Bid/tricks indicator (shown during gameplay)
    this.statsLabel = this.scene.add.text(labelX, labelY + 20, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Turn indicator
    this.turnIndicator = this.scene.add.graphics();
    this.turnIndicator.setVisible(false);
  }

  setCards(cardDataArray: CardType[], animate = true) {
    return this.hand.setCards(cardDataArray, animate);
  }

  updatePlayableCards(leadSuit: Suit) {
    this.hand.updatePlayableCards(leadSuit);
  }

  disableAllCards() {
    this.hand.disableAllCards();
  }

  removeCard(cardData: CardType) {
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
    } else {
      this.statsLabel.setText('');
    }
  }

  setRoundScore(score: number) {
    this.roundScore = score;
    this.score += score;
  }

  showTurnIndicator() {
    const { width, height } = this.scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[this.handPostion];

    this.turnIndicator.clear();
    this.turnIndicator.lineStyle(3, COLORS.PRIMARY, 1);

    // Draw circle around player area
    const x = width * posConfig.x;
    const y = height * posConfig.y;
    this.turnIndicator.strokeCircle(x, y, 80);

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
