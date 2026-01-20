import Phaser from 'phaser';
import { COLORS, ANIMATION } from '../utils/constants';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background gradient effect
    this.createBackground();

    // Title with spade icon
    this.createTitle(centerX, centerY - 100);

    // Subtitle
    this.add.text(centerX, centerY - 20, 'A classic trick-taking card game', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Start button
    this.createStartButton(centerX, centerY + 60);

    // Floating cards animation
    this.createFloatingCards();

    // Don't auto-play music here - let GameScene handle it after user gesture
  }

  createBackground() {
    const { width, height } = this.cameras.main;

    // Dark gradient background
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e);
    graphics.fillRect(0, 0, width, height);

    // Decorative circles
    graphics.fillStyle(0x6366f1, 0.1);
    graphics.fillCircle(width * 0.25, height * 0.25, 200);
    graphics.fillStyle(0x8b5cf6, 0.1);
    graphics.fillCircle(width * 0.75, height * 0.75, 250);
  }

  createTitle(x: number, y: number) {
    // Spade icon (using text emoji for simplicity)
    const spadeIcon = this.add.text(x, y - 50, '\u2660', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '64px',
      color: '#818cf8',
    }).setOrigin(0.5);

    // Animate spade
    this.tweens.add({
      targets: spadeIcon,
      rotation: Phaser.Math.DegToRad(10),
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Title text
    this.add.text(x, y, 'Call Break', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  createStartButton(x: number, y: number) {
    // Button background
    const buttonWidth = 200;
    const buttonHeight = 50;

    const button = this.add.container(x, y);

    // Gradient button background
    const bg = this.add.graphics();
    bg.fillGradientStyle(COLORS.PRIMARY, COLORS.SECONDARY, COLORS.PRIMARY, COLORS.SECONDARY);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);

    // Button text
    const text = this.add.text(0, 0, '\u25B6  Start Game', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    button.add([bg, text]);

    // Make interactive
    const hitArea = new Phaser.Geom.Rectangle(
      -buttonWidth / 2, -buttonHeight / 2,
      buttonWidth, buttonHeight
    );
    button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    // Hover effects
    button.on('pointerover', () => {
      this.tweens.add({
        targets: button,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      });
    });

    button.on('pointerout', () => {
      this.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      });
    });

    button.on('pointerdown', () => {
      this.tweens.add({
        targets: button,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
      });
    });

    button.on('pointerup', () => {
      // Stop any existing music before transitioning
      this.sound.stopAll();

      // Transition to game
      this.cameras.main.fadeOut(ANIMATION.SCENE_TRANSITION);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });
  }

  createFloatingCards() {
    const { width, height } = this.cameras.main;

    // Create a few floating card backs
    const positions = [
      { x: width * 0.15, y: height * 0.3, delay: 0 },
      { x: width * 0.85, y: height * 0.4, delay: 500 },
      { x: width * 0.1, y: height * 0.7, delay: 1000 },
      { x: width * 0.9, y: height * 0.8, delay: 1500 },
    ];

    positions.forEach(({ x, y, delay }) => {
      const card = this.add.image(x, y, 'card-back')
        .setScale(0.5)
        .setAlpha(0.3);

      this.tweens.add({
        targets: card,
        y: y - 20,
        rotation: Phaser.Math.DegToRad(Phaser.Math.Between(-15, 15)),
        duration: 2000,
        delay,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

}
