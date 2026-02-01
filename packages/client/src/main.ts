import Phaser from "phaser";
import CanvasInputPlugin from "phaser3-rex-plugins/plugins/canvasinput-plugin";
import BootScene from "./scenes/BootScene";
import MenuScene from "./scenes/MenuScene";
import LobbyScene from "./scenes/LobbyScene";
import GameScene from "./scenes/GameScene";
import UIScene from "./scenes/UIScene";
import { registerServiceWorker, enforceLandscapeOnMobile } from "./pwaUtils";
import DebugScene from "./scenes/DebugScene";
import { initSentry } from "./sentry.config";

// Initialize Sentry before anything else
initSentry();

const config = {
  type: Phaser.AUTO,
  parent: "game-container",
  backgroundColor: "#1a1a2e",
  dom: {
    createContainer: true,
  },
  plugins: {
    global: [
      {
        key: "rexCanvasInputPlugin",
        plugin: CanvasInputPlugin,
        start: true,
      },
    ],
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1920,
    height: 1080,
  },
  scene: [
    // comment debug in prod
    // DebugScene,
    BootScene,
    MenuScene,
    LobbyScene,
    GameScene,
    UIScene,
  ],
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
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game.sound.pauseAll();
  } else {
    game.sound.resumeAll();
  }
});

// Register PWA service worker
if ("serviceWorker" in navigator) {
  registerServiceWorker();
}

// Enforce landscape mode on mobile devices
enforceLandscapeOnMobile();

export default game;
