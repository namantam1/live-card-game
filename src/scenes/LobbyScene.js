import Phaser from 'phaser';
import { COLORS, ANIMATION, SERVER } from '../utils/constants.js';
import NetworkManager from '../managers/NetworkManager.js';

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
    this.networkManager = null;
    this.playerName = '';
    this.roomCode = '';
    this.mode = 'menu'; // 'menu', 'join', 'waiting'
    this.players = [];
    this.isTransitioning = false;
  }

  create() {
    const { width, height } = this.cameras.main;
    this.centerX = width / 2;
    this.centerY = height / 2;

    // Reset state
    this.isTransitioning = false;

    // Initialize network manager
    this.networkManager = new NetworkManager();

    // Background
    this.createBackground();

    // Container for different views
    this.menuContainer = this.add.container(0, 0);
    this.joinContainer = this.add.container(0, 0).setVisible(false);
    this.waitingContainer = this.add.container(0, 0).setVisible(false);

    // Create different views
    this.createMenuView();
    this.createJoinView();
    this.createWaitingView();

    // Connect to server
    this.connectToServer();
  }

  createBackground() {
    const { width, height } = this.cameras.main;

    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e);
    graphics.fillRect(0, 0, width, height);

    graphics.fillStyle(0x6366f1, 0.1);
    graphics.fillCircle(width * 0.25, height * 0.25, 200);
    graphics.fillStyle(0x8b5cf6, 0.1);
    graphics.fillCircle(width * 0.75, height * 0.75, 250);
  }

  createMenuView() {
    const { centerX, centerY } = this;

    // Title
    const title = this.add.text(centerX, centerY - 180, 'Call Break', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '42px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const subtitle = this.add.text(centerX, centerY - 130, 'Multiplayer', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Name input label
    const nameLabel = this.add.text(centerX, centerY - 70, 'Enter your name:', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#cbd5e1',
    }).setOrigin(0.5);

    // Name input field (using DOM element)
    this.nameInput = this.createInputField(centerX, centerY - 30, 250, 'Your Name');

    // Create Room button
    const createBtn = this.createButton(centerX, centerY + 50, 'Create Room', () => {
      this.handleCreateRoom();
    });

    // Join Room button
    const joinBtn = this.createButton(centerX, centerY + 120, 'Join Room', () => {
      this.showJoinView();
    });

    // Back to Menu button
    const backBtn = this.createButton(centerX, centerY + 190, 'Back to Menu', () => {
      this.scene.start('MenuScene');
    }, 0x475569);

    // Connection status
    this.connectionStatus = this.add.text(centerX, this.cameras.main.height - 30, 'Connecting...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#f59e0b',
    }).setOrigin(0.5);

    this.menuContainer.add([title, subtitle, nameLabel, createBtn, joinBtn, backBtn, this.connectionStatus]);
  }

  createJoinView() {
    const { centerX, centerY } = this;

    // Title
    const title = this.add.text(centerX, centerY - 120, 'Join Room', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Room code label
    const codeLabel = this.add.text(centerX, centerY - 50, 'Enter Room Code:', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#cbd5e1',
    }).setOrigin(0.5);

    // Room code input
    this.roomCodeInput = this.createInputField(centerX, centerY - 10, 200, 'XXXX', true);

    // Join button
    const joinBtn = this.createButton(centerX, centerY + 70, 'Join', () => {
      this.handleJoinRoom();
    });

    // Back button
    const backBtn = this.createButton(centerX, centerY + 140, 'Back', () => {
      this.showMenuView();
    }, 0x475569);

    // Error message
    this.joinError = this.add.text(centerX, centerY + 200, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#ef4444',
    }).setOrigin(0.5);

    this.joinContainer.add([title, codeLabel, joinBtn, backBtn, this.joinError]);
  }

  createWaitingView() {
    const { centerX, centerY } = this;

    // Title
    const waitTitle = this.add.text(centerX, centerY - 180, 'Waiting Room', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Room code display
    this.roomCodeDisplay = this.add.text(centerX, centerY - 120, 'Room Code: ----', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#22c55e',
    }).setOrigin(0.5);

    // Copy hint
    const copyHint = this.add.text(centerX, centerY - 85, 'Share this code with friends!', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Players list container
    this.playersListContainer = this.add.container(centerX, centerY);

    // Waiting text
    this.waitingText = this.add.text(centerX, centerY + 120, 'Waiting for players... (0/4)', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    // Ready button
    this.readyBtn = this.createButton(centerX, centerY + 180, 'Ready', () => {
      this.handleReady();
    });
    this.readyBtn.setVisible(false);

    // Leave button
    const leaveBtn = this.createButton(centerX, centerY + 250, 'Leave Room', () => {
      this.handleLeaveRoom();
    }, 0xef4444);

    this.waitingContainer.add([waitTitle, this.roomCodeDisplay, copyHint, this.playersListContainer, this.waitingText, this.readyBtn, leaveBtn]);
  }

  createInputField(x, y, width, placeholder, uppercase = false) {
    // Create an HTML input element
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    input.maxLength = uppercase ? 4 : 20;
    input.style.cssText = `
      position: absolute;
      width: ${width}px;
      height: 40px;
      padding: 0 15px;
      font-size: 18px;
      font-family: Arial, sans-serif;
      background: rgba(30, 41, 59, 0.9);
      border: 2px solid #475569;
      border-radius: 8px;
      color: #ffffff;
      outline: none;
      text-align: center;
      ${uppercase ? 'text-transform: uppercase;' : ''}
    `;

    input.addEventListener('focus', () => {
      input.style.borderColor = '#6366f1';
    });

    input.addEventListener('blur', () => {
      input.style.borderColor = '#475569';
    });

    // Add to DOM
    this.add.dom(x, y, input);

    return input;
  }

  createButton(x, y, text, callback, bgColor = COLORS.PRIMARY) {
    const buttonWidth = 200;
    const buttonHeight = 45;

    const container = this.add.container(x, y);

    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);

    // Button text
    const btnText = this.add.text(0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, btnText]);

    // Make interactive
    const hitArea = new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      this.tweens.add({ targets: container, scaleX: 1.05, scaleY: 1.05, duration: 100 });
    });

    container.on('pointerout', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 });
    });

    container.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.95, scaleY: 0.95, duration: 50 });
    });

    container.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 50 });
      callback();
    });

    return container;
  }

  async connectToServer() {
    const connected = await this.networkManager.connect(SERVER.URL);
    if (connected) {
      this.connectionStatus.setText('Connected').setColor('#22c55e');
      this.setupNetworkListeners();
    } else {
      this.connectionStatus.setText('Connection failed. Retry...').setColor('#ef4444');
      // Retry after 3 seconds
      this.time.delayedCall(3000, () => this.connectToServer());
    }
  }

  setupNetworkListeners() {
    // Room created/joined - receive seat and room code
    this.networkManager.on('seated', (data) => {
      this.roomCode = data.roomCode;
      this.roomCodeDisplay.setText(`Room Code: ${this.roomCode}`);
    });

    // Player joined
    this.networkManager.on('playerJoined', (data) => {
      this.updatePlayersList();
    });

    // Player left
    this.networkManager.on('playerRemoved', (data) => {
      this.updatePlayersList();
    });

    // Player ready status changed
    this.networkManager.on('playerReady', (data) => {
      this.updatePlayersList();
    });

    // Phase change - when game starts
    this.networkManager.on('phaseChange', (data) => {
      if (data.phase === 'dealing' || data.phase === 'bidding') {
        this.startGame();
      }
    });

    // Error handling
    this.networkManager.on('error', (data) => {
      console.error('Network error:', data);
      this.joinError.setText('Error: ' + data.message);
    });

    // Room left
    this.networkManager.on('roomLeft', () => {
      this.showMenuView();
    });
  }

  showMenuView() {
    this.mode = 'menu';
    this.menuContainer.setVisible(true);
    this.joinContainer.setVisible(false);
    this.waitingContainer.setVisible(false);
    this.joinError.setText('');
  }

  showJoinView() {
    this.mode = 'join';
    this.menuContainer.setVisible(false);
    this.joinContainer.setVisible(true);
    this.waitingContainer.setVisible(false);
    this.joinError.setText('');
  }

  showWaitingView() {
    this.mode = 'waiting';
    this.menuContainer.setVisible(false);
    this.joinContainer.setVisible(false);
    this.waitingContainer.setVisible(true);
    this.readyBtn.setVisible(true);
    this.updatePlayersList();
  }

  async handleCreateRoom() {
    const name = this.nameInput.value.trim();
    if (!name) {
      this.connectionStatus.setText('Please enter your name').setColor('#ef4444');
      return;
    }

    if (!this.networkManager.isConnected()) {
      this.connectionStatus.setText('Not connected to server').setColor('#ef4444');
      return;
    }

    this.connectionStatus.setText('Creating room...').setColor('#f59e0b');
    const room = await this.networkManager.createRoom(name);

    if (room) {
      this.playerName = name;
      this.showWaitingView();
    } else {
      this.connectionStatus.setText('Failed to create room').setColor('#ef4444');
    }
  }

  async handleJoinRoom() {
    const name = this.nameInput.value.trim();
    const code = this.roomCodeInput.value.trim().toUpperCase();

    if (!name) {
      this.joinError.setText('Please enter your name first');
      return;
    }

    if (!code || code.length !== 4) {
      this.joinError.setText('Please enter a valid 4-character room code');
      return;
    }

    if (!this.networkManager.isConnected()) {
      this.joinError.setText('Not connected to server');
      return;
    }

    this.joinError.setText('Joining room...');
    const room = await this.networkManager.joinRoom(code, name);

    if (room) {
      this.playerName = name;
      this.roomCode = code;
      this.showWaitingView();
    } else {
      this.joinError.setText('Room not found or full');
    }
  }

  handleReady() {
    this.networkManager.sendReady();
    this.readyBtn.setVisible(false);

    // Show "waiting for others" text
    const players = this.networkManager.getPlayers();
    const readyCount = players.filter(p => p.isReady).length;
    this.waitingText.setText(`Ready! Waiting for others... (${readyCount}/4)`);
  }

  async handleLeaveRoom() {
    await this.networkManager.leaveRoom();
    this.showMenuView();
  }

  updatePlayersList() {
    // Clear existing list
    this.playersListContainer.removeAll(true);

    const players = this.networkManager.getPlayers();
    const localId = this.networkManager.playerId;

    players.forEach((player, index) => {
      const y = -60 + index * 35;
      const isLocal = player.id === localId;

      // Player emoji and name
      const nameText = this.add.text(-100, y, `${player.emoji} ${player.name}${isLocal ? ' (You)' : ''}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: isLocal ? '#22c55e' : '#ffffff',
      }).setOrigin(0, 0.5);

      // Ready status
      const status = this.add.text(100, y, player.isReady ? 'Ready' : 'Waiting...', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: player.isReady ? '#22c55e' : '#94a3b8',
      }).setOrigin(1, 0.5);

      this.playersListContainer.add([nameText, status]);
    });

    // Update waiting text
    const readyCount = players.filter(p => p.isReady).length;
    this.waitingText.setText(`Waiting for players... (${players.length}/4) - ${readyCount} ready`);

    // Show ready button only if local player hasn't readied
    const localPlayer = players.find(p => p.id === localId);
    if (localPlayer && !localPlayer.isReady) {
      this.readyBtn.setVisible(true);
    }
  }

  startGame() {
    // Prevent multiple calls
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // Safety check for camera
    if (!this.cameras || !this.cameras.main) {
      this.scene.start('GameScene', {
        networkManager: this.networkManager,
        isMultiplayer: true
      });
      return;
    }

    // Transition to GameScene with network manager
    this.cameras.main.fadeOut(ANIMATION.SCENE_TRANSITION);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        networkManager: this.networkManager,
        isMultiplayer: true
      });
    });
  }

  shutdown() {
    // Clean up DOM elements
    if (this.nameInput && this.nameInput.parentNode) {
      this.nameInput.parentNode.removeChild(this.nameInput);
    }
    if (this.roomCodeInput && this.roomCodeInput.parentNode) {
      this.roomCodeInput.parentNode.removeChild(this.roomCodeInput);
    }
  }
}
