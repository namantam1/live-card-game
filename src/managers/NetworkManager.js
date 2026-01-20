import { Client } from 'colyseus.js';

/**
 * NetworkManager - Handles Colyseus client-server communication
 *
 * Manages connection to game server, room creation/joining,
 * state synchronization, and game action sending.
 */
export default class NetworkManager {
  constructor() {
    this.client = null;
    this.room = null;
    this.connected = false;
    this.roomCode = null;
    this.playerId = null;
    this.seatIndex = -1;

    // Event listeners
    this.listeners = new Map();

    // Reconnection state
    this.reconnecting = false;
    this.maxReconnectAttempts = 3;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 2000; // Start with 2 seconds
    this.reconnectTimer = null;

    // Connection monitoring
    this.connectionQuality = 'good'; // 'good', 'fair', 'poor', 'offline'
    this.lastPingTime = Date.now();
    this.pingInterval = null;
    this.pingTimeout = 5000; // 5 seconds
    this.serverUrl = null;

    // Saved state for reconnection (using new Colyseus reconnectionToken API)
    this.reconnectionToken = null;
  }

  /**
   * Connect to Colyseus server
   * @param {string} serverUrl - WebSocket server URL
   */
  async connect(serverUrl) {
    try {
      this.serverUrl = serverUrl;
      this.client = new Client(serverUrl);
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('NetworkManager: Connected to server');
      this.emit('connectionChange', { quality: 'good', connected: true });
      return true;
    } catch (error) {
      console.error('NetworkManager: Connection failed', error);
      this.connected = false;
      this.emit('connectionChange', { quality: 'offline', connected: false });
      return false;
    }
  }

  /**
   * Create a new game room
   * @param {string} playerName - Player's display name
   * @returns {string} Room code
   */
  async createRoom(playerName) {
    if (!this.client) {
      console.error('NetworkManager: Not connected to server');
      return null;
    }

    try {
      this.room = await this.client.create('call_break', { name: playerName });
      this.playerId = this.room.sessionId;

      this.setupRoomListeners();

      console.log('NetworkManager: Room created, waiting for room code...');
      return this.room;
    } catch (error) {
      console.error('NetworkManager: Failed to create room', error);
      return null;
    }
  }

  /**
   * Join an existing game room by code
   * @param {string} roomCode - Room code to join
   * @param {string} playerName - Player's display name
   */
  async joinRoom(roomCode, playerName) {
    if (!this.client) {
      console.error('NetworkManager: Not connected to server');
      return null;
    }

    try {
      // Find rooms with matching code
      const rooms = await this.client.getAvailableRooms('call_break');
      const targetRoom = rooms.find(r => r.metadata?.roomCode === roomCode);

      if (targetRoom) {
        this.room = await this.client.joinById(targetRoom.roomId, { name: playerName });
      } else {
        // Try joining by room ID directly (fallback)
        this.room = await this.client.join('call_break', {
          name: playerName,
          roomCode: roomCode
        });
      }

      this.playerId = this.room.sessionId;
      this.setupRoomListeners();

      console.log('NetworkManager: Joined room');
      return this.room;
    } catch (error) {
      console.error('NetworkManager: Failed to join room', error);
      return null;
    }
  }

