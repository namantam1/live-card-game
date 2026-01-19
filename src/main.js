import Phaser from 'phaser';
import CanvasInputPlugin from 'phaser3-rex-plugins/plugins/canvasinput-plugin.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import LobbyScene from './scenes/LobbyScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import { registerServiceWorker, enforceLandscapeOnMobile } from './pwaUtils.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  dom: {
    createContainer: true,
  },
  plugins: {
    global: [{
      key: 'rexCanvasInputPlugin',
      plugin: CanvasInputPlugin,
      start: true
    }]
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
    // min: {
    //   width: 320,
    //   height: 480,
    // },
    // max: {
    //   width: 1920,
    //   height: 1080,
    // },
  },
  scene: [BootScene, MenuScene, LobbyScene, GameScene, UIScene],
  input: {
    activePointers: 3,
    touch: {
      capture: true,
    },
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
};

const game = new Phaser.Game(config);

// Handle visibility change for audio
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.sound.pauseAll();
  } else {
    game.sound.resumeAll();
  }
});

// Register PWA service worker
if ('serviceWorker' in navigator) {
  registerServiceWorker();
}

// Enforce landscape mode on mobile devices
enforceLandscapeOnMobile();

export default game;
