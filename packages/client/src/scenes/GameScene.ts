import Phaser from 'phaser';
import Player from '../objects/Player';
import TrickArea from '../objects/TrickArea';
import AudioManager from '../managers/AudioManager';
import NetworkIndicator from '../components/NetworkIndicator';
import { ReconnectionOverlay } from '../objects/game/ReconnectionOverlay';
import Common from '../objects/game/Common';
import GameModeFactory from '../modes/GameModeFactory';
import type { GameModeBase } from '../modes/GameModeBase';
import { EVENTS } from '../utils/constants';

export default class GameScene extends Phaser.Scene {
  private gameMode!: GameModeBase;
  audioManager!: AudioManager;
  trickArea!: TrickArea;
  players!: Player[];
  networkIndicator?: NetworkIndicator;
  reconnectionOverlay?: ReconnectionOverlay;
  private initData: any;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any) {
    // Store init data for later use
    this.initData = data;

    // Create game mode using factory
    const modeType = GameModeFactory.getTypeFromInitData(data);
    this.gameMode = GameModeFactory.createGameMode(modeType);
  }

  create() {
    // Fade in
    this.cameras.main.fadeIn(500);

    // Initialize managers FIRST (before UI that depends on them)
    this.audioManager = new AudioManager(this);
    this.audioManager.init();
    // Start background music (user already clicked "Start Game" so gesture is satisfied)
    this.audioManager.startBackgroundMusic();

    // Create background
    Common.createBackground(this);

    // Create table
    Common.createTable(this);

    // Create trick area
    this.trickArea = new TrickArea(this);

    // Initialize game mode
    this.initializeGameMode();
  }

  async initializeGameMode() {
    // Initialize the game mode with all dependencies
    await this.gameMode.initialize(this, {
      trickArea: this.trickArea,
      audioManager: this.audioManager,
      networkManager: this.initData?.networkManager,
    });

    // Get players from mode
    this.players = this.gameMode.createPlayers(this);

    // Always create network UI (will only be shown if mode emits connection events)
    this.createNetworkIndicator();

    // Setup unified event listeners (no mode branching)
    this.setupEventListeners();

    // Launch UI scene
    this.scene.launch('UIScene', {
      gameMode: this.gameMode,
      audioManager: this.audioManager,
    });

    // Start the game
    await this.gameMode.startGame();
  }

  createNetworkIndicator() {
    const { width } = this.cameras.main;

    // Create network indicator in top-right corner, to the left of settings icon
    // Hidden by default, will be shown when connection events are received
    this.networkIndicator = new NetworkIndicator(this, width - 150, 50);
    this.networkIndicator.container.setVisible(false);

    // Create reconnection overlay (hidden by default)
    this.reconnectionOverlay = new ReconnectionOverlay(this);
  }

  setupConnectionListeners() {
    // Listen to connection events from game mode (only multiplayer emits these)

    // Connection quality changes
    this.gameMode.on(EVENTS.CONNECTION_QUALITY_CHANGED, ({ quality }: any) => {
      if (this.networkIndicator) {
        this.networkIndicator.container.setVisible(true);
        this.networkIndicator.updateQuality(quality);
      }
    });

    // Reconnecting
    this.gameMode.on(EVENTS.RECONNECTING, ({ attempt }: any) => {
      console.log('GameScene: Reconnecting...', attempt);
      if (this.networkIndicator) {
        this.networkIndicator.container.setVisible(true);
        this.networkIndicator.showReconnecting(attempt);
      }
      this.reconnectionOverlay?.show(attempt);
    });

    // Reconnected
    this.gameMode.on(EVENTS.RECONNECTED, ({ message }: any) => {
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
    this.gameMode.on(EVENTS.RECONNECTION_FAILED, ({ message }: any) => {
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
    this.gameMode.on(EVENTS.CONNECTION_ERROR, ({ message }: any) => {
      console.error('Network error:', message);
      this.events.emit('networkError', {
        message: `Connection error: ${message || 'Unknown error'}`,
      });
    });

    // Room left
    this.gameMode.on(EVENTS.ROOM_LEFT, ({ code }: any) => {
      console.log('Room left event received:', code);

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
    // Unified event listeners - no mode conditionals!

    // Turn changed - now both modes emit playerIndex consistently
    this.gameMode.on(EVENTS.TURN_CHANGED, ({ playerIndex, isMyTurn }: any) => {
      this.players.forEach((p, i) => {
        if (i === playerIndex) {
          p.showTurnIndicator();
        } else {
          p.hideTurnIndicator();
        }
      });
    });

    // Card played
    this.gameMode.on(EVENTS.CARD_PLAYED, () => {
      this.audioManager.playCardSound();
    });

    // Trick complete
    this.gameMode.on(EVENTS.TRICK_COMPLETE, ({ winnerIndex }: any) => {
      const winner = this.players[winnerIndex];
      if (winner && winner.nameLabel) {
        this.tweens.add({
          targets: winner.nameLabel,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 200,
          yoyo: true,
        });
      }
    });

    // Game complete - play win sound
    this.gameMode.on(EVENTS.GAME_COMPLETE, () => {
      this.audioManager.playWinSound();
    });

    // Setup connection listeners (only fired by multiplayer mode)
    this.setupConnectionListeners();
  }

  // Called from UIScene to continue to next round
  continueToNextRound() {
    this.gameMode.continueToNextRound();
  }

  // Called from UIScene to restart game
  restartGame() {
    this.trickArea.clear();
    this.gameMode.restartGame();
  }

  // Called from UIScene to return to menu
  async returnToMenu() {
    this.audioManager.destroy();

    // Clean up network indicator
    if (this.networkIndicator) {
      this.networkIndicator.destroy();
    }

    // Clean up reconnection overlay
    if (this.reconnectionOverlay) {
      this.reconnectionOverlay.destroy();
    }

    // Cleanup game mode (this will handle network cleanup for multiplayer)
    await this.gameMode.cleanup();

    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
  }
}