  /**
   * Setup room state and message listeners
   */
  setupRoomListeners() {
    if (!this.room) return;

    // Save reconnection token for the new Colyseus API
    this.reconnectionToken = this.room.reconnectionToken;

    // Start connection monitoring
    this.startConnectionMonitoring();

    // Handle seat assignment
    this.room.onMessage('seated', (data) => {
      this.seatIndex = data.seatIndex;
      this.roomCode = data.roomCode;
      console.log(`NetworkManager: Seated at ${this.seatIndex}, room code: ${this.roomCode}`);
      this.emit('seated', data);
    });

    // Handle dealt notification
    this.room.onMessage('dealt', () => {
      console.log('NetworkManager: Cards dealt');
      this.emit('dealt');
    });

    // Handle player left
    this.room.onMessage('playerLeft', (data) => {
      console.log(`NetworkManager: ${data.name} left`);
      this.emit('playerLeft', data);
    });

    // State change listeners
    this.room.state.listen('phase', (value, previousValue) => {
      console.log(`NetworkManager: Phase changed from ${previousValue} to ${value}`);
      
      // Add extra validation during critical phase transitions
      if (value === 'trickEnd') {
        console.log('NetworkManager: Entering trickEnd phase');
        console.log('  - Current trick count:', this.room.state.currentTrick?.length || 0);
        console.log('  - Trick winner:', this.room.state.trickWinner || 'not set');
      }
      
      this.emit('phaseChange', { phase: value, previousPhase: previousValue });
    });

    this.room.state.listen('currentTurn', (value) => {
      console.log(`NetworkManager: Turn changed to ${value}`);
      this.emit('turnChange', { playerId: value, isMyTurn: value === this.playerId });
    });

    this.room.state.listen('leadSuit', (value) => {
      this.emit('leadSuitChange', value);
    });

    this.room.state.listen('trickWinner', (value) => {
      if (value) {
        this.emit('trickWinner', value);
      }
    });

    this.room.state.listen('currentRound', (value) => {
      this.emit('roundChange', value);
    });

    this.room.state.listen('trickNumber', (value) => {
      this.emit('trickNumberChange', value);
    });

    // Player state changes
    this.room.state.players.onAdd((player, sessionId) => {
      console.log(`NetworkManager: Player ${player.name} joined`);
      this.emit('playerJoined', { player, sessionId });

      // Listen to player changes
      player.listen('bid', (value) => {
        this.emit('playerBid', { playerId: sessionId, bid: value });
      });

      player.listen('tricksWon', (value) => {
        this.emit('playerTricksWon', { playerId: sessionId, tricksWon: value });
      });

      player.listen('score', (value) => {
        this.emit('playerScoreChange', { playerId: sessionId, score: value });
      });

      player.listen('roundScore', (value) => {
        this.emit('playerRoundScore', { playerId: sessionId, roundScore: value });
      });

      player.listen('isReady', (value) => {
        this.emit('playerReady', { playerId: sessionId, isReady: value });
      });

      player.listen('isConnected', (value) => {
        this.emit('playerConnection', { playerId: sessionId, isConnected: value });
      });

      // Hand changes
      player.hand.onAdd((card, index) => {
        if (sessionId === this.playerId) {
          // For local player, emit the actual card
          this.emit('cardAdded', { card: this.cardToObject(card), index });
        } else {
          // For remote players, emit hand count change for visual update
          this.emit('remoteHandChanged', { playerId: sessionId, handCount: player.hand.length });
        }
      });

      player.hand.onRemove((card, index) => {
        if (sessionId === this.playerId) {
          this.emit('cardRemoved', { cardId: card.id, index });
        } else {
          // For remote players, emit hand count change for visual update
          this.emit('remoteHandChanged', { playerId: sessionId, handCount: player.hand.length });
        }
      });
    });

    this.room.state.players.onRemove((player, sessionId) => {
      console.log(`NetworkManager: Player ${player.name} removed`);
      this.emit('playerRemoved', { player, sessionId });
    });

    // Current trick changes
    this.room.state.currentTrick.onAdd((entry) => {
      console.log(`NetworkManager: Card played by ${entry.playerId}`);
      this.emit('cardPlayed', {
        playerId: entry.playerId,
        card: this.cardToObject(entry.card)
      });
    });

    this.room.state.currentTrick.onRemove(() => {
      this.emit('trickCleared');
    });

    // Room error handling
    this.room.onError((code, message) => {
      console.error(`NetworkManager: Room error ${code}: ${message}`);
      this.emit('error', { code, message });
    });

    // Room leave handling
    this.room.onLeave((code) => {
      console.log(`NetworkManager: Left room with code ${code}`);

      // Stop connection monitoring
      this.stopConnectionMonitoring();

      // Check if this was an unexpected disconnect
      if (code !== 1000 && code !== 4000) {
        console.log('NetworkManager: Unexpected disconnect, attempting reconnection...');
        this.handleUnexpectedDisconnect();
      } else {
        // Clean disconnect
        this.emit('roomLeft', { code });
        this.room = null;
        this.roomCode = null;
        this.reconnectionToken = null;
      }
    });
  }

