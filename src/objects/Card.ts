import Phaser, { Scene } from "phaser";
import { CARD, COLORS } from "../utils/constants";
import { getCardAssetKey } from "../utils/cards";
import type { CardData } from "../type";

export interface CardConfig {
  x: number;
  y: number;
  cardData: CardData;
  faceDown?: boolean;
  onClick?: (cardData: CardData) => void;
}

export default class Card {
  private scene: Scene;
  private container: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Graphics;
  private onClickCallback?: (cardData: CardData) => void;

  cardData: CardData;
  isFaceDown: boolean;
  isPlayable: boolean;
  originalY: number;
  initialScale: number;

  constructor(scene: Scene, config: CardConfig) {
    this.scene = scene;
    this.cardData = config.cardData;
    this.isFaceDown = config.faceDown || false;
    this.isPlayable = false;
    this.originalY = config.y; // config.faceDown ? config.y : config.y + 100;
    this.onClickCallback = config.onClick;

    // Create container
    this.container = scene.add.container(config.x, this.originalY);

    // Create card sprite
    const textureKey = this.isFaceDown
      ? "card-back"
      : getCardAssetKey(config.cardData);
    this.initialScale = this.isFaceDown ? CARD.SCALE * 0.5 : CARD.SCALE;
    this.sprite = scene.add.image(0, 0, textureKey);
    this.container.setScale(this.initialScale);
    this.container.add(this.sprite);

    // Add glow effect (hidden by default)
    this.glow = scene.add.graphics();
    this.glow.setVisible(false);
    this.container.add(this.glow);
    this.container.sendToBack(this.glow);

    // Set size for hit area
    this.container.setSize(
      CARD.WIDTH * this.initialScale,
      CARD.HEIGHT * this.initialScale,
    );
  }

  setPlayable(playable: boolean, skipAnimation = false) {
    const wasPlayable = this.isPlayable;
    this.isPlayable = playable;

    if (playable && !this.isFaceDown) {
      this.container.setInteractive({ useHandCursor: true });
      this.setupInteraction();
      this.container.setAlpha(1);

      // Auto-popout playable cards (lift them up)
      if (!wasPlayable && !skipAnimation) {
        // Ensure originalY is set properly
        if (this.originalY === undefined || this.originalY === 0) {
          this.originalY = this.container.y;
        }
        this.scene.tweens.add({
          targets: this.container,
          y: this.originalY - CARD.HOVER_LIFT,
          duration: 200,
          ease: "Back.easeOut",
        });
        this.showGlow();
      }
    } else {
      this.container.disableInteractive();
      this.removeInteraction();
      this.hideGlow();

      // Return to original position if was playable (but skip if card is being played)
      if (wasPlayable && !this.isFaceDown && !skipAnimation) {
        // Ensure originalY is set properly
        if (this.originalY === undefined || this.originalY === 0) {
          this.originalY = this.container.y;
        }
        this.scene.tweens.add({
          targets: this.container,
          y: this.originalY,
          duration: 150,
          ease: "Quad.easeOut",
        });
      }

      if (!this.isFaceDown) {
        // Use higher alpha so cards are still clearly visible
        this.container.setAlpha(playable ? 1 : 0.85);
      }
    }
  }

  // Call this before playing the card to prevent animation conflicts
  prepareForPlay() {
    // Stop all tweens on this card
    this.scene.tweens.killTweensOf(this.container);
    this.isPlayable = false;
    this.container.disableInteractive();
    this.removeInteraction();
    this.hideGlow();
    this.container.setAlpha(1);
  }

  setupInteraction() {
    this.container.on("pointerover", this.onHover, this);
    this.container.on("pointerout", this.onHoverEnd, this);
    this.container.on("pointerdown", this.onPointerDown, this);
  }

  removeInteraction() {
    this.container.off("pointerover", this.onHover, this);
    this.container.off("pointerout", this.onHoverEnd, this);
    this.container.off("pointerdown", this.onPointerDown, this);
  }

