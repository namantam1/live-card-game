import Phaser from 'phaser';
import { SUITS, RANKS, COLORS } from '../utils/constants';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.createLoadingBar();
    this.loadAssets();
  }

  createLoadingBar() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Loading text
    const loadingText = this.add.text(centerX, centerY - 50, 'Loading...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Progress bar background
    const progressBarBg = this.add.rectangle(
      centerX, centerY,
      400, 30,
      0x1e293b
    ).setOrigin(0.5);

    // Progress bar fill
    const progressBar = this.add.rectangle(
      centerX - 195, centerY,
      0, 24,
      COLORS.PRIMARY
    ).setOrigin(0, 0.5);

    // Percentage text
    const percentText = this.add.text(centerX, centerY + 50, '0%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Update progress bar on load progress
    this.load.on('progress', (value: number) => {
      progressBar.width = 390 * value;
      percentText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      loadingText.setText('Ready!');
      percentText.destroy();
    });
  }

  loadAssets() {
    // Load all card images
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const key = `card-${rank}-${suit}`;
        const path = `cards/${rank}-${suit}.svg`;
        this.load.svg(key, path, { width: 80, height: 112 });
      }
    }

    // Card back
    this.load.svg('card-back', 'cards/back.svg', { width: 80, height: 112 });

    // Audio (optional - check if exists)
    this.load.audio('bgm', 'audio/bgm.mp3').on('loaderror', () => {
      console.log('BGM not found, continuing without music');
    });

    // We'll generate UI sounds programmatically
  }

  create() {
    // Small delay before transitioning to menu
    this.time.delayedCall(500, () => {
      this.scene.start('MenuScene');
    });
  }
}
