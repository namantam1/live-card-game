import { Client, Room, getStateCallbacks } from '@colyseus/sdk';
import type { InviteData, InviteResponseStatus, OnlineUserData } from '../type';
import { InviteModal } from '../components/InviteModal';
import { storage } from './StorageManager';
import { SERVER } from '../utils/constants';
import type Phaser from 'phaser';

type EventCallback = (data?: any) => void;
type InviteAcceptCallback = (invite: InviteData) => void;

const PLAYER_NAME_KEY = 'player_name';

export default class PresenceManager {
  private static instance: PresenceManager | null = null;
  private client: Client | null = null;
  private room: Room | null = null;
  private connected = false;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private onlineUsers: Map<string, OnlineUserData> = new Map();
  private inviteHandlingEnabled = true;

  // Invite UI handling
  private inviteScene: Phaser.Scene | null = null;
  private inviteModal: InviteModal | null = null;
  private inviteAcceptCallback: InviteAcceptCallback | null = null;
  private activeInvite: InviteData | null = null;

  static getInstance(): PresenceManager {
    if (!PresenceManager.instance) {
      PresenceManager.instance = new PresenceManager();
    }
    return PresenceManager.instance;
  }

  private async connect(
    serverUrl: string,
    playerName: string
  ): Promise<boolean> {
    if (this.connected || this.room) {
      return true;
    }

    try {
      this.client = new Client(serverUrl);
      this.room = await this.client.joinOrCreate('presence', {
        name: playerName,
      });
      this.connected = true;
      this.setupRoomListeners();
      return true;
    } catch (error) {
      console.error('PresenceManager: Failed to connect', error);
      this.connected = false;
      this.room = null;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected && !!this.room;
  }

  /**
   * Ensure presence connection is established
   * Reads player name from storage and uses default server URL
   * @param playerName - Optional player name (if not provided, reads from storage)
   * @returns Promise<boolean> indicating success
   */
  async ensureConnected(playerName?: string): Promise<boolean> {
    const name = playerName || storage.load<string>(PLAYER_NAME_KEY);
    if (!name) {
      console.warn('PresenceManager: No player name available for connection');
      return false;
    }
    return this.connect(SERVER.URL, name);
  }

  setInviteHandlingEnabled(enabled: boolean) {
    this.inviteHandlingEnabled = enabled;
    return this;
  }

  updateStatus(inGame: boolean): void {
    if (!this.room) return;
    this.room.send('setStatus', { inGame });
  }

  sendInvite(targetId: string, roomCode: string): void {
    if (!this.room) return;
    const inviteId = `${this.room.sessionId}_${Date.now()}`;
    this.room.send('invite', { targetId, roomCode, inviteId });
  }

  respondToInvite(
    inviteId: string,
    inviterId: string,
    response: InviteResponseStatus
  ): void {
    if (!this.room) return;
    this.room.send('inviteResponse', { inviteId, inviterId, response });
  }

  getOnlineUsers(): OnlineUserData[] {
    return Array.from(this.onlineUsers.values());
  }

  getSessionId(): string | null {
    return this.room?.sessionId || null;
  }

  /**
   * Initialize invite UI handling for a scene
   * Automatically connects using saved player name if available
   * @param scene - The Phaser scene to show invite modals in
   * @param onAccept - Callback when user accepts an invite
   */
  async initializeInviteUI(
    scene: Phaser.Scene,
    onAccept: InviteAcceptCallback
  ): Promise<void> {
    // Clean up previous modal if it exists and is from a different scene
    if (this.inviteModal && this.inviteScene !== scene) {
      this.cleanupInviteUI();
    }

    this.inviteScene = scene;
    this.inviteAcceptCallback = onAccept;

    // Create new modal instance for this scene
    if (!this.inviteModal) {
      this.inviteModal = new InviteModal(scene);
    }

    // Auto-connect if not already connected and player name exists
    if (!this.connected) {
      await this.ensureConnected();
    }
  }

  /**
   * Clean up invite UI handling (call in scene shutdown)
   */
  cleanupInviteUI(): void {
    if (this.inviteModal) {
      this.inviteModal.destroy();
      this.inviteModal = null;
    }
    this.inviteScene = null;
    this.inviteAcceptCallback = null;
    this.activeInvite = null;
  }

  /**
   * Show invite modal to user
   */
  private showInviteModal(invite: InviteData): void {
    if (!this.inviteScene || !this.inviteModal) {
      console.warn(
        'PresenceManager: Cannot show invite - modal not initialized'
      );
      return;
    }

    this.activeInvite = invite;
    this.inviteModal.show({
      inviterName: invite.inviterName,
      roomCode: invite.roomCode,
      timeoutSeconds: 30,
      callbacks: {
        onAccept: () => this.handleInviteAccept(),
        onDecline: () => this.handleInviteDecline('declined'),
        onTimeout: () => this.handleInviteDecline('timeout'),
      },
    });
  }

  /**
   * Handle invite acceptance
   */
  private handleInviteAccept(): void {
    if (!this.activeInvite || !this.inviteAcceptCallback) return;

    const invite = this.activeInvite;
    this.activeInvite = null;

    // Send response to server
    this.respondToInvite(invite.inviteId, invite.inviterId, 'accepted');

    // Let scene handle the acceptance logic
    this.inviteAcceptCallback(invite);
  }

  /**
   * Handle invite decline or timeout
   */
  private handleInviteDecline(reason: 'declined' | 'timeout'): void {
    if (!this.activeInvite) return;

    this.respondToInvite(
      this.activeInvite.inviteId,
      this.activeInvite.inviterId,
      reason
    );
    this.activeInvite = null;
  }

  private setupRoomListeners(): void {
    if (!this.room) return;
    const $ = getStateCallbacks(this.room);

    $(this.room.state).users.onAdd((user: any, sessionId: string) => {
      this.onlineUsers.set(sessionId, {
        id: sessionId,
        name: user.name,
        inGame: user.inGame,
      });
      this.emit('usersUpdated', this.getOnlineUsers());

      $(user).listen('name', (value: string) => {
        const existing = this.onlineUsers.get(sessionId);
        if (!existing) return;
        existing.name = value;
        this.emit('usersUpdated', this.getOnlineUsers());
      });

      $(user).listen('inGame', (value: boolean) => {
        const existing = this.onlineUsers.get(sessionId);
        if (!existing) return;
        existing.inGame = value;
        this.emit('usersUpdated', this.getOnlineUsers());
      });
    });

    $(this.room.state).users.onRemove((_user: any, sessionId: string) => {
      this.onlineUsers.delete(sessionId);
      this.emit('usersUpdated', this.getOnlineUsers());
    });

    this.room.onMessage('invite', (data: InviteData) => {
      if (!this.inviteHandlingEnabled) {
        this.respondToInvite(data.inviteId, data.inviterId, 'in_game');
        return;
      }

      // Show modal directly if scene is registered
      if (this.inviteScene && this.inviteAcceptCallback) {
        this.showInviteModal(data);
      } else {
        // Fallback: emit event for manual handling
        this.emit('inviteReceived', data);
      }
    });

    this.room.onMessage(
      'inviteResponse',
      (data: {
        inviteId: string;
        response: InviteResponseStatus;
        inviteeId: string;
        inviteeName: string;
      }) => {
        this.emit('inviteResponse', data);
      }
    );

    this.room.onLeave(() => {
      this.connected = false;
      this.room = null;
      this.onlineUsers.clear();
      this.emit('usersUpdated', []);
    });
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  private emit(event: string, data?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback: EventCallback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`PresenceManager: Error in ${event} listener`, error);
        }
      });
    }
  }
}
