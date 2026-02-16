import Phaser from 'phaser';
import { createActor } from 'xstate';
import { ANIMATION } from '../utils/constants';
import NetworkIndicator from '../components/shared/NetworkIndicator';
import type { Quality } from '../components/shared/NetworkIndicator';
import { createBackground } from '../helpers/ui/background';
import { MenuView } from '../components/lobby/MenuView';
import { JoinView } from '../components/lobby/JoinView';
import { WaitingView } from '../components/lobby/WaitingView';
import { userIdentity } from '../managers/UserIdentityManager';
import PresenceManager from '../managers/PresenceManager';
import type { InviteData, OnlineUserData } from '../type';
import { validatePlayerName, validateRoomCode } from '../utils/validation';
import { lobbyMachine } from '../machines/lobbyMachine';
import type { LobbyEvent } from '../machines/lobbyMachine';
import { ServiceLocator } from '../core/ServiceLocator';
import type { NetworkService } from '../services/NetworkService';
import type { EventBus, ScopedEventBus } from '../services/EventBus';

export default class LobbyScene extends Phaser.Scene {
  // Services
  private networkService!: NetworkService;
  private scopedEvents!: ScopedEventBus;
  private networkIndicator!: NetworkIndicator;
  private presenceManager!: PresenceManager;

  // View components
  private menuView!: MenuView;
  private joinView!: JoinView;
  private waitingView!: WaitingView;

  // State machine
  private lobbyActor!: ReturnType<typeof createActor<typeof lobbyMachine>>;

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
    createBackground(this);
    this.initializeManagers();
    this.createViews();
    this.lobbyActor = createActor(lobbyMachine);
    this.setupStateMachine();
    this.events.once('shutdown', this.shutdown, this);