  onHover() {
    if (!this.isPlayable) return;

    // Just add extra lift on hover (card is already popped out)
    this.scene.tweens.add({
      targets: this.container,
      y: this.originalY - CARD.HOVER_LIFT - 10,
      scaleX: 1.05 * CARD.SCALE,
      scaleY: 1.05 * CARD.SCALE,
      duration: 100,
      ease: "Back.easeOut",
    });
  }

  onHoverEnd() {
    if (!this.isPlayable) return;

    // Return to playable popout position (not original)
    this.scene.tweens.add({
      targets: this.container,
      y: this.originalY - CARD.HOVER_LIFT,
      scaleX: 1 * CARD.SCALE,
      scaleY: 1 * CARD.SCALE,
      duration: 100,
      ease: "Quad.easeOut",
    });
  }

  onPointerDown() {
    if (!this.isPlayable) return;

    // Call the click callback if provided
    if (this.onClickCallback) {
      this.onClickCallback(this.cardData);
    }
  }

  private showGlow() {
    this.glow.clear();
    this.glow.lineStyle(3, COLORS.PRIMARY, 0.8);

    // Use the sprite's actual display size (accounts for texture size and sprite scale)
    const cardWidth = this.sprite.displayWidth;
    const cardHeight = this.sprite.displayHeight;

    this.glow.strokeRoundedRect(
      -cardWidth / 2,
      -cardHeight / 2 - 2,
      cardWidth,
      cardHeight + 4,
      8,
    );
    this.glow.setVisible(true);
  }

  private hideGlow() {
    this.glow.setVisible(false);
  }

  flip(cardData: CardData, toFaceDown = false) {
    this.cardData = cardData;
    return new Promise((resolve) => {
      // Flip animation - scale X to 0, change texture, scale back
      this.scene.tweens.add({
        targets: this.sprite,
        // scaleX: 0,
        duration: 100,
        ease: "Quad.easeIn",
        onComplete: () => {
          const textureKey = toFaceDown
            ? "card-back"
            : getCardAssetKey(this.cardData);
          this.sprite.setTexture(textureKey);
          this.isFaceDown = toFaceDown;

          this.scene.tweens.add({
            targets: this.sprite,
            //scaleX: CARD.SCALE,
            duration: 100,
            ease: "Quad.easeOut",
            onComplete: resolve,
          });
        },
      });
    });
  }

  /**
   * Move card to a position with optional animation
   * @param config - Position and animation configuration
   * @returns Promise that resolves when animation completes (or immediately if not animating)
   */
  moveTo(config: {
    x?: number;
    y?: number;
    rotation?: number;
    scale?: number;
    alpha?: number;
    animate?: boolean;
    duration?: number;
    ease?: string;
    delay?: number;
    onComplete?: () => void;
  }): Promise<void> {
    const {
      x,
      y,
      rotation,
      scale = this.initialScale,
      alpha,
      animate = false,
      duration = 200,
      ease = "Quad.easeOut",
      delay = 0,
      onComplete,
    } = config;

    // Update originalY if y is provided
    if (y !== undefined) {
      this.originalY = y;
    }

    if (!animate) {
      // Instant positioning
      if (x !== undefined) this.container.x = x;
      if (y !== undefined) this.container.y = y;
      if (rotation !== undefined) this.container.rotation = rotation;
      if (alpha !== undefined) this.container.alpha = alpha;
      if (scale !== undefined) this.container.setScale(scale);
      if (onComplete) onComplete();
      return Promise.resolve();
    }

    // Animated positioning
    return new Promise((resolve) => {
      const tweenConfig: any = {
        targets: this.container,
        duration,
        ease,
        delay,
        onComplete: () => {
          if (onComplete) onComplete();
          resolve();
        },
      };

      if (x !== undefined) tweenConfig.x = x;
      if (y !== undefined) tweenConfig.y = y;
      if (rotation !== undefined) tweenConfig.rotation = rotation;
      if (alpha !== undefined) tweenConfig.alpha = alpha;
      if (scale !== undefined) tweenConfig.scale = scale;

      this.scene.tweens.add(tweenConfig);
    });
  }

  destroy() {
    this.removeInteraction();
    this.onClickCallback = undefined;
    this.container.destroy();
  }
}
