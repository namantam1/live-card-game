import Phaser from "phaser";
import Card from "./Card";
import { ANIMATION } from "../utils/constants";
import { CARD_CONFIG, isMobile } from "../utils/uiConfig";

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

export default class TrickArea extends Phaser.GameObjects.Container {
  playedCards: PlayedCard[];
  private trickCardScale: number;
  private cardOffsets: CardOffset[];

  constructor(scene: Phaser.Scene) {
    const { width, height } = scene.cameras.main;
    super(scene, width / 2, height / 2);

    this.playedCards = [];

    // Calculate responsive card scale for trick area using centralized config
    const mobile = isMobile(width, height);
    this.trickCardScale = mobile
      ? CARD_CONFIG.MOBILE_SCALE
      : CARD_CONFIG.DESKTOP_SCALE;

    // Card positions for each player (relative to center)
    // Diamond pattern: each player's card faces toward center
    this.cardOffsets = [
      { x: 0, y: 50, rotation: 0 }, // Player 0 (bottom)
      { x: -70, y: 0, rotation: -5 }, // Player 1 (left)
      { x: 0, y: -50, rotation: 2 }, // Player 2 (top)
      { x: 70, y: 0, rotation: 5 }, // Player 3 (right)
    ];

    scene.add.existing(this);
  }

  async playCard(
    cardData: any,
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
    const targetX = this.x + offset.x;
    const targetY = this.y + offset.y;

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

      // Normalize scale to match trick area scale (in case hand scale differs)
      await card.moveTo({ scale: this.trickCardScale });

      // Animate to center
      await card.animateToWithBounce(
        targetX,
        targetY,
        ANIMATION.CARD_TO_CENTER as any,
      );
      await card.moveTo({ rotation: Phaser.Math.DegToRad(offset.rotation) });
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

    // Play sound
    this.playCardSound();

    this.playedCards.push({
      playerIndex,
      card,
      cardData,
    });

    // TODO: Fix it as currenlty we don;t have access to card card container.
    // this.scene.children.bringToTop(card as any);

    return card;
  }

  private playCardSound(): void {
    // Simple beep sound using Web Audio
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.1,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
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
        scale: 0.5,
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

  getPlayedCards(): Array<{ playerIndex: number; card: any }> {
    return this.playedCards.map(({ playerIndex, cardData }) => ({
      playerIndex,
      card: cardData,
    }));
  }
}
