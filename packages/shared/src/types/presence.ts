export interface OnlineUserData {
  id: string;
  name: string;
  inGame: boolean;
}

export interface OnlineUserSchema {
  id: string;
  name: string;
  inGame: boolean;
  listen: (property: string, callback: (value: unknown) => void) => void;
}

export interface IPresenceState {
  users: Map<string, OnlineUserSchema>;
}

export interface InviteData {
  inviteId: string;
  roomCode: string;
  inviterId: string;
  inviterName: string;
}

export type InviteResponseStatus =
  | 'accepted'
  | 'declined'
  | 'timeout'
  | 'in_game';
