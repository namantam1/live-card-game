import { Scene } from 'phaser';
import type { Position } from '../../type';
import Button from './Button';

/**
 * A panel that displays available reaction buttons
 */
export default class ReactionPanel {
  private container: Phaser.GameObjects.Container;
  private buttons: Phaser.GameObjects.Container[] = [];
  private isVisible: boolean = false;
  private scene: Scene;

  constructor(
    scene: Scene,
    onReaction: (type: string) => void,
    config: { position: Position }
  ) {
    const {
      position: { x, y },
    } = config;
    this.scene = scene;
    this.container = scene.add.container(x, y);

    const reactions: string[] = [
      '👍',
      '👎',
      '😂',
      '😮',
      '😍',
      '😡',
      '🔥',
      '💯',
    ];
    const buttonSpacing = 100;
    const startX = -((reactions.length - 1) * buttonSpacing) / 2;

    reactions.forEach((reaction, index) => {
      const button = Button.createReactionbutton(
        scene,
        startX + index * buttonSpacing,
        0,
        reaction,
        () => {
          onReaction(reaction);
          this.hide();
        }
      );
      this.buttons.push(button);
      this.container.add(button);
    });

    this.container.setAlpha(0);
    this.container.setVisible(false);
  }

  private show(): void {
    this.isVisible = true;
    this.container.setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });
  }

  private hide(): void {
    this.isVisible = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => this.container.setVisible(false),
    });
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
}
