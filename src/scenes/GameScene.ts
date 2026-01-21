import Phaser from 'phaser';
import Player from '../objects/Player';
import TrickArea from '../objects/TrickArea';
import GameManager from '../managers/GameManager';
import AudioManager from '../managers/AudioManager';
import NetworkIndicator from '../components/NetworkIndicator';
import { COLORS, PHASE, EVENTS, TOTAL_ROUNDS, Suit } from '../utils/constants';
import { getFontSize } from '../config/uiConfig';
import { RoundIndicator } from '../objects/game/RoundIndicator';
import { ReconnectionOverlay } from '../objects/game/ReconnectionOverlay';
import Common from '../objects/game/common';
import NetworkManager from '../managers/NetworkManager';
import { CardData } from '../type';

export default class GameScene extends Phaser.Scene {
  isMultiplayer: boolean;
  networkManager!: NetworkManager;
  audioManager!: AudioManager;
  roundText!: RoundIndicator;
  gameManager!: GameManager;
  trickArea!: TrickArea;
  players!: any[];
  networkIndicator!: NetworkIndicator;
  reconnectionOverlay!: ReconnectionOverlay;

  constructor() {
    super({ key: 'GameScene' });
    this.isMultiplayer = false;
  }

  init(data: any) {
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
    Common.createBackground(this);

    // Create table
    Common.createTable(this);

    // Create trump indicator
    Common.createTrumpIndicator(this);
    this.roundText = new RoundIndicator(this, this.isMultiplayer, 
      this.networkManager!!, this.gameManager);
    

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
        player.hand.on('cardPlayed', (cardData: CardData) => {
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
        player.hand.on('cardPlayed', (cardData: CardData) => {
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
    this.networkIndicator = new NetworkIndicator(this, width - 110, 40);

    // Create reconnection overlay (hidden by default)
    this.reconnectionOverlay = new ReconnectionOverlay(this);
  }



  setupNetworkListeners() {
    // Connection quality changes
    this.networkManager.on('connectionQualityChange', ({ quality }: any) => {
      if (this.networkIndicator) {
        this.networkIndicator.updateQuality(quality);
      }
    });

    // Reconnecting
    this.networkManager.on('reconnecting', ({ attempt }: any) => {
      console.log('GameScene: Reconnecting...', attempt);
      if (this.networkIndicator) {
        this.networkIndicator.showReconnecting(attempt);
      }
      this.reconnectionOverlay.show(attempt);
    });

    // Reconnected
    this.networkManager.on('reconnected', ({ message }: any) => {
      console.log('GameScene: Reconnected!', message);
      if (this.networkIndicator) {
        this.networkIndicator.showReconnected();
      }
      this.reconnectionOverlay.hide();

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
    this.networkManager.on('reconnectionFailed', ({ message }: any) => {
      console.log('GameScene: Reconnection failed', message);
      this.reconnectionOverlay.hide();

      // Show error and redirect to menu
      this.events.emit('connectionLost', { message });

      this.time.delayedCall(2000, () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
    });

    // Phase change
    this.networkManager.on('phaseChange', ({ phase }: any) => {
      this.events.emit('phaseChanged', phase);

      if (phase === 'playing') {
        this.roundText.updateRoundText();
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
    this.networkManager.on('turnChange', ({ playerId, isMyTurn }: any) => {
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
    this.networkManager.on('cardAdded', ({ card }: any) => {
      const localPlayer = this.players.find(p => p.networkId === this.networkManager.playerId);
      if (localPlayer) {
        localPlayer.hand.addCard(card);
      }
    });

    // Card played by any player
    this.networkManager.on('cardPlayed', ({ playerId, card }: any) => {
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
    this.networkManager.on('trickWinner', (winnerId: any) => {
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
    this.networkManager.on('playerBid', ({ playerId, bid }: any) => {
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
      this.roundText.updateRoundText();
    });

    // Lead suit changed - update playable cards if it's our turn
    this.networkManager.on('leadSuitChange', (leadSuit: Suit) => {
      if (this.networkManager.isMyTurn() && this.networkManager.getPhase() === 'playing') {
        const localPlayer = this.players.find(p => p.networkId === this.networkManager.playerId);
        if (localPlayer) {
          localPlayer.hand.updatePlayableCards(leadSuit);
        }
      }
    });

    // Error handling
    this.networkManager.on('error', (data: any) => {
      console.error('Network error:', data);
      // Show error message to user instead of silently redirecting
      this.events.emit('networkError', { 
        message: `Connection error: ${data.message || 'Unknown error'}` 
      });
    });

    // Remote player hand changes (for visual card backs)
    this.networkManager.on('remoteHandChanged', ({ playerId, handCount }: any) => {
      const player = this.players.find(p => p.networkId === playerId);
      if (player) {
        player.hand.updateCardCount(handCount);
      }
    });

    // Room left
    this.networkManager.on('roomLeft', (data: any) => {
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
      state.players.forEach((player: any, sessionId: string) => {
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

  onMultiplayerCardPlayed(cardData: CardData) {
    // Send card play to server
    this.networkManager.sendPlayCard(cardData.id);
  }

  setupEventListeners() {
    // Turn changed
    this.gameManager.on(EVENTS.TURN_CHANGED, (playerIndex: number) => {
      this.players.forEach((p, i) => {
        if (i === playerIndex) {
          p.showTurnIndicator();
        } else {
          p.hideTurnIndicator();
        }
      });
    });

    // Phase changed
    this.gameManager.on(EVENTS.PHASE_CHANGED, (phase: any) => {
      this.events.emit('phaseChanged', phase);

      if (phase === PHASE.PLAYING) {
        this.roundText.updateRoundText();
      }
    });

    // Card played
    this.gameManager.on(EVENTS.CARD_PLAYED, () => {
      this.audioManager.playCardSound();
    });

    // Trick complete
    this.gameManager.on(EVENTS.TRICK_COMPLETE, ({ winnerIndex }: any) => {
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
    this.gameManager.on(EVENTS.ROUND_COMPLETE, (data: any) => {
      this.events.emit('roundComplete', data);
    });

    // Game complete
    this.gameManager.on(EVENTS.GAME_COMPLETE, (data: any) => {
      this.audioManager.playWinSound();
      this.events.emit('gameComplete', data);
    });

    // Bid placed
    this.gameManager.on(EVENTS.BID_PLACED, ({ playerIndex, bid }: any) => {
      this.events.emit('bidPlaced', { playerIndex, bid });
    });
  }

  onHumanCardPlayed(cardData: CardData) {
    this.gameManager.playCard(cardData, 0);
  }

  // Called from UIScene when human places bid
  onHumanBid(bid: number) {
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
  onMultiplayerBid(bid: number) {
    if (this.networkManager) {
      this.networkManager.sendBid(bid);
    }
  }

  // Called from UIScene to return to menu
  returnToMenu() {
    this.audioManager.destroy();

    // Clean up multiplayer connection
    if (this.isMultiplayer && this.networkManager) {
      (this.networkManager as any).removeAllListeners();
      this.networkManager.leaveRoom();
    }

    // Clean up network indicator
    if (this.networkIndicator) {
      (this.networkIndicator as any).destroy();
    }

    // Clean up reconnection overlay
    if (this.reconnectionOverlay) {
      this.reconnectionOverlay.destroy();
    }

    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
  }
}