  /**
   * Convert Colyseus Card schema to plain object
   */
  cardToObject(card) {
    return {
      id: card.id,
      suit: card.suit,
      rank: card.rank,
      value: card.value
    };
  }

  /**
   * Send ready signal to server
   */
  sendReady() {
    if (this.room) {
      this.room.send('ready');
      console.log('NetworkManager: Sent ready');
    }
  }

  /**
   * Send bid to server
   * @param {number} bid - Bid value (1-8)
   */
  sendBid(bid) {
    if (this.room) {
      this.room.send('bid', { bid });
      console.log(`NetworkManager: Sent bid ${bid}`);
    }
  }

  /**
   * Send card play to server
   * @param {string} cardId - Card ID to play
   */
  sendPlayCard(cardId) {
    if (this.room) {
      this.room.send('playCard', { cardId });
      console.log(`NetworkManager: Sent playCard ${cardId}`);
    }
  }

  /**
   * Send next round signal
   */
  sendNextRound() {
    if (this.room) {
      this.room.send('nextRound');
      console.log('NetworkManager: Sent nextRound');
    }
  }

  /**
   * Send restart signal
   */
  sendRestart() {
    if (this.room) {
      this.room.send('restart');
      console.log('NetworkManager: Sent restart');
    }
  }

  /**
   * Get current game state
   */
  getState() {
    return this.room?.state || null;
  }

  /**
   * Get local player's hand
   */
  getMyHand() {
    if (!this.room || !this.playerId) return [];
    const player = this.room.state.players.get(this.playerId);
    if (!player) return [];
    return Array.from(player.hand).map(c => this.cardToObject(c));
  }

  /**
   * Get all players
   */
  getPlayers() {
    if (!this.room) return [];
    const players = [];
    this.room.state.players.forEach((player, sessionId) => {
      players.push({
        id: sessionId,
        name: player.name,
        emoji: player.emoji,
        seatIndex: player.seatIndex,
        isReady: player.isReady,
        isConnected: player.isConnected,
        bid: player.bid,
        tricksWon: player.tricksWon,
        score: player.score,
        roundScore: player.roundScore,
        isLocal: sessionId === this.playerId
      });
    });
    return players.sort((a, b) => a.seatIndex - b.seatIndex);
  }

  /**
   * Get player by session ID
   */
  getPlayer(sessionId) {
    return this.room?.state.players.get(sessionId) || null;
  }

  /**
   * Check if it's local player's turn
   */
  isMyTurn() {
    return this.room?.state.currentTurn === this.playerId;
  }

  /**
   * Get current phase
   */
  getPhase() {
    return this.room?.state.phase || 'waiting';
  }

  /**
   * Get lead suit for current trick
   */
  getLeadSuit() {
    return this.room?.state.leadSuit || '';
  }

  /**
   * Get room code
   */
  getRoomCode() {
    return this.roomCode;
  }

