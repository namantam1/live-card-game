import Phaser, { Scene } from "phaser";
import Card from "./Card";
import {
  CARD,
  ANIMATION,
  PLAYER_POSITIONS,
  Position,
  Suit,
} from "../utils/constants";
import { sortHand, getValidCards } from "../utils/cards";
import { CARD_CONFIG, isMobile } from "../utils/uiConfig";
import { CardData } from "../type";

export default class Hand extends Phaser.GameObjects.Container {
  isHuman: boolean;
  cards: Card[];
  cardScale: number;
  handOverlap: number;
  playerPosition: string;

  constructor(scene: Scene, position: Position, isHuman = false) {
    const { width, height } = scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[position];

    super(scene, width * posConfig.x, height * posConfig.y);

    this.playerPosition = position;
    this.isHuman = isHuman;
    this.cards = [];
    this.rotation = Phaser.Math.DegToRad(posConfig.rotation);

    // Calculate responsive card scale based on screen size using centralized config
    const mobile = isMobile(width, height);
    this.cardScale = mobile
      ? CARD_CONFIG.MOBILE_SCALE
      : CARD_CONFIG.DESKTOP_SCALE;
    this.handOverlap = mobile
      ? CARD_CONFIG.HAND_OVERLAP * CARD_CONFIG.MOBILE_OVERLAP_MULTIPLIER
      : CARD_CONFIG.HAND_OVERLAP;

    scene.add.existing(this);
  }

  setCards(cardDataArray: CardData[], animate = true) {
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

  async dealCards(cardDataArray: CardData[]): Promise<void> {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < cardDataArray.length; i++) {
      const cardData = cardDataArray[i];
      const faceDown = !this.isHuman;

      // Create card at center (deck position)
      const card = new Card(this.scene, {
        x: centerX,
        y: centerY,
        cardData,
        faceDown,
        onClick: this.isHuman
          ? (data) => this.emit("cardPlayed", data, card)
          : undefined,
      });

      // Set initial small scale
      await card.moveTo({ scale: (0.3 * this.cardScale) / CARD.SCALE });

      // Calculate target position in hand
      const targetPos = this.getCardPosition(i, cardDataArray.length);

      // Animate to hand
      await card.moveTo({
        x: this.x + targetPos.x,
        y: this.y + targetPos.y,
        rotation: this.rotation + targetPos.rotation,
        scale: this.cardScale,
        animate: true,
        duration: ANIMATION.CARD_DEAL,
        ease: "Quad.easeOut",
      });

      this.cards.push(card);
    }

    return Promise.resolve();
  }

  createCards(cardDataArray: CardData[]): void {
    cardDataArray.forEach((cardData) => {
      const faceDown = !this.isHuman;
      const card = new Card(this.scene, {
        x: 0,
        y: 0,
        cardData,
        faceDown,
        onClick: this.isHuman
          ? (data) => this.emit("cardPlayed", data, card)
          : undefined,
      });
      this.cards.push(card);
    });
  }

  getCardPosition(index: number, total: number) {
    const overlap = this.isHuman ? this.handOverlap : this.handOverlap * 0.4;
    const totalSpan = (total - 1) * overlap;
    const startOffset = -totalSpan / 2;

    // Fan effect - slight rotation for each card (only for human player)
    const fanAngle = this.isHuman ? 5 : 0;
    const middleIndex = (total - 1) / 2;
    const angleOffset = (index - middleIndex) * fanAngle;

    // For left/right positions, stack cards vertically instead of horizontally
    const isVertical =
      this.playerPosition === "left" || this.playerPosition === "right";

    if (isVertical) {
      return {
        x: 0,
        y: startOffset + index * overlap,
        rotation: Phaser.Math.DegToRad(angleOffset),
      };
    }

    return {
      x: startOffset + index * overlap,
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

      card.moveTo({
        x: targetX,
        y: targetY,
        rotation: targetRotation,
        scale: this.cardScale,
        animate,
        duration: 200,
        ease: "Quad.easeOut",
      });
    });
  }

  updatePlayableCards(leadSuit: Suit, currentTrick: any[] = []) {
    if (!this.isHuman) return;

    const cardDataArray = this.cards.map((c) => c.cardData);
    const validCards = getValidCards(cardDataArray, leadSuit, currentTrick);
    const validIds = new Set(validCards.map((c) => c.id));

    this.cards.forEach((card) => {
      card.setPlayable(validIds.has(card.cardData.id));
    });
  }

  disableAllCards() {
    this.cards.forEach((card) => card.setPlayable(false));
  }

  enableInteraction() {
    // Enable all cards as playable (validation will happen on server)
    this.cards.forEach((card) => card.setPlayable(true));
  }

  addCard(cardData: CardData, animate = true) {
    const faceDown = !this.isHuman;
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create card at center (deck position) or at hand position
    const card = new Card(this.scene, {
      x: animate ? centerX : this.x,
      y: animate ? centerY : this.y,
      cardData,
      faceDown,
      onClick: this.isHuman
        ? (data) => this.emit("cardPlayed", data, card)
        : undefined,
    });

    if (animate) {
      card.moveTo({ scale: 0.3 });
    }

    this.cards.push(card);

    // Rearrange all cards
    this.arrangeCards(animate);

    return card;
  }

  removeCard(cardDataOrId: CardData | string) {
    // Accept either cardData object or card ID string
    const cardId =
      typeof cardDataOrId === "string" ? cardDataOrId : cardDataOrId.id;
    const index = this.cards.findIndex((c) => c.cardData.id === cardId);
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

  getCardByData(cardData: CardData) {
    return this.cards.find((c) => c.cardData.id === cardData.id);
  }

  clearCards() {
    this.cards.forEach((card) => card.destroy());
    this.cards = [];
  }

  getCardData() {
    return this.cards.map((c) => c.cardData);
  }

  /**
   * Update the number of face-down placeholder cards (for remote players)
   */
  updateCardCount(count: number) {
    if (this.isHuman) return; // Only for non-human players

    const currentCount = this.cards.length;

    if (count === currentCount) return;

    if (count > currentCount) {
      // Add placeholder cards
      const cardsToAdd = count - currentCount;
      for (let i = 0; i < cardsToAdd; i++) {
        // Create a dummy card object for placeholder
        const dummyCard: CardData = {
          id: `placeholder_${Date.now()}_${i}`,
          suit: "spades",
          rank: "A",
          value: 0,
        };
        const card = new Card(this.scene, {
          x: this.x,
          y: this.y,
          cardData: dummyCard,
          faceDown: true,
        });
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
