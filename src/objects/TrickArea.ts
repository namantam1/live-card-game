import Phaser from "phaser";
import Card from "./Card";
import { ANIMATION } from "../utils/constants";
import type { CardData } from "../type";

interface CardOffset {
  x: number;
  y: number;
  rotation: number;
}

interface PlayedCard {
  playerIndex: number;
  card: Card;
  cardData: any;
}

interface Position {
  x: number;
  y: number;
}

export default class TrickArea {
  playedCards: PlayedCard[];
  private trickCardScale: number;
  private cardOffsets: CardOffset[];
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.cameras.main;

    this.playedCards = [];
    this.scene = scene;

    this.trickCardScale = 0.7;

    // Card positions for each player (relative to center)
    // Diamond pattern: each player's card faces toward center
    this.cardOffsets = [
      { x: 0, y: 50, rotation: 0 }, // Player 0 (bottom)
      { x: -70, y: 0, rotation: -5 }, // Player 1 (left)
      { x: 0, y: -50, rotation: 2 }, // Player 2 (top)
      { x: 70, y: 0, rotation: 5 }, // Player 3 (right)
    ];

    this.container = scene.add.container(width / 2, height / 2);
  }

  async playCard(
    cardData: CardData,
    playerIndex: number,
    fromCard: Card | null = null,
  ): Promise<Card> {
    // Handle invalid or undefined playerIndex
    if (
      playerIndex === undefined ||
      playerIndex === null ||
      playerIndex < 0 ||
      playerIndex >= this.cardOffsets.length
    ) {
      console.warn(
        `TrickArea: Invalid playerIndex ${playerIndex}, defaulting to 0`,
      );
      playerIndex = 0;
    }

    const offset = this.cardOffsets[playerIndex];
    const targetX = this.container.x + offset.x;
    const targetY = this.container.y + offset.y;

    let card: Card;

    if (fromCard) {
      // Use existing card object and animate it
      card = fromCard;

      // Prepare card for play - kills any existing tweens and cleans up state
      card.prepareForPlay();

      // If card was face down (placeholder or bot), update it with actual card data and flip
      if (card.isFaceDown) {
        // Update card data to the actual card being played
        await card.flip(cardData);
      }

      // Animate to center with bounce effect in a single move
      await card.moveTo({
        x: targetX,
        y: targetY,
        rotation: Phaser.Math.DegToRad(offset.rotation),
        scale: this.trickCardScale,
        animate: true,
        duration: ANIMATION.CARD_TO_CENTER as any,
        ease: "Back.easeOut",
        moveToTop: true,
      });
    } else {
      console.warn(
        `TrickArea: fromCard is null, creating new card for player ${playerIndex}`,
      );
      // Create new card at center position
      card = new Card(this.scene, {
        x: targetX,
        y: targetY,
        cardData,
        faceDown: false,
      });
      await card.moveTo({
        scale: this.trickCardScale,
        rotation: Phaser.Math.DegToRad(offset.rotation),
      });
    }

    this.playedCards.push({
      playerIndex,
      card,
      cardData,
    });

    return card;
  }

  async collectTrick(
    winnerIndex: number,
    duration: number = ANIMATION.TRICK_COLLECT,
  ): Promise<void> {
    const { width, height } = this.scene.cameras.main;

    // Determine winner position
    const winnerPositions: Position[] = [
      { x: width / 2, y: height }, // Player 0 (bottom)
      { x: 0, y: height / 2 }, // Player 1 (left)
      { x: width / 2, y: 0 }, // Player 2 (top)
      { x: width, y: height / 2 }, // Player 3 (right)
    ];

    const target = winnerPositions[winnerIndex];

    // Animate all cards to winner
    const promises = this.playedCards.map(({ card }, index) => {
      return card.moveTo({
        x: target.x,
        y: target.y,
        alpha: 0,
        scale: this.trickCardScale,
        animate: true,
        duration,
        delay: index * 50,
        ease: "Quad.easeIn",
        onComplete: () => card.destroy(),
      });
    });

    await Promise.all(promises);
    this.playedCards = [];
  }

  clear(): void {
    this.playedCards.forEach(({ card }) => card.destroy());
    this.playedCards = [];
  }
}