  /**
   * Leave current room
   */
  async leaveRoom() {
    if (this.room) {
      await this.room.leave(true); // Pass true to indicate consented leave
      this.room = null;
      this.roomCode = null;
      this.seatIndex = -1;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.stopConnectionMonitoring();
    this.cancelReconnection();
    this.leaveRoom();
    this.client = null;
    this.connected = false;
    this.reconnectionToken = null;
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.connected && this.client !== null;
  }

  /**
   * Check if in a room
   */
  isInRoom() {
    return this.room !== null;
  }

  // Event emitter methods

  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {function} callback - Handler function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {function} callback - Handler function
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`NetworkManager: Error in ${event} listener`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   * @param {string} event - Event name
   */
  removeAllListeners(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  // ============ Connection Monitoring Methods ============

  /**
   * Start monitoring connection quality
   */
  startConnectionMonitoring() {
    if (this.pingInterval) return;

    this.lastPingTime = Date.now();
    this.connectionQuality = 'good';

    // Monitor state updates to detect connection health
    this.pingInterval = setInterval(() => {
      const timeSinceLastPing = Date.now() - this.lastPingTime;

      if (timeSinceLastPing > this.pingTimeout * 3) {
        // No updates for a long time - poor connection or offline
        this.updateConnectionQuality('offline');
      } else if (timeSinceLastPing > this.pingTimeout * 2) {
        // Slow connection
        this.updateConnectionQuality('poor');
      } else if (timeSinceLastPing > this.pingTimeout) {
        // Fair connection
        this.updateConnectionQuality('fair');
      } else {
        // Good connection
        this.updateConnectionQuality('good');
      }
    }, 2000);

    // Update ping time whenever we receive state updates
    if (this.room && this.room.state) {
      const originalOnChange = this.room.state.onChange || (() => {});
      this.room.state.onChange = () => {
        this.lastPingTime = Date.now();
        originalOnChange();
      };
    }
  }

  /**
   * Stop connection monitoring
   */
  stopConnectionMonitoring() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Update connection quality
   */
  updateConnectionQuality(quality) {
    if (this.connectionQuality !== quality) {
      this.connectionQuality = quality;
      console.log(`NetworkManager: Connection quality changed to ${quality}`);
      this.emit('connectionQualityChange', {
        quality,
        connected: quality !== 'offline'
      });
    }
  }

  /**
   * Get current connection quality
   */
  getConnectionQuality() {
    return this.connectionQuality;
  }

  // ============ Reconnection Methods ============

  /**
   * Handle unexpected disconnect and attempt reconnection
   */
  async handleUnexpectedDisconnect() {
    if (this.reconnecting) return;

    this.reconnecting = true;
    this.updateConnectionQuality('offline');
    this.emit('reconnecting', { attempt: this.reconnectAttempts + 1 });

    await this.attemptReconnection();
  }

  /**
   * Attempt to reconnect to the room
   */
  async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('NetworkManager: Max reconnection attempts reached');
      this.reconnecting = false;
      this.emit('reconnectionFailed', {
        message: 'Could not reconnect to the game'
      });
      this.emit('roomLeft', { code: 1006 }); // Abnormal closure
      this.room = null;
      this.roomCode = null;
      this.reconnectionToken = null;
      return;
    }

    this.reconnectAttempts++;
    console.log(`NetworkManager: Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    try {
      // Try to reconnect using the reconnectionToken (new Colyseus API)
      if (this.reconnectionToken && this.client) {
        this.room = await this.client.reconnect(this.reconnectionToken);

        // Reconnection successful
        console.log('NetworkManager: Reconnection successful!');
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        this.updateConnectionQuality('good');

        // Update reconnection token for future reconnections
        this.reconnectionToken = this.room.reconnectionToken;

        // Re-setup listeners
        this.setupRoomListeners();

        this.emit('reconnected', {
          message: 'Reconnected to game'
        });
      } else {
        throw new Error('No reconnection token available');
      }
    } catch (error) {
      console.error('NetworkManager: Reconnection failed', error);

      // Schedule next attempt with exponential backoff
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`NetworkManager: Retrying in ${delay}ms...`);

      this.reconnectTimer = setTimeout(() => {
        this.attemptReconnection();
      }, delay);
    }
  }

  /**
   * Cancel ongoing reconnection attempts
   */
  cancelReconnection() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if currently reconnecting
   */
  isReconnecting() {
    return this.reconnecting;
  }
}