    this.connectToServer().then(() => {
      this.initializePresence().then(() => {
        if (this.pendingInviteJoin) {
          this.autoJoinInvite(this.pendingInviteJoin);
        }
      });
    });
  }

  private initializeManagers() {
    // Get services from ServiceLocator
    this.networkService = ServiceLocator.get<NetworkService>('network');
    const eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.scopedEvents = eventBus.subscribeTo(this); // Auto-cleanup on shutdown

    // Create network indicator
    const { width } = this.cameras.main;
    this.networkIndicator = new NetworkIndicator(this, width - 50, 50);

    this.presenceManager = PresenceManager.getInstance();
    this.presenceManager.setInviteHandlingEnabled(true);
  }

  private createViews() {
    // Load user identity (auto-migrates from legacy storage if needed)
    const identity = userIdentity.getOrCreateIdentity();

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

    if (identity?.name) {
      this.menuView.setPlayerName(identity.name);
    }

    // Hide all views initially
    this.menuView.hide();
    this.joinView.hide();
    this.waitingView.setVisible(false);
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
    // All listeners auto-cleaned on scene shutdown via ScopedEventBus
    this.scopedEvents.onNetworkEvent(
      'connectionQualityChange',
      ({ quality }) => {
        this.networkIndicator?.updateQuality(quality as Quality);
      }
    );

    this.scopedEvents.onLobbyEvent('seated', ({ roomCode }) => {
      const state = this.lobbyActor.getSnapshot().value;
      if (state === 'creatingRoom') {
        this.send({ type: 'ROOM_CREATED', roomCode });
      } else if (state === 'joiningRoom') {
        this.send({ type: 'ROOM_JOINED', roomCode });
      }
    });

    this.scopedEvents.onLobbyEvent('playerJoined', () => {
      this.updatePlayersList();
    });

    this.scopedEvents.onLobbyEvent('playerRemoved', () => {
      this.updatePlayersList();
    });

    this.scopedEvents.onLobbyEvent('playerReady', () => {
      this.updatePlayersList();
      if (this.lobbyActor.getSnapshot().value === 'readying') {
        this.send({ type: 'READY_SENT' });
      }
    });

    this.scopedEvents.onGameEvent('phaseChanged', ({ phase }) => {
      if (phase === 'dealing' || phase === 'bidding') {
        this.send({ type: 'START_GAME' });
      }
    });

    this.scopedEvents.onNetworkEvent('error', ({ message }) => {
      const state = this.lobbyActor.getSnapshot().value;
      if (state === 'joiningRoom' || state === 'creatingRoom') {
        this.send({ type: 'ROOM_ERROR', error: message });
      }
    });
  }

  private initializePresence() {
    this.presenceManager.on('usersUpdated', (_users: OnlineUserData[]) => {
      if (this.lobbyActor.getSnapshot().value === 'waiting') {
        this.updateOnlineUsers();
      }
    });

    // Handle invite received - check if we're in a room before showing modal
    this.presenceManager.on('inviteReceived', (invite: InviteData) => {
      if (this.networkService.getRoom() !== null) {
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
    // NetworkService is already connected at bootstrap
    // const connected = this.networkService.isConnected();

    this.menuView.setConnectionStatus('Connected', '#22c55e');
    this.networkIndicator.updateQuality(
      this.networkService.getConnectionQuality()
    );
    this.setupNetworkListeners();
    this.send({ type: 'CONNECTION_SUCCESS' });

    if (this.pendingInviteJoin) {
      this.autoJoinInvite(this.pendingInviteJoin);
      this.pendingInviteJoin = null;
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

    // if (!this.networkService.isConnected()) {
    //   this.menuView.setConnectionStatus('Not connected to server', '#ef4444');
    //   return;
    // }

    this.send({ type: 'CREATE_ROOM', playerName: nameResult.value! });

    try {
      await this.presenceManager.ensureConnected(nameResult.value!);
      const identity = userIdentity.updateName(nameResult.value!);
      const room = await this.networkService.createRoom(
        'call_break',
        identity.userId,
        nameResult.value!
      );
      if (!room) {
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

    // if (!this.networkService.isConnected()) {
    //   this.joinView.showError('Not connected to server');
    //   return;
    // }

    this.send({
      type: 'JOIN_ROOM',
      playerName: nameResult.value!,
      roomCode: codeResult.value!,
    });

    const identity = userIdentity.updateName(nameResult.value!);
    await this.presenceManager.ensureConnected(nameResult.value!);

    try {
      await this.networkService.joinRoom(
        'call_break',
        codeResult.value!,
        identity.userId,
        nameResult.value!
      );
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
    this.networkService.send('ready');

    this.time.delayedCall(2000, () => {
      if (this.lobbyActor.getSnapshot().value === 'readying') {
        this.send({ type: 'READY_SENT' });
      }
    });
  }

  private handleLeaveRoom() {
    this.send({ type: 'LEAVE_ROOM' });

    try {
      this.joinView.clearRoomCode();
      this.waitingView.clearPendingInvitees();
      this.networkService.disconnect();
    } catch (error) {
      console.error('Error leaving room:', error);
    } finally {
      this.presenceManager.updateStatus(false);
      this.send({ type: 'ROOM_LEFT' });
    }
  }

  private updatePlayersList() {
    const players = this.getPlayers();
    const localId = this.getPlayerId();
    this.waitingView.updatePlayersList(players, localId);
    if (this.lobbyActor.getSnapshot().value === 'waiting') {
      this.updateOnlineUsers();
    }
  }

  private updateOnlineUsers() {
    const identity = userIdentity.getIdentity();
    const localUserId = identity?.userId || '';
    const isHost = this.isLocalHost();
    const onlineUsers = this.presenceManager.getOnlineUsers();
    this.waitingView.updateOnlineUsers(onlineUsers, localUserId, isHost);
  }

  private isLocalHost(): boolean {
    const players = this.getPlayers();
    const localPlayer = players.find((player) => player.isLocal);
    return !!localPlayer && localPlayer.seatIndex === 0;
  }

  private getPlayers() {
    const room = this.networkService.getRoom();
    if (!room?.state?.players) return [];

    const players: any[] = [];
    const playerId = room.sessionId;

    room.state.players.forEach((player: any) => {
      players.push({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        seatIndex: player.seatIndex,
        isLocal: player.id === playerId,
        bid: player.bid,
        tricksWon: player.tricksWon,
        score: player.score,
        roundScore: player.roundScore,
        isBot: player.isBot,
        isReady: player.isReady,
        isConnected: player.isConnected,
      });
    });

    return players.sort((a, b) => a.seatIndex - b.seatIndex);
  }

  private getPlayerId(): string {
    return this.networkService.getRoom()?.sessionId || '';
  }

  private getRoomCode(): string | null {
    return this.networkService.getRoom()?.state?.roomCode || null;
  }

  private handleInviteUser(userId: string) {
    if (!this.isLocalHost()) return;
    const roomCode = this.getRoomCode();
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
    const identity = userIdentity.getIdentity();
    const nameToUse = this.menuView.getPlayerName() || identity?.name || '';
    const nameResult = validatePlayerName(nameToUse);
    if (!nameResult.valid) {
      this.menuView.setConnectionStatus(nameResult.error!, '#ef4444');
      return;
    }

    this.menuView.setPlayerName(nameResult.value!);
    this.joinView.setRoomCode(invite.roomCode);
    // Don't send JOIN_ROOM_CLICK for invites - joinByCode handles the state transition
    this.joinByCode(invite.roomCode, nameResult.value!, invite.inviterName);
  }

  private autoJoinInvite(invite: InviteData) {
    // if (!this.networkService.isConnected()) {
    //   console.log('Not connected yet, will join invite once connected');
    //   this.pendingInviteJoin = invite;
    //   this.menuView.setConnectionStatus(
    //     'Connecting to server to join invite...',
    //     '#f59e0b'
    //   );
    //   return;
    // }

    // Ensure we're in the menu state before proceeding
    const currentState = this.lobbyActor.getSnapshot().value;
    if (currentState !== 'menu') {
      console.log(`Waiting for menu state, currently in: ${currentState}`);
      // Wait for the state machine to reach menu state
      const unsubscribe = this.lobbyActor.subscribe((state) => {
        if (state.value === 'menu') {
          unsubscribe.unsubscribe();
          console.log('Now in menu state, proceeding with auto-join');
          this.handleInviteAccepted(invite);
          this.pendingInviteJoin = null;
        }
      });
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
    // if (!this.networkService.isConnected()) {
    //   this.joinView.showError('Not connected to server');
    //   return;
    // }

    this.send({
      type: 'JOIN_ROOM',
      playerName,
      roomCode,
      isInvite: !!inviterName,
    });

    const identity = userIdentity.updateName(playerName);
    await this.presenceManager.ensureConnected(playerName);

    try {
      if (inviterName) {
        this.joinView.showError(`Joining ${inviterName}'s room...`, '#f59e0b');
      }
      await this.networkService.joinRoom(
        'call_break',
        roomCode,
        identity.userId,
        playerName
      );
    } catch (error) {
      const errorMsg =
        'Error: ' + (error as Error).message || 'Room not found or full';
      console.log('Join room error:', errorMsg);
      this.send({ type: 'ROOM_ERROR', error: errorMsg });
    }
  }

  private startGame() {
    // Transition to GameScene (no networkManager needed - uses ServiceLocator)
    this.cameras.main.fadeOut(ANIMATION.SCENE_TRANSITION);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        isMultiplayer: true,
      });
    });
    // Note: ScopedEventBus listeners auto-cleaned on shutdown
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
