import Phaser from 'phaser';
import CanvasInputPlugin from 'phaser3-rex-plugins/plugins/canvasinput-plugin';
import BootScene from './scenes/BootScene';
import MenuScene from './scenes/MenuScene';
import LobbyScene from './scenes/LobbyScene';
import GameScene from './scenes/GameScene';
import UIScene from './scenes/UIScene';
import { registerServiceWorker, enforceLandscapeOnMobile } from './pwaUtils';
import DebugScene from './scenes/DebugScene';
import { initSentry } from './sentry.config';
import { ServiceLocator } from './core/ServiceLocator';
import { EventBus } from './services/EventBus';
import { NetworkService } from './services/NetworkService';
import AudioManager from './managers/AudioManager';
import PresenceManager from './managers/PresenceManager';
import { GameRegistry } from './core/GameRegistry';
import { ModeRegistry } from './core/ModeRegistry';
import { CallBreakGame } from './games/callbreak/CallBreakGame';
import { SoloMode } from './modes/SoloMode';
import { MultiplayerMode } from './modes/MultiplayerMode';

// Initialize Sentry before anything else
initSentry();

// Bootstrap services
async function bootstrapServices() {
  // Register EventBus
  ServiceLocator.register('eventBus', EventBus.getInstance());

  // Register and initialize NetworkService
  const networkService = new NetworkService();
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567';
  await networkService.initialize(serverUrl);
  ServiceLocator.register('network', networkService);

  // Register existing singleton services
  ServiceLocator.register('audio', AudioManager.getInstance());
  ServiceLocator.register('presence', PresenceManager.getInstance());

  // Register games
  GameRegistry.register('callbreak', CallBreakGame);

  // Register modes
  ModeRegistry.register('solo', SoloMode);
  ModeRegistry.register('multiplayer', MultiplayerMode);
}

// Main initialization function
async function main() {
  await bootstrapServices();

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    dom: {
      createContainer: true,
    },
    plugins: {
      global: [
        {
          key: 'rexCanvasInputPlugin',
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

  return game;
}

// Start the application
main().catch(console.error);
