import { Room, type Client } from 'colyseus';
import { OnlineUser, PresenceState } from './PresenceState.js';
import type { InviteResponseStatus } from '@call-break/shared';

interface PresenceJoinOptions {
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

export class PresenceRoom extends Room {
  maxClients = 100;
  state = new PresenceState();

  onCreate(): void {
    this.onMessage('setStatus', (client, data: StatusPayload) => {
      const user = this.state.users.get(client.sessionId);
      if (!user) return;
      if (typeof data?.inGame === 'boolean') {
        user.inGame = data.inGame;
      }
    });

    this.onMessage('invite', (client, data: InvitePayload) => {
      const inviter = this.state.users.get(client.sessionId);
      if (!inviter) return;
      if (!data?.targetId || !data?.roomCode) return;

      const inviteId = data.inviteId || `${client.sessionId}_${Date.now()}`;

      const targetClient = this.clients.find(
        (c) => c.sessionId === data.targetId
      );
      if (!targetClient) return;

      targetClient.send('invite', {
        inviteId,
        roomCode: data.roomCode,
        inviterId: client.sessionId,
        inviterName: inviter.name,
      });
    });

    this.onMessage('inviteResponse', (client, data: InviteResponsePayload) => {
      if (!data?.inviterId || !data?.inviteId || !data?.response) return;

      const inviterClient = this.clients.find(
        (c) => c.sessionId === data.inviterId
      );
      if (!inviterClient) return;

      const invitee = this.state.users.get(client.sessionId);
      inviterClient.send('inviteResponse', {
        inviteId: data.inviteId,
        response: data.response,
        inviteeId: client.sessionId,
        inviteeName: invitee?.name || 'Unknown',
      });
    });
  }

  onJoin(client: Client, options: PresenceJoinOptions): void {
    const baseName = (options.name || '').trim();
    if (!baseName) {
      throw new Error('Player name required for presence');
    }

    const displayName = this.getUniqueName(baseName);

    const user = new OnlineUser();
    user.id = client.sessionId;
    user.name = displayName;
    user.inGame = false;

    this.state.users.set(client.sessionId, user);
  }

  onLeave(client: Client): void {
    this.state.users.delete(client.sessionId);
  }

  private getUniqueName(baseName: string): string {
    const existingNames = new Set(
      Array.from(this.state.users.values()).map((u) => u.name)
    );
    if (!existingNames.has(baseName)) return baseName;

    let counter = 2;
    while (existingNames.has(`${baseName} ${counter}`)) {
      counter += 1;
    }
    return `${baseName} ${counter}`;
  }
}
