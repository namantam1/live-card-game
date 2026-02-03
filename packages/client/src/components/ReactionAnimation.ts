import { Scene } from 'phaser';

/**
 * Utility class for displaying animated reaction emojis
 */
export default class ReactionAnimation {
  /**
   * Display an animated reaction emoji that floats up and fades out
   */
  static show(
    scene: Scene,
    x: number,
    y: number,
    emoji: string,
    playerName?: string
  ): void {
    // Create emoji text
    const emojiText = scene.add.text(x, y, emoji, {
      fontSize: '60px',
      padding: { top: 10 },
      align: 'center',
    });
    emojiText.setOrigin(0.5);
    emojiText.setDepth(1000);

    // Optional player name label
    let nameText: Phaser.GameObjects.Text | undefined;
    if (playerName) {
      nameText = scene.add.text(x, y + 40, playerName, {
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 4 },
      });
      nameText.setOrigin(0.5);
      nameText.setDepth(1000);
    }

    // Animate up and fade out
    scene.tweens.add({
      targets: [emojiText, nameText].filter(Boolean),
      y: y - 100,
      alpha: 0,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => {
        emojiText.destroy();
        nameText?.destroy();
      },
    });

    // Scale pulse effect
    scene.tweens.add({
      targets: emojiText,
      scale: 1.2,
      duration: 300,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }
}
