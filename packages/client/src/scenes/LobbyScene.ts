import Phaser from 'phaser';
import { ANIMATION, SERVER } from '../utils/constants';
import NetworkManager from '../managers/NetworkManager';
import NetworkIndicator from '../components/NetworkIndicator';
import Common from '../objects/game/Common';
import { MenuView } from '../components/lobby/MenuView';
import { JoinView } from '../components/lobby/JoinView';
import { WaitingView } from '../components/lobby/WaitingView';
import { storage } from '../managers/StorageManager';
import { validatePlayerName, validateRoomCode } from '../utils/validation';

export default class LobbyScene extends Phaser.Scene {
  // Managers
  private networkManager!: NetworkManager;
  private networkIndicator!: NetworkIndicator;

  // View components
  private menuView!: MenuView;
  private joinView!: JoinView;
  private waitingView!: WaitingView;

  // Scene state
  private currentView: 'menu' | 'join' | 'waiting' = 'menu';
  private playerName: string = '';
  private roomCode: string = '';
  private isTransitioning: boolean = false;
  private isCreatingRoom: boolean = false;
  private isJoiningRoom: boolean = false;
  private isReadying: boolean = false;

  // Constants
  private readonly PLAYER_NAME_KEY = 'player_name';

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create() {
    // Reset state
    this.isTransitioning = false;

    // Background
    Common.createBackground(this);

    // Initialize managers
    this.initializeManagers();

    // Create view components
    this.createViews();

    // Setup event handlers
    this.setupViewEventHandlers();

    // Connect to server
    this.connectToServer();

    // Show initial view
    this.showView('menu');
  }

  private initializeManagers() {
    // Initialize network manager
    this.networkManager = new NetworkManager();

    // Create network indicator
    const { width } = this.cameras.main;
    this.networkIndicator = new NetworkIndicator(this, width - 50, 50);
  }

  private createViews() {
    // Create all view components
    this.menuView = new MenuView(this);
    this.joinView = new JoinView(this);
    this.waitingView = new WaitingView(this);

    // Load saved player name
    const savedName = storage.load<string>(this.PLAYER_NAME_KEY);
    if (savedName) {
      this.menuView.setPlayerName(savedName);
    }

    // Hide all views initially
    this.menuView.hide();
    this.joinView.hide();
    this.waitingView.hide();
  }

  private setupViewEventHandlers() {
    // Menu view events
    this.events.on('menuView:createRoom', this.handleCreateRoom, this);
    this.events.on('menuView:joinRoom', this.handleJoinRoomClick, this);
    this.events.on('menuView:backToMenu', this.handleBackToMainMenu, this);

    // Join view events
    this.events.on('joinView:join', this.handleJoinRoom, this);
    this.events.on('joinView:back', () => this.showView('menu'), this);

    // Waiting view events
    this.events.on('waitingView:ready', this.handleReady, this);
    this.events.on('waitingView:leave', this.handleLeaveRoom, this);
  }

  private setupNetworkListeners() {
    // Connection quality changes
    this.networkManager.on('connectionQualityChange', ({ quality }: any) => {
      if (this.networkIndicator) {
        this.networkIndicator.updateQuality(quality);
      }
    });

    // Room created/joined - receive seat and room code
    this.networkManager.on('seated', (data: any) => {
      this.roomCode = data.roomCode;
      this.waitingView.setRoomCode(this.roomCode);
    });

    // Player joined
    this.networkManager.on('playerJoined', () => {
      this.updatePlayersList();
    });

    // Player left
    this.networkManager.on('playerRemoved', () => {
      this.updatePlayersList();
    });

    // Player ready status changed
    this.networkManager.on('playerReady', () => {
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
      if (this.currentView === 'join') {
        this.joinView.showError('Error: ' + data.message);
      }
    });

    // Room left
    this.networkManager.on('roomLeft', () => {
      this.showView('menu');
    });
  }

  private showView(view: 'menu' | 'join' | 'waiting') {
    // Hide all views
    this.menuView.hide();
    this.joinView.hide();
    this.waitingView.hide();

    // Clear errors
    this.joinView.clearError();

    // Show requested view
    this.currentView = view;
    switch (view) {
      case 'menu':
        this.menuView.show();
        break;
      case 'join':
        this.joinView.show();
        break;
      case 'waiting':
        this.waitingView.show();
        this.updatePlayersList();
        break;
    }
  }

  private async connectToServer() {
    const connected = await this.networkManager.connect(SERVER.URL);
    if (connected) {
      this.menuView.setConnectionStatus('Connected', '#22c55e');
      this.networkIndicator.updateQuality('good');
      this.setupNetworkListeners();
    } else {
      this.menuView.setConnectionStatus(
        'Connection failed. Retry...',
        '#ef4444'
      );
      this.networkIndicator.updateQuality('offline');
      // Retry after 3 seconds
      this.time.delayedCall(3000, () => this.connectToServer());
    }
  }

