import Phaser from 'phaser';
import { COLORS, ANIMATION, SERVER } from '../utils/constants';
import NetworkManager from '../managers/NetworkManager';
import NetworkIndicator from '../components/NetworkIndicator';
import Button from '../components/Button';
import { getFontSize } from '../utils/uiConfig';
import Common from '../objects/game/Common';

export default class LobbyScene extends Phaser.Scene {
  networkManager!: NetworkManager;
  playerName: string;
  roomCode: string;
  mode: string;
  players: never[];
  isTransitioning: boolean;
  PLAYER_NAME_KEY: string;
  centerX!: number;
  centerY!: number;
  menuContainer!: Phaser.GameObjects.Container;
  joinContainer!: Phaser.GameObjects.Container;
  waitingContainer!: Phaser.GameObjects.Container;
  networkIndicator!: NetworkIndicator;
  nameInput: any;
  connectionStatus: any;
  roomCodeInput: any;
  joinError!: Phaser.GameObjects.Text;
  roomCodeDisplay!: Phaser.GameObjects.Text;
  playersListContainer!: Phaser.GameObjects.Container;
  waitingText!: Phaser.GameObjects.Text;
  readyBtn!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'LobbyScene' });
    this.playerName = '';
    this.roomCode = '';
    this.mode = 'menu'; // 'menu', 'join', 'waiting'
    this.players = [];
    this.isTransitioning = false;
    this.PLAYER_NAME_KEY = 'callbreak_player_name'; // localStorage key
  }

  create() {
    const { centerX, centerY } = this.cameras.main;
    this.centerX = centerX;
    this.centerY = centerY;

    // Reset state
    this.isTransitioning = false;

    // Initialize network manager
    this.networkManager = new NetworkManager();

    // Background
    Common.createBackground(this);

    // Container for different views
    this.menuContainer = this.add.container(0, 0);
    this.joinContainer = this.add.container(0, 0).setVisible(false);
    this.waitingContainer = this.add.container(0, 0).setVisible(false);

    // Create different views
    this.createMenuView();
    this.createJoinView();
    this.createWaitingView();

    // Create network indicator (will be shown after connection)
    this.createNetworkIndicator();

    // Connect to server
    this.connectToServer();
  }

  createNetworkIndicator() {
    const { width } = this.cameras.main;

    // Create network indicator in top-right corner
    this.networkIndicator = new NetworkIndicator(this, width - 50, 50);
    // this.networkIndicator.setVisible(false); // Hide until connected
  }

  createMenuView() {
    const { centerX, centerY } = this;
    const { width, height } = this.cameras.main;

    // Title
    const title = this.add
      .text(centerX, centerY - 200, 'Call Break', {
        fontFamily: 'Arial, sans-serif',
        fontSize: getFontSize('lobbyTitle', width, height),
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(centerX, centerY - 130, 'Multiplayer', {
        fontFamily: 'Arial, sans-serif',
        fontSize: getFontSize('lobbySubtitle', width, height),
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // Name input label
    const nameLabel = this.add
      .text(centerX, centerY - 70, 'Enter your name:', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    // Name input field (using rexUI InputText)
    this.nameInput = Common.createInputField(this, {
      x: centerX,
      y: centerY - 30,
      width: 350,
    });

    // Load and prefill saved name from localStorage
    const savedName = this.loadPlayerName();
    if (savedName) {
      this.nameInput.setText(savedName);
    }

    // Create Room button
    const createBtn = this.createButton(
      centerX,
      centerY + 50,
      'Create Room',
      () => {
        this.handleCreateRoom();
      }
    );

    // Join Room button
    const joinBtn = this.createButton(
      centerX,
      centerY + 150,
      'Join Room',
      () => {
        const name = this.nameInput.text.trim();
        if (!name) {
          this.connectionStatus
            .setText('Please enter your name first')
            .setColor('#ef4444');
          return;
        }
        this.showJoinView();
      }
    );

    // Back to Menu button
    const backBtn = this.createButton(
      centerX,
      centerY + 250,
      'Back to Menu',
      () => {
        this.scene.start('MenuScene');
      },
      0x475569
    );

    // Connection status
    this.connectionStatus = this.add
      .text(centerX, this.cameras.main.height - 30, 'Connecting...', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#f59e0b',
      })
      .setOrigin(0.5);

    this.menuContainer.add([
      title,
      subtitle,
      nameLabel,
      createBtn,
      joinBtn,
      backBtn,
      this.connectionStatus,
    ]);
  }

  createJoinView() {
    const { centerX, centerY } = this;

    // Title
    const title = this.add
      .text(centerX, centerY - 120, 'Join Room', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Room code label
    const codeLabel = this.add
      .text(centerX, centerY - 50, 'Enter Room Code:', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    // Room code input
    this.roomCodeInput = Common.createInputField(this, {
      x: centerX,
      y: centerY - 10,
      width: 350,
      uppercase: true,
    });
    this.roomCodeInput.setVisible(false); // Hidden initially

    // Join button
    const joinBtn = this.createButton(centerX, centerY + 70, 'Join', () => {
      this.handleJoinRoom();
    });

    // Back button
    const backBtn = this.createButton(
      centerX,
      centerY + 180,
      'Back',
      () => {
        this.showMenuView();
      },
      0x475569
    );

    // Error message
    this.joinError = this.add
      .text(centerX, centerY + 200, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ef4444',
      })
      .setOrigin(0.5);

    this.joinContainer.add([
      title,
      codeLabel,
      joinBtn,
      backBtn,
      this.joinError,
    ]);
  }

  createWaitingView() {
    const { centerX, centerY } = this;

    // Title
    const waitTitle = this.add
      .text(centerX, centerY - 180, 'Waiting Room', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Room code display
    this.roomCodeDisplay = this.add
      .text(centerX, centerY - 135, 'Room Code: ----', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '35px',
        fontStyle: 'bold',
        color: '#22c55e',
      })
      .setOrigin(0.5);

    // Copy hint
    const copyHint = this.add
      .text(centerX, centerY - 85, 'Share this code with friends!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // Players list container
    this.playersListContainer = this.add.container(centerX, centerY);

    // Waiting text
    this.waitingText = this.add
      .text(centerX, centerY + 120, 'Waiting for players... (0/4)', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // Ready button
    this.readyBtn = this.createButton(centerX, centerY + 180, 'Ready', () => {
      this.handleReady();
    });
    this.readyBtn.setVisible(false);

    // Leave button
    const leaveBtn = this.createButton(
      centerX,
      centerY + 280,
      'Leave Room',
      () => {
        this.handleLeaveRoom();
      },
      0xef4444
    );

    this.waitingContainer.add([
      waitTitle,
      this.roomCodeDisplay,
      copyHint,
      this.playersListContainer,
      this.waitingText,
      this.readyBtn,
      leaveBtn,
    ]);
  }

  createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    bgColor: number = COLORS.PRIMARY
  ) {
    return Button.create(this, x, y, {
      width: 350,
      height: 80,
      text,
      onClick: callback,
      bgColor,
      borderRadius: 10,
      fontSize: '30px',
      hoverScale: 1.05,
      pressScale: 0.95,
    });
  }

  async connectToServer() {
    const connected = await this.networkManager.connect(SERVER.URL);
    if (connected) {
      this.connectionStatus.setText('Connected').setColor('#22c55e');
      // this.networkIndicator.setVisible(true);
      this.networkIndicator.updateQuality('good');
      this.setupNetworkListeners();
    } else {
      this.connectionStatus
        .setText('Connection failed. Retry...')
        .setColor('#ef4444');
      this.networkIndicator.updateQuality('offline');
      // Retry after 3 seconds
      this.time.delayedCall(3000, () => this.connectToServer());
    }
  }

  setupNetworkListeners() {
    // Connection quality changes
    this.networkManager.on('connectionQualityChange', ({ quality }: any) => {
      if (this.networkIndicator) {
        this.networkIndicator.updateQuality(quality);
      }
    });

    // Room created/joined - receive seat and room code
    this.networkManager.on('seated', (data: any) => {
      this.roomCode = data.roomCode;
      this.roomCodeDisplay.setText(`Room Code: ${this.roomCode}`);
    });

    // Player joined
    this.networkManager.on('playerJoined', (data: any) => {
      this.updatePlayersList();
    });

    // Player left
    this.networkManager.on('playerRemoved', (data: any) => {
      this.updatePlayersList();
    });

    // Player ready status changed
    this.networkManager.on('playerReady', (data: any) => {
      this.updatePlayersList();
    });

    // Phase change - when game starts
    this.networkManager.on('phaseChange', (data: any) => {
      if (data.phase === 'dealing' || data.phase === 'bidding') {
        this.startGame();
      }
    });

    // Error handling
    this.networkManager.on('error', (data: any) => {
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
    this.nameInput.setVisible(true);
    this.roomCodeInput.setVisible(false);
    this.joinError.setText('');
  }

  showJoinView() {
    this.mode = 'join';
    this.menuContainer.setVisible(false);
    this.joinContainer.setVisible(true);
    this.waitingContainer.setVisible(false);
    this.nameInput.setVisible(false);
    this.roomCodeInput.setVisible(true);
    this.joinError.setText('');
  }

  showWaitingView() {
    this.mode = 'waiting';
    this.menuContainer.setVisible(false);
    this.joinContainer.setVisible(false);
    this.waitingContainer.setVisible(true);
    this.nameInput.setVisible(false);
    this.roomCodeInput.setVisible(false);
    this.readyBtn.setVisible(true);
    this.updatePlayersList();
  }

  async handleCreateRoom() {
    const name = this.nameInput.text.trim();
    if (!name) {
      this.connectionStatus
        .setText('Please enter your name')
        .setColor('#ef4444');
      return;
    }

    if (!this.networkManager.isConnected()) {
      this.connectionStatus
        .setText('Not connected to server')
        .setColor('#ef4444');
      return;
    }

    this.connectionStatus.setText('Creating room...').setColor('#f59e0b');
    const room = await this.networkManager.createRoom(name);

    if (room) {
      this.playerName = name;
      this.savePlayerName(name);
      this.showWaitingView();
    } else {
      this.connectionStatus
        .setText('Failed to create room')
        .setColor('#ef4444');
    }
  }

  async handleJoinRoom() {
    const name = this.nameInput.text.trim();
    const code = this.roomCodeInput.text.trim().toUpperCase();

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

    this.joinError.setText('Joining room...').setColor('#f59e0b');

    try {
      const room = await this.networkManager.joinRoom(code, name);

      if (room) {
        this.playerName = name;
        this.savePlayerName(name);
        this.roomCode = code;
        this.showWaitingView();
      }
    } catch (error: any) {
      console.error('Failed to join room:', error);
      const errorMsg = error.message || 'Room not found or full';
      this.joinError.setText(errorMsg).setColor('#ef4444');
    }
  }

  handleReady() {
    this.networkManager.sendReady();
    this.readyBtn.setVisible(false);

    // Show "waiting for others" text
    const players = this.networkManager.getPlayers();
    const readyCount = players.filter((p) => p.isReady).length;
    this.waitingText.setText(`Ready! Waiting for others... (${readyCount}/4)`);
  }

  async handleLeaveRoom() {
    try {
      await this.networkManager.leaveRoom();
      // Reset input fields
      this.nameInput.setText('');
      this.roomCodeInput.setText('');
      this.showMenuView();
    } catch (error) {
      console.error('Error leaving room:', error);
      this.showMenuView();
    }
  }

  updatePlayersList() {
    // Clear existing list
    this.playersListContainer.removeAll(true);

    const players = this.networkManager.getPlayers();
    const localId = this.networkManager.playerId;

    players.forEach((player, index) => {
      const y = -50 + index * 35;
      const isLocal = player.id === localId;

      // Player emoji and name
      const nameText = this.add
        .text(
          -100,
          y,
          `${player.emoji} ${player.name}${isLocal ? ' (You)' : ''}`,
          {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: isLocal ? '#22c55e' : '#ffffff',
          }
        )
        .setOrigin(0, 0.5);

      // Ready status
      const status = this.add
        .text(150, y, player.isReady ? 'Ready' : 'Waiting...', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          color: player.isReady ? '#22c55e' : '#94a3b8',
        })
        .setOrigin(1, 0.5);

      this.playersListContainer.add([nameText, status]);
    });

    // Update waiting text
    const readyCount = players.filter((p) => p.isReady).length;
    this.waitingText.setText(
      `Waiting for players... (${players.length}/4) - ${readyCount} ready`
    );

    // Show ready button only if local player hasn't readied
    const localPlayer = players.find((p) => p.id === localId);
    if (localPlayer && !localPlayer.isReady) {
      this.readyBtn.setVisible(true);
    }
  }

  startGame() {
    // Prevent multiple calls
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // Transition to GameScene with network manager
    this.cameras.main.fadeOut(ANIMATION.SCENE_TRANSITION);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        networkManager: this.networkManager,
        isMultiplayer: true,
      });
    });
  }

  savePlayerName(name: string) {
    try {
      localStorage.setItem(this.PLAYER_NAME_KEY, name);
    } catch (error) {
      console.error('Error saving player name to localStorage:', error);
    }
  }

  loadPlayerName() {
    try {
      return localStorage.getItem(this.PLAYER_NAME_KEY);
    } catch (error) {
      console.error('Error loading player name from localStorage:', error);
      return null;
    }
  }

  shutdown() {
    // Clean up input text objects
    if (this.nameInput) {
      this.nameInput.destroy();
    }
    if (this.roomCodeInput) {
      this.roomCodeInput.destroy();
    }
    // Clean up network indicator
    if (this.networkIndicator) {
      this.networkIndicator.destroy();
    }
  }
}
