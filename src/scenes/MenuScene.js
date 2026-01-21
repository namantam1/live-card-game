import Phaser from 'phaser';
import { COLORS, ANIMATION } from '../utils/constants';
import { getFontSize } from '../config/uiConfig';
import Button from '../utils/Button';

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

    // Subtitle with responsive font size
    this.add.text(centerX, centerY - 20, 'A classic trick-taking card game', {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('menuSubtitle', width, height),
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Solo Play button
    this.createButton(centerX, centerY + 50, 'Solo Play (vs Bots)', () => {
      this.sound.stopAll();
      this.cameras.main.fadeOut(ANIMATION.SCENE_TRANSITION);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene', { isMultiplayer: false });
      });
    });

    // Multiplayer button
    this.createButton(centerX, centerY + 150, 'Multiplayer', () => {
      this.sound.stopAll();
      this.cameras.main.fadeOut(ANIMATION.SCENE_TRANSITION);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('LobbyScene');
      });
    }, 0x8b5cf6);

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

  createTitle(x, y) {
    const { width, height } = this.cameras.main;

    // Spade icon (using text emoji for simplicity) with responsive font size
    const iconSize = getFontSize('menuSpadeIcon', width, height);
    const spadeIcon = this.add.text(x, y - parseInt(iconSize) * .9, '\u2660', {
      fontFamily: 'Arial, sans-serif',
      fontSize: iconSize,
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

    // Title text with responsive font size
    this.add.text(x, y, 'Call Break', {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('menuTitle', width, height),
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  createButton(x, y, text, callback, bgColor = COLORS.PRIMARY) {
    const { width, height } = this.cameras.main;

    return Button.create(this, x, y, {
      width: 350,
      height: 80,
      text,
      onClick: callback,
      bgColor,
      borderRadius: 12,
      fontSize: getFontSize('menuButton', width, height),
      hoverScale: 1.05,
      pressScale: 0.95
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
