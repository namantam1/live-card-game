import Phaser from 'phaser';
import Card from './Card.js';
import { ANIMATION, COLORS } from '../utils/constants.js';
import { getCardAssetKey } from '../utils/cards.js';
import { CARD_CONFIG, isMobile } from '../config/uiConfig.js';

export default class TrickArea extends Phaser.GameObjects.Container {
  constructor(scene) {
    const { width, height } = scene.cameras.main;
    super(scene, width / 2, height / 2);

    this.playedCards = [];

    // Calculate responsive card scale for trick area using centralized config
    const mobile = isMobile(width, height);
    this.trickCardScale = mobile ? CARD_CONFIG.MOBILE_SCALE : CARD_CONFIG.DESKTOP_SCALE;

    // Card positions for each player (relative to center)
    // Diamond pattern: each player's card faces toward center
    this.cardOffsets = [
      { x: 0, y: 50, rotation: 0 },      // Player 0 (bottom)
      { x: -70, y: 0, rotation: -5 },    // Player 1 (left)
      { x: 0, y: -50, rotation: 2 },     // Player 2 (top)
      { x: 70, y: 0, rotation: 5 },      // Player 3 (right)
    ];

    scene.add.existing(this);
  }

  async playCard(cardData, playerIndex, fromCard = null) {
    // Handle invalid or undefined playerIndex
    if (playerIndex === undefined || playerIndex === null || playerIndex < 0 || playerIndex >= this.cardOffsets.length) {
      console.warn(`TrickArea: Invalid playerIndex ${playerIndex}, defaulting to 0`);
      playerIndex = 0;
    }

    const offset = this.cardOffsets[playerIndex];
    const targetX = this.x + offset.x;
    const targetY = this.y + offset.y;

    let card;

    if (fromCard) {
      // Use existing card object and animate it
      card = fromCard;

      // Prepare card for play - kills any existing tweens and cleans up state
      card.prepareForPlay();

      // If card was face down (placeholder or bot), update it with actual card data and flip
      if (card.isFaceDown) {
        // Update card data to the actual card being played
        card.cardData = cardData;
        await card.flip(false);
      }

      // Normalize scale to match trick area scale (in case hand scale differs)
      card.setScale(this.trickCardScale);

      // Animate to center
      await card.animateToWithBounce(targetX, targetY, ANIMATION.CARD_TO_CENTER);
      card.rotation = Phaser.Math.DegToRad(offset.rotation);
    } else {
      // Create new card at center position
      card = new Card(this.scene, targetX, targetY, cardData, false);
      card.setScale(this.trickCardScale); // Use consistent scale
      card.rotation = Phaser.Math.DegToRad(offset.rotation);
    }

    // Play sound
    this.playCardSound();

    this.playedCards.push({
      playerIndex,
      card,
      cardData,
    });

    // Bring to front
    this.scene.children.bringToTop(card);

    return card;
  }

  playCardSound() {
    // Simple beep sound using Web Audio
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  }

  async collectTrick(winnerIndex) {
    const { width, height } = this.scene.cameras.main;

    // Determine winner position
    const winnerPositions = [
      { x: width / 2, y: height },         // Player 0 (bottom)
      { x: 0, y: height / 2 },             // Player 1 (left)
      { x: width / 2, y: 0 },              // Player 2 (top)
      { x: width, y: height / 2 },         // Player 3 (right)
    ];

    const target = winnerPositions[winnerIndex];

    // Animate all cards to winner
    const promises = this.playedCards.map(({ card }, index) => {
      return new Promise((resolve) => {
        this.scene.tweens.add({
          targets: card,
          x: target.x,
          y: target.y,
          alpha: 0,
          scale: 0.5,
          duration: ANIMATION.TRICK_COLLECT,
          delay: index * 50,
          ease: 'Quad.easeIn',
          onComplete: () => {
            card.destroy();
            resolve();
          },
        });
      });
    });

    await Promise.all(promises);
    this.playedCards = [];
  }

  clear() {
    this.playedCards.forEach(({ card }) => card.destroy());
    this.playedCards = [];
  }

  getPlayedCards() {
    return this.playedCards.map(({ playerIndex, cardData }) => ({
      playerIndex,
      card: cardData,
    }));
  }
}
