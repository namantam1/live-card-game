import Phaser, { Scene } from 'phaser';
import { SUITS, RANKS, COLORS } from '../utils/constants';
import { CARD_CONFIG } from '../utils/uiConfig';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.createLoadingBar();
    BootScene.loadAssets(this);
  }

  createLoadingBar() {
    const { centerX, centerY } = this.cameras.main;

    // Loading text
    const loadingText = this.add
      .text(centerX, centerY - 50, 'Loading...', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Progress bar background
    this.add.rectangle(centerX, centerY, 400, 30, 0x1e293b).setOrigin(0.5);

    // Progress bar fill
    const progressBar = this.add
      .rectangle(centerX - 195, centerY, 0, 24, COLORS.PRIMARY)
      .setOrigin(0, 0.5);

    // Percentage text
    const percentText = this.add
      .text(centerX, centerY + 45, '0%', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

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

  static loadAssets(scene: Scene) {
    // Load all card images using centralized card dimensions from uiConfig
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const key = `card-${rank}-${suit}`;
        const path = `cards/${rank}-${suit}.svg`;
        scene.load.svg(key, path, {
          width: CARD_CONFIG.WIDTH,
          height: CARD_CONFIG.HEIGHT,
        });
      }
    }

    // Card back using centralized card dimensions
    scene.load.svg('card-back', 'cards/back.svg', {
      width: CARD_CONFIG.WIDTH,
      height: CARD_CONFIG.HEIGHT,
    });

    scene.load.image('table', 'assets/table-bg.webp');
    scene.load.image('bg', 'assets/background.jpg');

    // audio
    scene.load.audio('bgm', 'audio/bgm.mp3');
    scene.load.audio('button-click', 'audio/button-click-1.mp3');
    scene.load.audio('game-end', 'audio/game-end.mp3');
    scene.load.audio('card-play', 'audio/card-play.mp3');
  }

  create() {
    // Small delay before transitioning to menu
    this.time.delayedCall(500, () => {
      this.scene.start('MenuScene');
    });
  }
}
