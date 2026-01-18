import Phaser from 'phaser';
import Card from './Card.js';
import { CARD, ANIMATION, PLAYER_POSITIONS } from '../utils/constants.js';
import { sortHand, getValidCards } from '../utils/cards.js';

export default class Hand extends Phaser.GameObjects.Container {
  constructor(scene, position, isHuman = false) {
    const { width, height } = scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[position];

    super(scene, width * posConfig.x, height * posConfig.y);

    this.position = position;
    this.isHuman = isHuman;
    this.cards = [];
    this.rotation = Phaser.Math.DegToRad(posConfig.rotation);

    // Calculate responsive card scale based on screen size
    const isMobile = width < 600 || height < 500;
    this.cardScale = isMobile ? 0.55 : CARD.SCALE; // Smaller cards on mobile
    this.handOverlap = isMobile ? CARD.HAND_OVERLAP * 0.7 : CARD.HAND_OVERLAP;

    scene.add.existing(this);
  }

  setCards(cardDataArray, animate = true) {
    // Clear existing cards
    this.clearCards();

    // Sort hand
    const sortedCards = sortHand(cardDataArray);

    if (animate) {
      return this.dealCards(sortedCards);
    } else {
      this.createCards(sortedCards);
      this.arrangeCards(false);
      return Promise.resolve();
    }
  }

  async dealCards(cardDataArray) {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < cardDataArray.length; i++) {
      const cardData = cardDataArray[i];
      const faceDown = !this.isHuman;

      // Create card at center (deck position)
      const card = new Card(this.scene, centerX, centerY, cardData, faceDown);
      card.setScale(0.3 * this.cardScale / CARD.SCALE); // Scale relative to base scale

      // Calculate target position in hand
      const targetPos = this.getCardPosition(i, cardDataArray.length);

      // Animate to hand
      await new Promise((resolve) => {
        this.scene.tweens.add({
          targets: card,
          x: this.x + targetPos.x,
          y: this.y + targetPos.y,
          rotation: this.rotation + targetPos.rotation,
          scaleX: this.cardScale,
          scaleY: this.cardScale,
          duration: ANIMATION.CARD_DEAL,
          ease: 'Quad.easeOut',
          onComplete: resolve,
        });
      });

      card.originalY = this.y + targetPos.y;
      this.cards.push(card);

      // Setup click handler for human cards
      if (this.isHuman) {
        card.on('cardClicked', (data) => {
          this.emit('cardPlayed', data, card);
        });
      }
    }

    return Promise.resolve();
  }

  createCards(cardDataArray) {
    cardDataArray.forEach((cardData, index) => {
      const faceDown = !this.isHuman;
      const card = new Card(this.scene, 0, 0, cardData, faceDown);
      this.cards.push(card);

      if (this.isHuman) {
        card.on('cardClicked', (data) => {
          this.emit('cardPlayed', data, card);
        });
      }
    });
  }

  getCardPosition(index, total) {
    const overlap = this.isHuman ? this.handOverlap : this.handOverlap * 0.4;
    const totalSpan = (total - 1) * overlap;
    const startOffset = -totalSpan / 2;

    // Fan effect - slight rotation for each card (only for human player)
    const fanAngle = this.isHuman ? 2 : 0;
    const middleIndex = (total - 1) / 2;
    const angleOffset = (index - middleIndex) * fanAngle;

    // For left/right positions, stack cards vertically instead of horizontally
    const isVertical = this.position === 'left' || this.position === 'right';

    if (isVertical) {
      return {
        x: 0,
        y: startOffset + (index * overlap),
        rotation: Phaser.Math.DegToRad(angleOffset),
      };
    }

    return {
      x: startOffset + (index * overlap),
      y: 0,
      rotation: Phaser.Math.DegToRad(angleOffset),
    };
  }

  arrangeCards(animate = true) {
    const total = this.cards.length;

    this.cards.forEach((card, index) => {
      const pos = this.getCardPosition(index, total);
      const targetX = this.x + pos.x;
      const targetY = this.y + pos.y;
      const targetRotation = this.rotation + pos.rotation;

      if (animate) {
        this.scene.tweens.add({
          targets: card,
          x: targetX,
          y: targetY,
          rotation: targetRotation,
          scaleX: this.cardScale,
          scaleY: this.cardScale,
          duration: 200,
          ease: 'Quad.easeOut',
        });
      } else {
        card.x = targetX;
        card.y = targetY;
        card.rotation = targetRotation;
        card.setScale(this.cardScale);
      }

      card.originalY = targetY;
    });
  }

  updatePlayableCards(leadSuit) {
    if (!this.isHuman) return;

    const cardDataArray = this.cards.map(c => c.cardData);
    const validCards = getValidCards(cardDataArray, leadSuit);
    const validIds = new Set(validCards.map(c => c.id));

    this.cards.forEach(card => {
      card.setPlayable(validIds.has(card.cardData.id));
    });
  }

  disableAllCards() {
    this.cards.forEach(card => card.setPlayable(false));
  }

  enableInteraction() {
    // Enable all cards as playable (validation will happen on server)
    this.cards.forEach(card => card.setPlayable(true));
  }

  addCard(cardData, animate = true) {
    const faceDown = !this.isHuman;
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create card at center (deck position) or at hand position
    const card = new Card(this.scene, animate ? centerX : this.x, animate ? centerY : this.y, cardData, faceDown);

    if (animate) {
      card.setScale(0.3);
    }

    this.cards.push(card);

    // Setup click handler for human cards
    if (this.isHuman) {
      card.on('cardClicked', (data) => {
        this.emit('cardPlayed', data, card);
      });
    }

    // Rearrange all cards
    this.arrangeCards(animate);

    return card;
  }

  removeCard(cardDataOrId) {
    // Accept either cardData object or card ID string
    const cardId = typeof cardDataOrId === 'string' ? cardDataOrId : cardDataOrId.id;
    const index = this.cards.findIndex(c => c.cardData.id === cardId);
    if (index === -1) return null;

    const card = this.cards.splice(index, 1)[0];

    // Rearrange remaining cards
    this.arrangeCards(true);

    return card;
  }

  removeFirstCard() {
    // Remove the first card (used for remote players with placeholder cards)
    if (this.cards.length === 0) return null;

    const card = this.cards.shift();

    // Rearrange remaining cards
    this.arrangeCards(true);

    return card;
  }

  getCardByData(cardData) {
    return this.cards.find(c => c.cardData.id === cardData.id);
  }

  clearCards() {
    this.cards.forEach(card => card.destroy());
    this.cards = [];
  }

  getCardData() {
    return this.cards.map(c => c.cardData);
  }

  /**
   * Update the number of face-down placeholder cards (for remote players)
   * @param {number} count - Number of cards to display
   */
  updateCardCount(count) {
    if (this.isHuman) return; // Only for non-human players

    const currentCount = this.cards.length;

    if (count === currentCount) return;

    if (count > currentCount) {
      // Add placeholder cards
      const cardsToAdd = count - currentCount;
      for (let i = 0; i < cardsToAdd; i++) {
        // Create a dummy card object for placeholder
        const dummyCard = { id: `placeholder_${Date.now()}_${i}`, suit: '', rank: '', value: 0 };
        const card = new Card(this.scene, this.x, this.y, dummyCard, true);
        this.cards.push(card);
      }
    } else {
      // Remove cards
      const cardsToRemove = currentCount - count;
      for (let i = 0; i < cardsToRemove; i++) {
        const card = this.cards.pop();
        if (card) card.destroy();
      }
    }

    // Rearrange all cards
    this.arrangeCards(false);
  }
}