  private handleJoinRoomClick() {
    const nameResult = validatePlayerName(this.menuView.getPlayerName());
    if (!nameResult.valid) {
      this.menuView.setConnectionStatus(nameResult.error!, '#ef4444');
      return;
    }
    this.showView('join');
  }

  private handleBackToMainMenu() {
    this.scene.start('MenuScene');
  }

  private async handleCreateRoom() {
    // Prevent duplicate requests
    if (this.isCreatingRoom) {
      return;
    }

    const nameResult = validatePlayerName(this.menuView.getPlayerName());

    // Validate name
    if (!nameResult.valid) {
      this.menuView.setConnectionStatus(nameResult.error!, '#ef4444');
      return;
    }

    if (!this.networkManager.isConnected()) {
      this.menuView.setConnectionStatus('Not connected to server', '#ef4444');
      return;
    }

    // Set processing state
    this.isCreatingRoom = true;
    this.menuView.setButtonsEnabled(false);
    this.menuView.setConnectionStatus('Creating room...', '#f59e0b');

    try {
      const room = await this.networkManager.createRoom(nameResult.value!);

      if (room) {
        this.playerName = nameResult.value!;
        storage.save(this.PLAYER_NAME_KEY, this.playerName);
        this.showView('waiting');
      } else {
        this.menuView.setConnectionStatus('Failed to create room', '#ef4444');
      }
    } finally {
      // Reset processing state
      this.isCreatingRoom = false;
      this.menuView.setButtonsEnabled(true);
    }
  }

  private async handleJoinRoom() {
    // Prevent duplicate requests
    if (this.isJoiningRoom) {
      return;
    }

    const nameResult = validatePlayerName(this.menuView.getPlayerName());
    const codeResult = validateRoomCode(this.joinView.getRoomCode());

    // Validate name
    if (!nameResult.valid) {
      this.joinView.showError(nameResult.error!);
      return;
    }

    // Validate room code
    if (!codeResult.valid) {
      this.joinView.showError(codeResult.error!);
      return;
    }

    if (!this.networkManager.isConnected()) {
      this.joinView.showError('Not connected to server');
      return;
    }

    // Set processing state
    this.isJoiningRoom = true;
    this.joinView.setButtonsEnabled(false);
    this.joinView.showError('Joining room...', '#f59e0b');

    try {
      const room = await this.networkManager.joinRoom(
        codeResult.value!,
        nameResult.value!
      );

      if (room) {
        this.playerName = nameResult.value!;
        storage.save(this.PLAYER_NAME_KEY, this.playerName);
        this.roomCode = codeResult.value!;
        this.showView('waiting');
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      const errorMsg = (error as Error).message || 'Room not found or full';
      this.joinView.showError(errorMsg);
    } finally {
      // Reset processing state
      this.isJoiningRoom = false;
      this.joinView.setButtonsEnabled(true);
    }
  }

  private handleReady() {
    // Prevent spam clicking
    if (this.isReadying) {
      return;
    }

    this.isReadying = true;
    this.networkManager.sendReady();
    // Update text to show action is pending
    this.waitingView.setWaitingMessage('Sending ready status...');

    // Reset after 2 seconds (server should respond before this)
    this.time.delayedCall(2000, () => {
      this.isReadying = false;
    });
  }

  private async handleLeaveRoom() {
    try {
      await this.networkManager.leaveRoom();
      // Reset input fields
      this.joinView.clearRoomCode();
      this.showView('menu');
    } catch (error) {
      console.error('Error leaving room:', error);
      this.showView('menu');
    }
  }

  private updatePlayersList() {
    const players = this.networkManager.getPlayers();
    const localId = this.networkManager.playerId || '';
    this.waitingView.updatePlayersList(players, localId);
  }

  private startGame() {
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

  shutdown() {
    // Remove event listeners
    this.events.off('menuView:createRoom', this.handleCreateRoom, this);
    this.events.off('menuView:joinRoom', this.handleJoinRoomClick, this);
    this.events.off('menuView:backToMenu', this.handleBackToMainMenu, this);
    this.events.off('joinView:join', this.handleJoinRoom, this);
    this.events.off('joinView:back');
    this.events.off('waitingView:ready', this.handleReady, this);
    this.events.off('waitingView:leave', this.handleLeaveRoom, this);

    // Clean up view components
    if (this.menuView) {
      this.menuView.destroy();
    }
    if (this.joinView) {
      this.joinView.destroy();
    }
    if (this.waitingView) {
      this.waitingView.destroy();
    }

    // Clean up network indicator
    if (this.networkIndicator) {
      this.networkIndicator.destroy();
    }
  }
}
