import { Room, type Client } from 'colyseus';
import { OnlineUser, PresenceState } from './PresenceState.js';
import type { InviteResponseStatus } from '@call-break/shared';

interface PresenceJoinOptions {
  userId?: string;
  name?: string;
}

interface StatusPayload {
  inGame?: boolean;
}

interface InvitePayload {
  targetId?: string;
  roomCode?: string;
  inviteId?: string;
}

interface InviteResponsePayload {
  inviteId?: string;
  inviterId?: string;
  response?: InviteResponseStatus;
}

export class PresenceRoom extends Room<{
  state: PresenceState;
  client: Client;
}> {
  maxClients = 100;
  state = new PresenceState();

  onCreate(): void {
    this.onMessage('setStatus', (client: Client, data: StatusPayload) => {
      const userId = client.auth?.userId;
      if (!userId) return;
      const user = this.state.users.get(userId);
      if (!user) return;
      if (typeof data?.inGame === 'boolean') {
        user.inGame = data.inGame;
      }
    });

    this.onMessage('invite', (client, data: InvitePayload) => {
      const inviterId = client.auth?.userId;
      if (!inviterId) return;
      const inviter = this.state.users.get(inviterId);
      if (!inviter) return;
      if (!data?.targetId || !data?.roomCode) return;

      const inviteId = data.inviteId || `${inviterId}_${Date.now()}`;

      // Find any client session for the target user
      const targetClient = this.clients.find(
        (c) => c.auth?.userId === data.targetId
      );
      if (!targetClient) return;

      targetClient.send('invite', {
        inviteId,
        roomCode: data.roomCode,
        inviterId: inviterId,
        inviterName: inviter.name,
      });
    });

    this.onMessage('inviteResponse', (client, data: InviteResponsePayload) => {
      if (!data?.inviterId || !data?.inviteId || !data?.response) return;

      const inviteeId = client.auth?.userId;
      if (!inviteeId) return;

      // Find any client session for the inviter
      const inviterClient = this.clients.find(
        (c) => c.auth?.userId === data.inviterId
      );
      if (!inviterClient) return;

      const invitee = this.state.users.get(inviteeId);
      inviterClient.send('inviteResponse', {
        inviteId: data.inviteId,
        response: data.response,
        inviteeId: inviteeId,
        inviteeName: invitee?.name || 'Unknown',
      });
    });
  }

  onJoin(client: Client, options: PresenceJoinOptions): void {
    const userId = (options.userId || '').trim();
    const baseName = (options.name || '').trim();

    if (!userId) {
      throw new Error('User ID required for presence');
    }

    if (!baseName) {
      throw new Error('Player name required for presence');
    }

    // Store userId in client auth for easy access in message handlers
    client.auth = { userId };

    // Check if user already exists (reconnection or duplicate session)
    const existingUser = this.state.users.get(userId);
    if (existingUser) {
      // User already connected from another session - just update
      console.log(`User ${baseName} (${userId}) connected from new session`);
      existingUser.name = baseName; // Update name in case it changed
      return;
    }

    // New user - create entry
    const user = new OnlineUser();
    user.id = userId;
    user.name = baseName;
    user.inGame = false;

    this.state.users.set(userId, user);
    console.log(`New user joined presence: ${baseName} (${userId})`);
  }

  onLeave(client: Client): void {
    const userId = client.auth?.userId;
    if (!userId) return;

    // Check if user has other active sessions
    const hasOtherSessions = this.clients.some(
      (c) => c.sessionId !== client.sessionId && c.auth?.userId === userId
    );

    if (!hasOtherSessions) {
      // No other sessions - remove user from presence
      this.state.users.delete(userId);
      console.log(`User ${userId} fully disconnected from presence`);
    } else {
      console.log(`User ${userId} still connected from other session`);
    }
  }
}
