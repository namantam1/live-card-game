import Phaser from 'phaser';
import Player from '../objects/Player';
import TrickArea from '../objects/TrickArea';
import AudioManager from '../managers/AudioManager';
import NetworkIndicator from '../components/shared/NetworkIndicator';
import { ReconnectionOverlay } from '../components/game/overlays/ReconnectionOverlay';
import { createGameBackground, createTable } from '../helpers/ui';
import { EVENTS } from '../utils/constants';
import PresenceManager from '../managers/PresenceManager';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameInstance } from '../core/GameInstance';
import { GameRegistry } from '../core/GameRegistry';
import { ModeRegistry } from '../core/ModeRegistry';
import type { EventBus, ScopedEventBus } from '../services/EventBus';
import type { BaseMode } from '../modes/BaseMode';

export default class GameScene extends Phaser.Scene {
  private scopedEvents!: ScopedEventBus;
  private gameInstance!: GameInstance;
  private mode!: BaseMode;
  trickArea!: TrickArea;
  players!: Player[];
  networkIndicator?: NetworkIndicator;
  reconnectionOverlay?: ReconnectionOverlay;
  private isMultiplayer: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any) {
    this.isMultiplayer = data?.isMultiplayer || false;

    // Create GameInstance based on mode
    const GameClass = GameRegistry.get('callbreak');
    const game = new GameClass();

    let mode;
    if (this.isMultiplayer) {
      const ModeClass = ModeRegistry.get('multiplayer');
      mode = new ModeClass();
    } else {
      const ModeClass = ModeRegistry.get('solo');
      mode = new ModeClass();
    }

    this.gameInstance = new GameInstance(game, mode, this, {
      trickArea: null, // Will be set in create()
    });
    this.mode = mode;
  }

  create() {
    // Fade in
    this.cameras.main.fadeIn(500);

    PresenceManager.getInstance()
      .setInviteHandlingEnabled(false)
      .updateStatus(true);

    // Get services
    const eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.scopedEvents = eventBus.subscribeTo(this); // Auto-cleanup on shutdown

    // Initialize AudioManager singleton
    AudioManager.getInstance().setScene(this).startBackgroundMusic();

    // Create background
    createGameBackground(this);

    // Create table
    createTable(this);

    // Create trick area
    this.trickArea = new TrickArea(this);

    // Initialize game
    this.initializeGameMode();
  }

  async initializeGameMode() {
    // Update GameInstance with trickArea
    this.gameInstance = new GameInstance(
      this.gameInstance.getGame(),
      this.mode,
      this,
      { trickArea: this.trickArea }
    );

    // Start the game instance (this initializes the mode)
    await this.gameInstance.start();

    // Create players from mode (now mode is initialized)
    const playerData = this.mode.getPlayers();
    this.players = playerData.map((data, index) => {
      return new Player(
        this,
        data,
        index,
        data.isLocal ? (cardData) => this.mode.sendMove(cardData) : undefined
      );
    });

    // Always create network UI
    this.createNetworkIndicator();

    // Setup event listeners using ScopedEventBus
    this.setupEventListeners();

    // Launch UI scene
    this.scene.launch('UIScene', {
      gameInstance: this.gameInstance,
    });

    // Start the game
    await this.mode.startGame();
  }

  createNetworkIndicator() {
    const { width } = this.cameras.main;

    // Create network indicator in top-right corner, to the left of settings icon
    // Hidden by default, will be shown when connection events are received
    this.networkIndicator = new NetworkIndicator(this, width - 140, 50);
    this.networkIndicator.container.setVisible(false);

    // Create reconnection overlay (hidden by default)
    this.reconnectionOverlay = new ReconnectionOverlay(this);
  }

  setupConnectionListeners() {
    // All listeners auto-cleaned on scene shutdown via ScopedEventBus

    // Connection quality changes
    this.scopedEvents.onNetworkEvent(
      'connectionQualityChange',
      ({ quality }) => {
        if (this.networkIndicator) {
          this.networkIndicator.container.setVisible(true);
          this.networkIndicator.updateQuality(quality as any);
        }
      }
    );

    // Reconnecting
    this.scopedEvents.onNetworkEvent('reconnecting', ({ attempt }) => {
      console.log('GameScene: Reconnecting...', attempt);
      if (this.networkIndicator) {
        this.networkIndicator.container.setVisible(true);
        this.networkIndicator.showReconnecting(attempt);
      }
      this.reconnectionOverlay?.show(attempt);
    });

    // Reconnected
    this.scopedEvents.onNetworkEvent('reconnected', ({ message }) => {
      console.log('GameScene: Reconnected!', message);
      if (this.networkIndicator) {
        this.networkIndicator.showReconnected();
      }
      this.reconnectionOverlay?.hide();

      // Show brief success message
      const successText = this.add
        .text(this.cameras.main.width / 2, 100, 'Reconnected!', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '24px',
          color: '#22c55e',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(600);

      this.tweens.add({
        targets: successText,
        alpha: 0,
        y: 70,
        duration: 2000,
        onComplete: () => successText.destroy(),
      });
    });

    // Reconnection failed
    this.scopedEvents.onNetworkEvent('reconnectionFailed', ({ message }) => {
      console.log('GameScene: Reconnection failed', message);
      this.reconnectionOverlay?.hide();

      // Show error and redirect to menu
      this.events.emit('connectionLost', { message });

      this.time.delayedCall(2000, () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
    });

    // Error handling
    this.scopedEvents.onNetworkEvent('error', ({ message }) => {
      console.error('Network error:', message);
      this.events.emit('networkError', {
        message: `Connection error: ${message || 'Unknown error'}`,
      });
    });

    // Disconnected
    this.scopedEvents.onNetworkEvent('disconnected', ({ code }) => {
      console.log('Disconnected event received:', code);

      const message =
        code === 1000
          ? 'Disconnected from game'
          : 'Connection lost - returning to menu';

      this.events.emit('connectionLost', { message });

      this.time.delayedCall(1500, () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
    });
  }

  setupEventListeners() {
    // Listen to mode events (modes forward from EventBus)
    this.mode.on(EVENTS.TURN_CHANGED, ({ playerIndex }: any) => {
      this.players.forEach((p, i) => {
        if (i === playerIndex) {
          p.showTurnIndicator();
        } else {
          p.hideTurnIndicator();
        }
      });
    });

    // Card played
    this.mode.on(EVENTS.CARD_PLAYED, () => {
      AudioManager.getInstance().playCardSound();
    });

    // Trick complete
    this.mode.on(EVENTS.TRICK_COMPLETE, ({ winnerIndex }: any) => {
      const winner = this.players[winnerIndex];
      if (winner) {
        winner.animateNameLabel();
      }
    });

    // Game complete - play win sound
    this.mode.on(EVENTS.GAME_COMPLETE, () => {
      AudioManager.getInstance().playWinSound();
    });

    // Setup connection listeners (only fired by multiplayer mode)
    this.setupConnectionListeners();
  }

  // Called from UIScene to continue to next round
  continueToNextRound() {
    // Delegate to mode if it has this method
    if ('continueToNextRound' in this.mode) {
      (this.mode as any).continueToNextRound();
    }
  }

  // Called from UIScene to restart game
  restartGame() {
    this.trickArea.clear();
    // Delegate to mode if it has this method
    if ('restartGame' in this.mode) {
      (this.mode as any).restartGame();
    }
  }

  // Called from UIScene to return to menu
  async returnToMenu() {
    AudioManager.getInstance().stopBackgroundMusic();

    // Clean up network indicator
    if (this.networkIndicator) {
      this.networkIndicator.destroy();
    }

    // Clean up reconnection overlay
    if (this.reconnectionOverlay) {
      this.reconnectionOverlay.destroy();
    }

    // Stop game instance (this will cleanup mode)
    await this.gameInstance.stop();

    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
    // Note: ScopedEventBus listeners auto-cleaned on shutdown
  }
}
