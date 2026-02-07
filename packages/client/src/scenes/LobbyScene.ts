import Phaser from 'phaser';
import { createActor } from 'xstate';
import { ANIMATION, SERVER } from '../utils/constants';
import NetworkManager from '../managers/NetworkManager';
import NetworkIndicator from '../components/NetworkIndicator';
import type { Quality } from '../components/NetworkIndicator';
import Common from '../objects/game/Common';
import { MenuView } from '../components/lobby/MenuView';
import { JoinView } from '../components/lobby/JoinView';
import { WaitingView } from '../components/lobby/WaitingView';
import { storage } from '../managers/StorageManager';
import PresenceManager from '../managers/PresenceManager';
import type { InviteData, OnlineUserData } from '../type';
import { validatePlayerName, validateRoomCode } from '../utils/validation';
import { lobbyMachine } from '../machines/lobbyMachine';
import type { LobbyEvent } from '../machines/lobbyMachine';

export default class LobbyScene extends Phaser.Scene {
  // Managers
  private networkManager!: NetworkManager;
  private networkIndicator!: NetworkIndicator;
  private presenceManager!: PresenceManager;

  // View components
  private menuView!: MenuView;
  private joinView!: JoinView;
  private waitingView!: WaitingView;

  // State machine
  private lobbyActor!: ReturnType<typeof createActor<typeof lobbyMachine>>;

