import Phaser from 'phaser';
import Player from '../objects/Player.js';
import TrickArea from '../objects/TrickArea.js';
import GameManager from '../managers/GameManager.js';
import AudioManager from '../managers/AudioManager.js';
import NetworkIndicator from '../components/NetworkIndicator.js';
import { COLORS, PHASE, EVENTS, TOTAL_ROUNDS } from '../utils/constants.ts';
import { getFontSize } from '../config/uiConfig.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.isMultiplayer = false;
    this.networkManager = null;
  }

  init(data) {
    this.isMultiplayer = data?.isMultiplayer || false;
    this.networkManager = data?.networkManager || null;
  }

  create() {
    const { width, height } = this.cameras.main;

    // Fade in
    this.cameras.main.fadeIn(500);

    // Initialize managers FIRST (before UI that depends on them)
    this.audioManager = new AudioManager(this);
    this.audioManager.init();
    // Start background music (user already clicked "Start Game" so gesture is satisfied)
    this.audioManager.startBackgroundMusic();

    // Create background
    this.createBackground();

    // Create table
    this.createTable();

    // Create trump indicator
    this.createTrumpIndicator();

    // Create trick area
    this.trickArea = new TrickArea(this);

    if (this.isMultiplayer) {
      this.setupMultiplayer();
    } else {
      this.setupSoloGame();
    }
  }

  setupSoloGame() {
    this.gameManager = new GameManager(this);

    // Create players
    this.players = [];
    const playerInfo = this.gameManager.playerInfo;

    for (let i = 0; i < 4; i++) {
      const player = new Player(
        this,
        i,
        playerInfo[i].name,
        playerInfo[i].emoji,
        playerInfo[i].isHuman
      );
      this.players.push(player);

      // Listen for card play events from human player
      if (player.isHuman) {
        player.hand.on('cardPlayed', (cardData, cardObject) => {
          this.onHumanCardPlayed(cardData);
        });
      }
    }

    this.gameManager.setPlayers(this.players);
    this.gameManager.setTrickArea(this.trickArea);

    // Setup event listeners
    this.setupEventListeners();

    // Launch UI scene
    this.scene.launch('UIScene', {
      gameManager: this.gameManager,
      audioManager: this.audioManager,
      isMultiplayer: false,
    });

    // Start the game
    this.gameManager.startGame();
  }

  setupMultiplayer() {
    if (!this.networkManager) {
      console.error('No network manager provided for multiplayer!');
      this.scene.start('MenuScene');
      return;
    }

    // Create network indicator
    this.createNetworkIndicator();

    // Create players from network state
    this.players = [];
    const networkPlayers = this.networkManager.getPlayers();
    const localId = this.networkManager.playerId;

    // Find local player's seat index
    const localPlayer = networkPlayers.find(p => p.id === localId);
    const localSeatIndex = localPlayer ? localPlayer.seatIndex : 0;

    // Create player objects with relative positioning
    // Local player should always be at position 0 (bottom)
    networkPlayers.forEach((netPlayer) => {
      const isLocal = netPlayer.id === localId;

      // Calculate relative position: local player at 0 (bottom), others clockwise
      const relativePosition = (netPlayer.seatIndex - localSeatIndex + 4) % 4;

      const player = new Player(
        this,
        relativePosition,
        netPlayer.name,
        netPlayer.emoji,
        isLocal // isHuman = isLocal in multiplayer
      );
      this.players.push(player);

      // Store network ID and absolute seat index for server communication
      player.networkId = netPlayer.id;
      player.absoluteSeatIndex = netPlayer.seatIndex;

      // Listen for card play events from local player
      if (isLocal) {
        player.hand.on('cardPlayed', (cardData) => {
          this.onMultiplayerCardPlayed(cardData);
        });
      }
    });

    // Sort players by relative position for consistent array indexing
    // This ensures players[0] is always local player (bottom)
    this.players.sort((a, b) => a.index - b.index);

    // Setup network event listeners
    this.setupNetworkListeners();

    // Launch UI scene
    this.scene.launch('UIScene', {
      gameManager: null, // No local game manager in multiplayer
      audioManager: this.audioManager,
      isMultiplayer: true,
      networkManager: this.networkManager,
    });

    // Deal initial hand if already dealt
    this.syncHandFromServer();
  }

  createNetworkIndicator() {
    const { width, height } = this.cameras.main;

    // Create network indicator in top-right corner, to the left of settings icon
    // Settings icon is at (width - margin), so place this at (width - margin - 60)
    this.networkIndicator = new NetworkIndicator(this, width - 80, 30);
    this.networkIndicator.setDepth(1000);

    // Create reconnection overlay (hidden by default)
    this.createReconnectionOverlay();
  }

  createReconnectionOverlay() {
    const { width, height } = this.cameras.main;

    this.reconnectionOverlay = this.add.container(width / 2, height / 2);
    this.reconnectionOverlay.setVisible(false);
    this.reconnectionOverlay.setDepth(500);

    // Semi-transparent background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(-width / 2, -height / 2, width, height);

    // Message panel
    const panelWidth = 300;
    const panelHeight = 150;

    const panel = this.add.graphics();
    panel.fillStyle(0x1e293b, 0.95);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 12);
    panel.lineStyle(2, 0xf59e0b, 0.6);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 12);

    // Reconnection icon (spinning circle)
    this.reconnectingSpinner = this.add.graphics();
    this.reconnectingSpinner.lineStyle(4, 0xf59e0b, 1);
    this.reconnectingSpinner.beginPath();
    this.reconnectingSpinner.arc(0, -20, 20, 0, Math.PI * 1.5, false);
    this.reconnectingSpinner.strokePath();

    // Reconnection text
    this.reconnectingText = this.add.text(0, 30, 'Connection lost\nReconnecting...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#f59e0b',
      align: 'center'
    }).setOrigin(0.5);

    // Attempt counter
    this.reconnectAttemptText = this.add.text(0, 65, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
      align: 'center'
    }).setOrigin(0.5);

    this.reconnectionOverlay.add([bg, panel, this.reconnectingSpinner, this.reconnectingText, this.reconnectAttemptText]);

    // Spinning animation
    this.spinnerTween = null;
  }

  showReconnectionOverlay(attempt = 1) {
    this.reconnectionOverlay.setVisible(true);
    this.reconnectAttemptText.setText(`Attempt ${attempt} of 3`);

    // Start spinner animation
    if (!this.spinnerTween) {
      this.spinnerTween = this.tweens.add({
        targets: this.reconnectingSpinner,
        angle: 360,
        duration: 1000,
        repeat: -1
      });
    }
  }

  hideReconnectionOverlay() {
    this.reconnectionOverlay.setVisible(false);

    if (this.spinnerTween) {
      this.spinnerTween.stop();
      this.spinnerTween = null;
      this.reconnectingSpinner.angle = 0;
    }
  }

  setupNetworkListeners() {
    // Connection quality changes
    this.networkManager.on('connectionQualityChange', ({ quality }) => {
      if (this.networkIndicator) {
        this.networkIndicator.updateQuality(quality);
      }
    });

    // Reconnecting
    this.networkManager.on('reconnecting', ({ attempt }) => {
      console.log('GameScene: Reconnecting...', attempt);
      if (this.networkIndicator) {
        this.networkIndicator.showReconnecting(attempt);
      }
      this.showReconnectionOverlay(attempt);
    });

    // Reconnected
    this.networkManager.on('reconnected', ({ message }) => {
      console.log('GameScene: Reconnected!', message);
      if (this.networkIndicator) {
        this.networkIndicator.showReconnected();
      }
      this.hideReconnectionOverlay();

      // Wait a brief moment for server state to fully sync, then re-sync game state
      this.time.delayedCall(200, () => {
        this.syncHandFromServer();
      });

      // Show brief success message
      const successText = this.add.text(this.cameras.main.width / 2, 100, 'Reconnected!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
        color: '#22c55e',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(600);

      this.tweens.add({
        targets: successText,
        alpha: 0,
        y: 70,
        duration: 2000,
        onComplete: () => successText.destroy()
      });
    });

    // Reconnection failed
    this.networkManager.on('reconnectionFailed', ({ message }) => {
      console.log('GameScene: Reconnection failed', message);
      this.hideReconnectionOverlay();

      // Show error and redirect to menu
      this.events.emit('connectionLost', { message });

      this.time.delayedCall(2000, () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
    });

    // Phase change
    this.networkManager.on('phaseChange', ({ phase }) => {
      this.events.emit('phaseChanged', phase);

      if (phase === 'playing') {
        this.updateRoundText();
      }

      if (phase === 'roundEnd') {
        const players = this.networkManager.getPlayers();
        this.events.emit('roundComplete', {
          players: players.map(p => ({
            name: p.name,
            emoji: p.emoji,
            bid: p.bid,
            tricksWon: p.tricksWon,
            roundScore: p.roundScore,
            totalScore: p.score,
          }))
        });
      }

      if (phase === 'gameOver') {
        const players = this.networkManager.getPlayers();
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        const winner = sortedPlayers[0];
        this.audioManager.playWinSound();
        this.events.emit('gameComplete', {
          winner: {
            name: winner.name,
            emoji: winner.emoji,
            score: winner.score,
          },
          players: sortedPlayers.map(p => ({
            name: p.name,
            emoji: p.emoji,
            score: p.score,
          }))
        });
      }
    });

    // Turn change
    this.networkManager.on('turnChange', ({ playerId, isMyTurn }) => {
      this.players.forEach(p => {
        if (p.networkId === playerId) {
          p.showTurnIndicator();
          if (isMyTurn) {
            // Enable card selection for local player with proper validation
            const leadSuit = this.networkManager.getLeadSuit();
            const phase = this.networkManager.getPhase();
            if (phase === 'playing') {
              p.hand.updatePlayableCards(leadSuit);
            }
          }
        } else {
          p.hideTurnIndicator();
          p.hand.disableAllCards();
        }
      });
    });

    // Card added to hand
    this.networkManager.on('cardAdded', ({ card }) => {
      const localPlayer = this.players.find(p => p.networkId === this.networkManager.playerId);
      if (localPlayer) {
        localPlayer.hand.addCard(card);
      }
    });

    // Card played by any player
    this.networkManager.on('cardPlayed', ({ playerId, card }) => {
      this.audioManager.playCardSound();

      // Find player in local array
      let player = this.players.find(p => p.networkId === playerId);
      let relativePosition;
      let removedCard = null;

      if (player) {
        // Use relative position for visual display
        relativePosition = player.index;

        // Remove card from player's hand for animation
        if (player.networkId === this.networkManager.playerId) {
          // Local player - remove the actual card
          removedCard = player.hand.removeCard(card.id);
        } else {
          // Remote player - remove any placeholder card for animation
          removedCard = player.hand.removeFirstCard();
        }
      } else {
        // Player not in local array (shouldn't happen in multiplayer, but fallback)
        console.warn(`Player ${playerId} not found in local players array`);
        relativePosition = 0;
      }

      // Add card to trick area using relative position for visual placement
      this.trickArea.playCard(card, relativePosition, removedCard);
    });

    // Trick cleared
    this.networkManager.on('trickCleared', () => {
      this.trickArea.clear();
    });

    // Trick winner
    this.networkManager.on('trickWinner', (winnerId) => {
      const winner = this.players.find(p => p.networkId === winnerId);
      if (winner) {
        // Update tricks won count
        winner.addTrick();

        if (winner.nameLabel) {
          this.tweens.add({
            targets: winner.nameLabel,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 200,
            yoyo: true,
          });
        }
      }
      // For bots not in players array, just collect the trick without animation
    });

    // Player bid
    this.networkManager.on('playerBid', ({ playerId, bid }) => {
      const player = this.players.find(p => p.networkId === playerId);
      if (player) {
        // Update the local player's bid and stats display
        player.setBid(bid);
        const playerIndex = this.players.indexOf(player);
        this.events.emit('bidPlaced', { playerIndex, bid });
      } else {
        // This shouldn't happen in multiplayer - all players should be in the array
        console.warn(`Player ${playerId} not found for bid event`);
      }
    });

    // Round change
    this.networkManager.on('roundChange', () => {
      // Reset all players for new round
      this.players.forEach(player => {
        player.reset();
      });
      this.updateRoundText();
    });

    // Lead suit changed - update playable cards if it's our turn
    this.networkManager.on('leadSuitChange', (leadSuit) => {
      if (this.networkManager.isMyTurn() && this.networkManager.getPhase() === 'playing') {
        const localPlayer = this.players.find(p => p.networkId === this.networkManager.playerId);
        if (localPlayer) {
          localPlayer.hand.updatePlayableCards(leadSuit);
        }
      }
    });

    // Error handling
    this.networkManager.on('error', (data) => {
      console.error('Network error:', data);
      // Show error message to user instead of silently redirecting
      this.events.emit('networkError', { 
        message: `Connection error: ${data.message || 'Unknown error'}` 
      });
    });

    // Remote player hand changes (for visual card backs)
    this.networkManager.on('remoteHandChanged', ({ playerId, handCount }) => {
      const player = this.players.find(p => p.networkId === playerId);
      if (player) {
        player.hand.updateCardCount(handCount);
      }
    });

    // Room left
    this.networkManager.on('roomLeft', (data) => {
      console.log('Room left event received:', data);
      
      // Show a message before redirecting
      const message = data?.code === 1000 
        ? 'Disconnected from game' 
        : 'Connection lost - returning to menu';
      
      this.events.emit('connectionLost', { message });
      
      // Delay redirect to allow user to see what happened
      this.time.delayedCall(1500, () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
    });
  }

  syncHandFromServer() {
    // Get current hand from server and display
    const hand = this.networkManager.getMyHand();
    const localPlayer = this.players.find(p => p.networkId === this.networkManager.playerId);

    if (localPlayer) {
      // Always sync cards, even if hand is empty (cards might have been played)
      console.log('GameScene: Syncing hand from server. Cards:', hand.length);
      localPlayer.hand.setCards(hand, false);
    }

    // Sync card counts for all remote players (show card backs)
    const state = this.networkManager.getState();
    if (state) {
      state.players.forEach((player, sessionId) => {
        if (sessionId !== this.networkManager.playerId) {
          const handCount = player.hand.length;
          const localPlayerObj = this.players.find(p => p.networkId === sessionId);
          if (localPlayerObj) {
            console.log(`GameScene: Updating card count for ${player.name}: ${handCount}`);
            localPlayerObj.hand.updateCardCount(handCount);
          }
        }
      });

      // Check current game state and update UI accordingly
      const phase = state.phase;
      const currentTurnPlayerId = state.currentTurn;
      const isMyTurn = currentTurnPlayerId === this.networkManager.playerId;

      // Update turn indicators for all players
      this.players.forEach(p => {
        if (p.networkId === currentTurnPlayerId) {
          p.showTurnIndicator();
        } else {
          p.hideTurnIndicator();
          p.hand.disableAllCards();
        }
      });

      if (phase === 'bidding' && isMyTurn) {
        // Emit phase changed event to trigger bidding UI
        this.time.delayedCall(500, () => {
          this.events.emit('phaseChanged', phase);
        });
      } else if (phase === 'playing' && isMyTurn && localPlayer) {
        // If it's our turn to play, update playable cards
        const leadSuit = state.leadSuit || '';
        console.log('GameScene: Reconnected during our turn, updating playable cards. Lead suit:', leadSuit);
        localPlayer.hand.updatePlayableCards(leadSuit);
      }
    }
  }

  onMultiplayerCardPlayed(cardData) {
    // Send card play to server
    this.networkManager.sendPlayCard(cardData.id);
  }

  createBackground() {
    const { width, height } = this.cameras.main;

    // Modern dark gradient background
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a2e, 0x1a1a2e);
    graphics.fillRect(0, 0, width, height);

    // Subtle grid pattern
    graphics.lineStyle(1, 0x2a2a4a, 0.1);
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      graphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      graphics.lineBetween(0, y, width, y);
    }

    // Ambient glow orbs
    graphics.fillStyle(0x6366f1, 0.08);
    graphics.fillCircle(width * 0.15, height * 0.2, 180);
    graphics.fillStyle(0x8b5cf6, 0.06);
    graphics.fillCircle(width * 0.85, height * 0.8, 220);
    graphics.fillStyle(0x06b6d4, 0.05);
    graphics.fillCircle(width * 0.5, height * 0.5, 300);
  }

  createTable() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    const tableWidth = Math.min(width, height) * 0.8;
    const tableHeight = tableWidth * 0.55;

    const graphics = this.add.graphics();

    // Outer glow effect
    for (let i = 4; i >= 0; i--) {
      const alpha = 0.03 * (5 - i);
      graphics.fillStyle(0x6366f1, alpha);
      graphics.fillRoundedRect(
        centerX - tableWidth / 2 - i * 8,
        centerY - tableHeight / 2 - i * 8,
        tableWidth + i * 16,
        tableHeight + i * 16,
        30 + i * 2
      );
    }

    // Table surface - dark glass effect
    graphics.fillGradientStyle(0x1e293b, 0x1e293b, 0x0f172a, 0x0f172a);
    graphics.fillRoundedRect(
      centerX - tableWidth / 2,
      centerY - tableHeight / 2,
      tableWidth,
      tableHeight,
      25
    );

    // Inner gradient overlay for depth
    graphics.fillStyle(0x334155, 0.3);
    graphics.fillRoundedRect(
      centerX - tableWidth / 2 + 4,
      centerY - tableHeight / 2 + 4,
      tableWidth - 8,
      tableHeight / 2,
      22
    );

    // Neon border
    graphics.lineStyle(2, 0x6366f1, 0.8);
    graphics.strokeRoundedRect(
      centerX - tableWidth / 2,
      centerY - tableHeight / 2,
      tableWidth,
      tableHeight,
      25
    );

    // Inner subtle border
    graphics.lineStyle(1, 0x475569, 0.4);
    graphics.strokeRoundedRect(
      centerX - tableWidth / 2 + 8,
      centerY - tableHeight / 2 + 8,
      tableWidth - 16,
      tableHeight - 16,
      20
    );

    // Corner accents
    const accentSize = 15;
    graphics.fillStyle(0x6366f1, 0.6);
    // Top-left
    graphics.fillRoundedRect(centerX - tableWidth / 2 + 15, centerY - tableHeight / 2 + 15, accentSize, 3, 1);
    graphics.fillRoundedRect(centerX - tableWidth / 2 + 15, centerY - tableHeight / 2 + 15, 3, accentSize, 1);
    // Top-right
    graphics.fillRoundedRect(centerX + tableWidth / 2 - 15 - accentSize, centerY - tableHeight / 2 + 15, accentSize, 3, 1);
    graphics.fillRoundedRect(centerX + tableWidth / 2 - 18, centerY - tableHeight / 2 + 15, 3, accentSize, 1);
    // Bottom-left
    graphics.fillRoundedRect(centerX - tableWidth / 2 + 15, centerY + tableHeight / 2 - 18, accentSize, 3, 1);
    graphics.fillRoundedRect(centerX - tableWidth / 2 + 15, centerY + tableHeight / 2 - 15 - accentSize, 3, accentSize, 1);
    // Bottom-right
    graphics.fillRoundedRect(centerX + tableWidth / 2 - 15 - accentSize, centerY + tableHeight / 2 - 18, accentSize, 3, 1);
    graphics.fillRoundedRect(centerX + tableWidth / 2 - 18, centerY + tableHeight / 2 - 15 - accentSize, 3, accentSize, 1);
  }

  createTrumpIndicator() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Container for trump indicator
    const container = this.add.container(centerX, centerY - 80);
    const indicatorHeight = 50;
    const indicatorWidth = 140;
    const indicatorHeightBg = indicatorHeight * .95;
    const indicatorWidthBg = indicatorWidth * .95;

    // Glow effect behind
    const glow = this.add.graphics();
    glow.fillStyle(0x6366f1, 0.15);
    glow.fillRoundedRect(-55, -22, indicatorWidth, indicatorHeight, 22);

    // Background with glass effect
    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 0.95);
    bg.fillRoundedRect(-50, -18, indicatorWidthBg, indicatorHeightBg, 18);
    bg.lineStyle(1, 0x6366f1, 0.6);
    bg.strokeRoundedRect(-50, -18, indicatorWidthBg, indicatorHeightBg, 18);

    // Trump text with responsive font size (width, height already declared above)
    const trumpText = this.add.text(-30, 0, 'Trump', {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('trumpIndicator', width, height),
      fontStyle: 'bold',
      color: '#94a3b8',
    }).setOrigin(0, 0.5);

    // Spade symbol with glow and responsive font size
    const spadeSymbol = this.add.text(50, 0, '\u2660', {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('trumpSymbol', width, height),
      color: '#ffffff',
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#6366f1',
        blur: 8,
        fill: true,
      },
    }).setOrigin(0.5);

    container.add([glow, bg, trumpText, spadeSymbol]);

    // Round indicator - sleeker design
    const roundContainer = this.add.container(centerX, centerY + 75);

    const roundBg = this.add.graphics();
    roundBg.fillStyle(0x1e293b, 0.8);
    roundBg.fillRoundedRect(-45, -12, 90, 24, 12);
    roundBg.lineStyle(1, 0x475569, 0.4);
    roundBg.strokeRoundedRect(-45, -12, 90, 24, 12);

    this.roundText = this.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('roundIndicator', width, height),
      fontStyle: 'bold',
      color: '#94a3b8',
    }).setOrigin(0.5);

    roundContainer.add([roundBg, this.roundText]);

    this.updateRoundText();
  }

  updateRoundText() {
    let round;
    if (this.isMultiplayer && this.networkManager) {
      const state = this.networkManager.getState();
      round = state?.currentRound || 1;
    } else if (this.gameManager) {
      round = this.gameManager.getCurrentRound();
    } else {
      round = 1;
    }
    this.roundText.setText(`Round ${round}/${TOTAL_ROUNDS}`);
  }

  setupEventListeners() {
    // Turn changed
    this.gameManager.on(EVENTS.TURN_CHANGED, (playerIndex) => {
      this.players.forEach((p, i) => {
        if (i === playerIndex) {
          p.showTurnIndicator();
        } else {
          p.hideTurnIndicator();
        }
      });
    });

    // Phase changed
    this.gameManager.on(EVENTS.PHASE_CHANGED, (phase) => {
      this.events.emit('phaseChanged', phase);

      if (phase === PHASE.PLAYING) {
        this.updateRoundText();
      }
    });

    // Card played
    this.gameManager.on(EVENTS.CARD_PLAYED, () => {
      this.audioManager.playCardSound();
    });

    // Trick complete
    this.gameManager.on(EVENTS.TRICK_COMPLETE, ({ winnerIndex }) => {
      // Flash winner indicator
      const winner = this.players[winnerIndex];
      this.tweens.add({
        targets: winner.nameLabel,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 200,
        yoyo: true,
      });
    });

    // Round complete
    this.gameManager.on(EVENTS.ROUND_COMPLETE, (data) => {
      this.events.emit('roundComplete', data);
    });

    // Game complete
    this.gameManager.on(EVENTS.GAME_COMPLETE, (data) => {
      this.audioManager.playWinSound();
      this.events.emit('gameComplete', data);
    });

    // Bid placed
    this.gameManager.on(EVENTS.BID_PLACED, ({ playerIndex, bid }) => {
      this.events.emit('bidPlaced', { playerIndex, bid });
    });
  }

  onHumanCardPlayed(cardData) {
    this.gameManager.playCard(cardData, 0);
  }

  // Called from UIScene when human places bid
  onHumanBid(bid) {
    this.gameManager.placeHumanBid(bid);
  }

  // Called from UIScene to continue to next round
  continueToNextRound() {
    if (this.isMultiplayer) {
      this.networkManager.sendNextRound();
    } else {
      this.gameManager.continueToNextRound();
    }
  }

  // Called from UIScene to restart game
  restartGame() {
    this.trickArea.clear();
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.sendRestart();
    } else if (this.gameManager) {
      this.gameManager.restartGame();
    }
  }

  // Called from UIScene when human places bid (multiplayer)
  onMultiplayerBid(bid) {
    if (this.networkManager) {
      this.networkManager.sendBid(bid);
    }
  }

  // Called from UIScene to return to menu
  returnToMenu() {
    this.audioManager.destroy();

    // Clean up multiplayer connection
    if (this.isMultiplayer && this.networkManager) {
      this.networkManager.removeAllListeners();
      this.networkManager.leaveRoom();
    }

    // Clean up network indicator
    if (this.networkIndicator) {
      this.networkIndicator.destroy();
    }

    // Clean up reconnection overlay
    if (this.reconnectionOverlay) {
      this.reconnectionOverlay.destroy();
    }

    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
  }
}
