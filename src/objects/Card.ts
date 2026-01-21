import Phaser, { Scene } from 'phaser';
import { CARD, ANIMATION, COLORS } from '../utils/constants.ts';
import { getCardAssetKey } from '../utils/cards.js';

export default class Card extends Phaser.GameObjects.Container {
  cardData: any;
  isFaceDown: boolean;
  isPlayable: boolean;
  originalY: number;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Graphics;

  constructor(scene: Scene, x: number, y: number, cardData: any, faceDown = false) {
    super(scene, x, y);

    this.cardData = cardData;
    this.isFaceDown = faceDown;
    this.isPlayable = false;
    this.originalY = y;

    // Create card sprite
    const textureKey = faceDown ? 'card-back' : getCardAssetKey(cardData);
    const scale = faceDown ? CARD.SCALE * 0.9 : CARD.SCALE;
    this.sprite = scene.add.image(0, 0, textureKey);
    this.sprite.setScale(scale);
    this.add(this.sprite);

    // Add glow effect (hidden by default)
    this.glow = scene.add.graphics();
    this.glow.setVisible(false);
    this.add(this.glow);
    this.sendToBack(this.glow);

    // Set size for hit area
    this.setSize(CARD.WIDTH * scale, CARD.HEIGHT * scale);

    // Add to scene
    scene.add.existing(this);
  }

  setPlayable(playable: boolean, skipAnimation = false) {
    const wasPlayable = this.isPlayable;
    this.isPlayable = playable;

    if (playable && !this.isFaceDown) {
      this.setInteractive({ useHandCursor: true });
      this.setupInteraction();
      this.setAlpha(1);

      // Auto-popout playable cards (lift them up)
      if (!wasPlayable && !skipAnimation) {
        // Ensure originalY is set properly
        if (this.originalY === undefined || this.originalY === 0) {
          this.originalY = this.y;
        }
        this.scene.tweens.add({
          targets: this,
          y: this.originalY - CARD.HOVER_LIFT,
          duration: 200,
          ease: 'Back.easeOut',
        });
        this.showGlow();
      }
    } else {
      this.disableInteractive();
      this.removeInteraction();
      this.hideGlow();

      // Return to original position if was playable (but skip if card is being played)
      if (wasPlayable && !this.isFaceDown && !skipAnimation) {
        // Ensure originalY is set properly
        if (this.originalY === undefined || this.originalY === 0) {
          this.originalY = this.y;
        }
        this.scene.tweens.add({
          targets: this,
          y: this.originalY,
          duration: 150,
          ease: 'Quad.easeOut',
        });
      }

      if (!this.isFaceDown) {
        // Use higher alpha so cards are still clearly visible
        this.setAlpha(playable ? 1 : 0.85);
      }
    }
  }

  // Call this before playing the card to prevent animation conflicts
  prepareForPlay() {
    // Stop all tweens on this card
    this.scene.tweens.killTweensOf(this);
    this.isPlayable = false;
    this.disableInteractive();
    this.removeInteraction();
    this.hideGlow();
    this.setAlpha(1);
  }

  setupInteraction() {
    this.on('pointerover', this.onHover, this);
    this.on('pointerout', this.onHoverEnd, this);
    this.on('pointerdown', this.onPointerDown, this);
  }

  removeInteraction() {
    this.off('pointerover', this.onHover, this);
    this.off('pointerout', this.onHoverEnd, this);
    this.off('pointerdown', this.onPointerDown, this);
  }

  onHover() {
    if (!this.isPlayable) return;

    // Just add extra lift on hover (card is already popped out)
    this.scene.tweens.add({
      targets: this,
      y: this.originalY - CARD.HOVER_LIFT - 10,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 100,
      ease: 'Back.easeOut',
    });
  }

  onHoverEnd() {
    if (!this.isPlayable) return;

    // Return to playable popout position (not original)
    this.scene.tweens.add({
      targets: this,
      y: this.originalY - CARD.HOVER_LIFT,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: 'Quad.easeOut',
    });
  }

  onPointerDown() {
    if (!this.isPlayable) return;

    // Emit card played event
    this.emit('cardClicked', this.cardData);
  }

  showGlow() {
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
      8
    );
    this.glow.setVisible(true);
  }

  hideGlow() {
    this.glow.setVisible(false);
  }

  flip(toFaceDown = false) {
    return new Promise((resolve) => {
      // Flip animation - scale X to 0, change texture, scale back
      this.scene.tweens.add({
        targets: this.sprite,
        scaleX: 0,
        duration: 100,
        ease: 'Quad.easeIn',
        onComplete: () => {
          const textureKey = toFaceDown ? 'card-back' : getCardAssetKey(this.cardData);
          this.sprite.setTexture(textureKey);
          this.isFaceDown = toFaceDown;

          this.scene.tweens.add({
            targets: this.sprite,
            scaleX: CARD.SCALE,
            duration: 100,
            ease: 'Quad.easeOut',
            onComplete: resolve,
          });
        },
      });
    });
  }

  animateTo(x: number, y: number, duration = ANIMATION.CARD_PLAY, rotation = 0) {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x,
        y,
        rotation: Phaser.Math.DegToRad(rotation),
        duration,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.originalY = y;
          resolve(null);
        },
      });
    });
  }

  animateToWithBounce(x: number, y: number, duration = ANIMATION.CARD_PLAY) {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x,
        y,
        duration,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.originalY = y;
          resolve(null);
        },
      });
    });
  }

  override destroy() {
    this.removeInteraction();
    super.destroy();
  }
}