  // Constants
  private readonly PLAYER_NAME_KEY = 'player_name';
  private pendingInviteJoin: InviteData | null = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data?: { invite?: InviteData }) {
    console.log('LobbyScene init with data:', data);
    if (data?.invite) {
      this.pendingInviteJoin = data.invite;
    }
  }

  create() {
    Common.createBackground(this);
    this.initializeManagers();
    this.createViews();
    this.lobbyActor = createActor(lobbyMachine);
    this.setupStateMachine();
    this.connectToServer();
    this.events.once('shutdown', this.shutdown, this);

    this.initializePresence().then(() => {
      if (this.pendingInviteJoin) {
        this.autoJoinInvite(this.pendingInviteJoin);
      }
    });
  }

  private initializeManagers() {
    // Initialize network manager
    this.networkManager = new NetworkManager();

    // Create network indicator
    const { width } = this.cameras.main;
    this.networkIndicator = new NetworkIndicator(this, width - 50, 50);

    this.presenceManager = PresenceManager.getInstance();
    this.presenceManager.setInviteHandlingEnabled(true);
  }

  private createViews() {
    // Load saved player name
    const savedName = storage.load<string>(this.PLAYER_NAME_KEY);

    // Create menu view with callbacks
    this.menuView = new MenuView(this, {
      onCreateRoom: () => this.handleCreateRoom(),
      onJoinRoom: () => this.handleJoinRoomClick(),
      onBackToMenu: () => this.send({ type: 'BACK_TO_MENU' }),
    });

    // Create join view with callbacks
    this.joinView = new JoinView(this, {
      onJoin: () => this.handleJoinRoom(),
      onBack: () => this.send({ type: 'SHOW_JOIN_VIEW' }),
    });

    // Create waiting view with callbacks
    this.waitingView = new WaitingView(this, {
      onReady: () => this.handleReady(),
      onLeave: () => this.handleLeaveRoom(),
      onInviteUser: (userId: string) => this.handleInviteUser(userId),
    });

    if (savedName) {
      this.menuView.setPlayerName(savedName);
    }

    // Hide all views initially
    this.menuView.hide();
    this.joinView.hide();
    this.waitingView.hide();
  }

  private setupStateMachine() {
    this.lobbyActor.subscribe((state) => {
      console.log('State:', state.value);
      this.updateUI(state.value as string, state.context);
    });

    this.lobbyActor.start();
    this.send({ type: 'CONNECT' });
  }

  private updateUI(
    state: string,
    context: { errorMessage: string; roomCode: string }
  ) {
    const views = { menu: false, join: false, waiting: false };

    switch (state) {
      case 'disconnected':
      case 'connecting':
      case 'menu':
        views.menu = true;
        if (context.errorMessage) {
          this.menuView.setConnectionStatus(context.errorMessage, '#ef4444');
        } else {
          // Clear any previous status messages when returning to menu
          this.menuView.setConnectionStatus('Connected', '#22c55e');
        }
        this.menuView.setButtonsEnabled(true);
        this.presenceManager.updateStatus(false);
        break;

      case 'joinView':
        views.join = true;
        if (context.errorMessage) {
          this.joinView.showError(context.errorMessage);
        } else {
          this.joinView.clearError();
        }
        this.joinView.setButtonsEnabled(true);
        this.presenceManager.updateStatus(false);
        break;

      case 'creatingRoom':
        views.menu = true;
        this.menuView.setButtonsEnabled(false);
        this.menuView.setConnectionStatus('Creating room...', '#f59e0b');
        this.presenceManager.updateStatus(false);
        break;

      case 'joiningRoom':
        views.join = true;
        this.joinView.setButtonsEnabled(false);
        this.joinView.showError('Joining room...', '#f59e0b');
        this.presenceManager.updateStatus(false);
        break;

      case 'waiting':
        views.waiting = true;
        this.waitingView.setRoomCode(context.roomCode);
        this.updatePlayersList();
        this.updateOnlineUsers();
        this.menuView.setButtonsEnabled(true);
        this.joinView.setButtonsEnabled(true);
        this.presenceManager.updateStatus(true);
        break;

      case 'readying':
        views.waiting = true;
        this.waitingView.setWaitingMessage('Sending ready status...');
        this.presenceManager.updateStatus(true);
        break;

      case 'transitioning':
        this.startGame();
        return;

      case 'exiting':
        this.scene.start('MenuScene');
        return;
    }

    // Update view visibility
    this.menuView.setVisible(views.menu);
    this.joinView.setVisible(views.join);
    this.waitingView.setVisible(views.waiting);
  }

  private send(event: LobbyEvent) {
    this.lobbyActor.send(event);
  }

  private setupNetworkListeners() {
    this.networkManager.on(
      'connectionQualityChange',
      ({ quality }: { quality: Quality }) => {
        this.networkIndicator?.updateQuality(quality);
      }
    );

    this.networkManager.on('seated', (data: { roomCode: string }) => {
      const state = this.lobbyActor.getSnapshot().value;
      if (state === 'creatingRoom') {
        this.send({ type: 'ROOM_CREATED', roomCode: data.roomCode });
      } else if (state === 'joiningRoom') {
        this.send({ type: 'ROOM_JOINED', roomCode: data.roomCode });
      }
    });

    this.networkManager.on('playerJoined', () => this.updatePlayersList());
    this.networkManager.on('playerRemoved', () => this.updatePlayersList());

    this.networkManager.on('playerReady', () => {
      this.updatePlayersList();
      if (this.lobbyActor.getSnapshot().value === 'readying') {
        this.send({ type: 'READY_SENT' });
      }
    });

    this.networkManager.on('phaseChange', (data: { phase: string }) => {
      if (data.phase === 'dealing' || data.phase === 'bidding') {
        this.send({ type: 'START_GAME' });
      }
    });

    this.networkManager.on('error', (data: { message: string }) => {
      const state = this.lobbyActor.getSnapshot().value;
      if (state === 'joiningRoom' || state === 'creatingRoom') {
        this.send({ type: 'ROOM_ERROR', error: data.message });
      }
    });

    this.networkManager.on('roomLeft', () => this.send({ type: 'ROOM_LEFT' }));
  }

  private initializePresence() {
    this.presenceManager.on('usersUpdated', (_users: OnlineUserData[]) => {
      if (this.lobbyActor.getSnapshot().value === 'waiting') {
        this.updateOnlineUsers();
      }
    });

    // Handle invite received - check if we're in a room before showing modal
    this.presenceManager.on('inviteReceived', (invite: InviteData) => {
      if (this.networkManager.isInRoom()) {
        this.presenceManager.respondToInvite(
          invite.inviteId,
          invite.inviterId,
          'declined'
        );
      }
      // If not in room, PresenceManager will show the modal automatically
    });

    this.presenceManager.on(
      'inviteResponse',
      (data: { response: string; inviteeName: string; inviteeId: string }) => {
        this.waitingView.removePendingInvitee(data.inviteeId);
        this.updateOnlineUsers();
        if (this.lobbyActor.getSnapshot().value === 'waiting') {
          this.waitingView.setWaitingMessage(
            `${data.inviteeName} ${data.response} the invite`
          );
        }
      }
    );

    // Initialize invite UI handling (auto-connects if player name is saved)
    return this.presenceManager.initializeInviteUI(
      this,
      (invite: InviteData) => {
        this.handleInviteAccepted(invite);
      }
    );
  }

  private async connectToServer() {
    const connected = await this.networkManager.connect(SERVER.URL);
    if (connected) {
      this.menuView.setConnectionStatus('Connected', '#22c55e');
      this.networkIndicator.updateQuality('good');
      this.setupNetworkListeners();
      this.send({ type: 'CONNECTION_SUCCESS' });
      if (this.pendingInviteJoin) {
        this.autoJoinInvite(this.pendingInviteJoin);
        this.pendingInviteJoin = null;
      }
    } else {
      this.menuView.setConnectionStatus(
        'Connection failed. Retry...',
        '#ef4444'
      );
      this.networkIndicator.updateQuality('offline');
      this.send({ type: 'CONNECTION_FAILED' });
      this.time.delayedCall(3000, () => {
        this.send({ type: 'CONNECT' });
        this.connectToServer();
      });
    }
  }

  private handleJoinRoomClick() {
    const nameResult = validatePlayerName(this.menuView.getPlayerName());
    if (!nameResult.valid) {
      this.menuView.setConnectionStatus(nameResult.error!, '#ef4444');
      return;
    }
    this.send({ type: 'JOIN_ROOM_CLICK', playerName: nameResult.value! });
  }

  private async handleCreateRoom() {
    if (this.lobbyActor.getSnapshot().value === 'creatingRoom') return;

    const nameResult = validatePlayerName(this.menuView.getPlayerName());
    if (!nameResult.valid) {
      this.menuView.setConnectionStatus(nameResult.error!, '#ef4444');
      return;
    }

    if (!this.networkManager.isConnected()) {
      this.menuView.setConnectionStatus('Not connected to server', '#ef4444');
      return;
    }

    this.send({ type: 'CREATE_ROOM', playerName: nameResult.value! });

    try {
      await this.presenceManager.ensureConnected(nameResult.value!);
      const room = await this.networkManager.createRoom(nameResult.value!);
      if (room) {
        storage.save(this.PLAYER_NAME_KEY, nameResult.value!);
        // Room code will be sent via 'seated' event from server
      } else {
        this.send({ type: 'ROOM_ERROR', error: 'Failed to create room' });
      }
    } catch (error) {
      const errorMsg = (error as Error).message || 'Failed to create room';
      this.send({ type: 'ROOM_ERROR', error: errorMsg });
    }
  }

  private async handleJoinRoom() {
    if (this.lobbyActor.getSnapshot().value === 'joiningRoom') return;

    const nameResult = validatePlayerName(this.menuView.getPlayerName());
    const codeResult = validateRoomCode(this.joinView.getRoomCode());

    if (!nameResult.valid) {
      this.joinView.showError(nameResult.error!);
      return;
    }

    if (!codeResult.valid) {
      this.joinView.showError(codeResult.error!);
      return;
    }

    if (!this.networkManager.isConnected()) {
      this.joinView.showError('Not connected to server');
      return;
    }

    this.send({
      type: 'JOIN_ROOM',
      playerName: nameResult.value!,
      roomCode: codeResult.value!,
    });

    storage.save(this.PLAYER_NAME_KEY, nameResult.value!);
    await this.presenceManager.ensureConnected(nameResult.value!);

    try {
      await this.networkManager.joinRoom(codeResult.value!, nameResult.value!);
    } catch (error) {
      const errorMsg =
        'Error: ' + (error as Error).message || 'Room not found or full';
      console.log('Join room error:', errorMsg);
      this.send({ type: 'ROOM_ERROR', error: errorMsg });
    }
  }

  private handleReady() {
    if (this.lobbyActor.getSnapshot().value === 'readying') return;

    this.send({ type: 'READY' });
    this.networkManager.sendReady();

    this.time.delayedCall(2000, () => {
      if (this.lobbyActor.getSnapshot().value === 'readying') {
        this.send({ type: 'READY_SENT' });
      }
    });
  }

  private async handleLeaveRoom() {
    this.send({ type: 'LEAVE_ROOM' });

    try {
      await this.networkManager.leaveRoom();
      this.joinView.clearRoomCode();
      this.waitingView.clearPendingInvitees();
    } catch (error) {
      console.error('Error leaving room:', error);
    } finally {
      this.presenceManager.updateStatus(false);
      this.send({ type: 'ROOM_LEFT' });
    }
  }

  private updatePlayersList() {
    const players = this.networkManager.getPlayers();
    const localId = this.networkManager.playerId || '';
    this.waitingView.updatePlayersList(players, localId);
    if (this.lobbyActor.getSnapshot().value === 'waiting') {
      this.updateOnlineUsers();
    }
  }

  private updateOnlineUsers() {
    const localPresenceId = this.presenceManager.getSessionId() || '';
    const isHost = this.isLocalHost();
    const onlineUsers = this.presenceManager.getOnlineUsers();
    this.waitingView.updateOnlineUsers(onlineUsers, localPresenceId, isHost);
  }

  private isLocalHost(): boolean {
    const players = this.networkManager.getPlayers();
    const localPlayer = players.find((player) => player.isLocal);
    return !!localPlayer && localPlayer.seatIndex === 0;
  }

  private handleInviteUser(userId: string) {
    if (!this.isLocalHost()) return;
    const roomCode = this.networkManager.getRoomCode();
    if (!roomCode) return;
    this.presenceManager.sendInvite(userId, roomCode);
    this.waitingView.addPendingInvitee(userId);
    this.updateOnlineUsers();
    this.waitingView.setWaitingMessage('Invite sent...');
  }

  /**
   * Handle when user accepts an invite
   */
  private handleInviteAccepted(invite: InviteData): void {
    const storedName = storage.load<string>(this.PLAYER_NAME_KEY) || '';
    const nameToUse = this.menuView.getPlayerName() || storedName;

    const nameResult = validatePlayerName(nameToUse);
    if (!nameResult.valid) {
      this.menuView.setConnectionStatus(nameResult.error!, '#ef4444');
      return;
    }

    this.menuView.setPlayerName(nameResult.value!);
    this.joinView.setRoomCode(invite.roomCode);
    this.send({ type: 'JOIN_ROOM_CLICK', playerName: nameResult.value! });
    this.joinByCode(invite.roomCode, nameResult.value!, invite.inviterName);
  }

  private autoJoinInvite(invite: InviteData) {
    console.log('Auto-joining invite:', invite);
    if (!this.networkManager.isConnected()) {
      console.log('Not connected yet, will join invite once connected');
      this.pendingInviteJoin = invite;
      this.menuView.setConnectionStatus(
        'Connecting to server to join invite...',
        '#f59e0b'
      );
      return;
    }

    // Auto-accept without showing modal (already accepted in MenuScene)
    this.handleInviteAccepted(invite);
    this.pendingInviteJoin = null;
  }

  private async joinByCode(
    roomCode: string,
    playerName: string,
    inviterName?: string
  ) {
    if (!this.networkManager.isConnected()) {
      this.joinView.showError('Not connected to server');
      return;
    }

    this.send({
      type: 'JOIN_ROOM',
      playerName,
      roomCode,
      isInvite: !!inviterName,
    });
    storage.save(this.PLAYER_NAME_KEY, playerName);
    await this.presenceManager.ensureConnected(playerName);

    try {
      if (inviterName) {
        this.joinView.showError(`Joining ${inviterName}'s room...`, '#f59e0b');
      }
      await this.networkManager.joinRoom(roomCode, playerName);
    } catch (error) {
      const errorMsg =
        'Error: ' + (error as Error).message || 'Room not found or full';
      console.log('Join room error:', errorMsg);
      this.send({ type: 'ROOM_ERROR', error: errorMsg });
    }
  }

  private startGame() {
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
    this.presenceManager.cleanupInviteUI();
    this.lobbyActor.stop();
    this.menuView?.destroy();
    this.joinView?.destroy();
    this.waitingView?.destroy();
    this.networkIndicator?.destroy();
  }
}
