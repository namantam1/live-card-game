import AudioManager from "../managers/AudioManager";

interface ButtonConfig {
  width: number;
  height: number;
  text: string;
  onClick: () => void;
  bgColor?: number;
  borderRadius?: number;
  fontSize?: string;
  fontFamily?: string;
  hoverScale?: number;
  pressScale?: number;
  playSound?: boolean;
  audioManager?: AudioManager | null;
}

interface IconButtonConfig {
  iconSize?: number;
  icon?: string;
  fontSize?: string;
  onClick: () => void;
  bgColor?: number;
  bgAlpha?: number;
  borderColor?: number;
  borderAlpha?: number;
  iconColor?: string;
  iconHoverColor?: string;
  hoverScale?: number;
  audioManager?: AudioManager | null;
}

export default class Button {
  static create(scene: Phaser.Scene, x: number, y: number, config: ButtonConfig): Phaser.GameObjects.Container {
    const {
      width,
      height,
      text,
      onClick,
      bgColor = 0x6366f1,
      borderRadius = 10,
      fontSize = '18px',
      fontFamily = 'Arial, sans-serif',
      hoverScale = 1.05,
      pressScale = 0.95,
      playSound = false,
      audioManager = null
    } = config;

    // Create container
    const container = scene.add.container(x, y);

    // Background
    const bg = scene.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, borderRadius);

    // Text
    const btnText = scene.add.text(0, 0, text, {
      fontFamily,
      fontSize,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, btnText]);

    // Make interactive
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });

    // State tracking
    let isPressed = false;

    // Hover (desktop only)
    container.on('pointerover', () => {
      if (!isPressed && !scene.sys.game.device.input.touch) {
        container.setScale(hoverScale);
      }
    });

    container.on('pointerout', () => {
      if (!isPressed) {
        container.setScale(1);
      }
    });

    // Press
    container.on('pointerdown', () => {
      isPressed = true;
      container.setScale(pressScale);
      if (playSound && audioManager) {
        audioManager.playButtonSound();
      }
    });

    // Release and execute callback
    container.on('pointerup', () => {
      if (isPressed) {
        isPressed = false;
        container.setScale(1);
        onClick();
      }
    });

    return container;
  }

  static createIconButton(scene: Phaser.Scene, x: number, y: number, config: IconButtonConfig): Phaser.GameObjects.Container {
    const {
      iconSize = 24,
      icon = '\u2699',
      fontSize = '24px',
      onClick,
      bgColor = 0x1e293b,
      bgAlpha = 0.9,
      borderColor = 0x6366f1,
      borderAlpha = 0.5,
      iconColor = '#94a3b8',
      iconHoverColor = '#ffffff',
      hoverScale = 1.1,
      audioManager
    } = config;

    const container = scene.add.container(x, y);

    // Circular background
    const bg = scene.add.graphics();
    bg.fillStyle(bgColor, bgAlpha);
    bg.fillCircle(0, 0, iconSize);
    bg.lineStyle(2, borderColor, borderAlpha);
    bg.strokeCircle(0, 0, iconSize);

    // Icon text
    const iconText = scene.add.text(0, 0, icon, {
      fontFamily: 'Arial, sans-serif',
      fontSize: fontSize,
      color: iconColor,
    }).setOrigin(0.5);

    container.add([bg, iconText]);

    // Larger hit area for better touch targets (minimum 44px recommended for mobile)
    const hitAreaRadius = Math.max(iconSize + 12, 22);
    container.setInteractive({
      hitArea: new Phaser.Geom.Circle(0, 0, hitAreaRadius),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true
    });
    container.setDepth(1000);

    let isPressed = false;

    container.on('pointerover', () => {
      if (!isPressed && !scene.sys.game.device.input.touch) {
        iconText.setColor(iconHoverColor);
        scene.tweens.add({
          targets: container,
          scaleX: hoverScale,
          scaleY: hoverScale,
          duration: 100
        });
      }
    });

    container.on('pointerout', () => {
      if (!isPressed) {
        iconText.setColor(iconColor);
        scene.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        });
      }
    });

    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      isPressed = true;
      // Visual feedback: scale down
      scene.tweens.add({
        targets: container,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 100,
        ease: 'Power2'
      });
      if (audioManager) audioManager.playButtonSound();
      // Prevent event from bubbling
      pointer.event.stopPropagation();
    });

    container.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (isPressed) {
        isPressed = false;
        iconText.setColor(iconColor);
        // Visual feedback: scale back to normal
        scene.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Power2'
        });
        onClick();
        // Prevent event from bubbling
        pointer.event.stopPropagation();
      }
    });

    // Handle case where pointer leaves button while pressed (for mobile)
    container.on('pointerout', () => {
      if (isPressed) {
        isPressed = false;
        iconText.setColor(iconColor);
        // Reset scale if pointer leaves while pressed
        scene.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 100
        });
      }
    });

    return container;
  }
}
