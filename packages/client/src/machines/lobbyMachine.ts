import { createMachine, assign } from 'xstate';

export type LobbyContext = {
  playerName: string;
  roomCode: string;
  errorMessage: string;
  connectionStatus: string;
};

export type LobbyEvent =
  | { type: 'CONNECT' }
  | { type: 'CONNECTION_SUCCESS' }
  | { type: 'CONNECTION_FAILED' }
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'JOIN_ROOM_CLICK'; playerName: string }
  | { type: 'JOIN_ROOM'; playerName: string; roomCode: string }
  | { type: 'ROOM_CREATED'; roomCode: string }
  | { type: 'ROOM_JOINED'; roomCode: string }
  | { type: 'ROOM_ERROR'; error: string }
  | { type: 'READY' }
  | { type: 'READY_SENT' }
  | { type: 'LEAVE_ROOM' }
  | { type: 'ROOM_LEFT' }
  | { type: 'START_GAME' }
  | { type: 'BACK_TO_MENU' }
  | { type: 'SHOW_JOIN_VIEW' };

export const lobbyMachine = createMachine({
  id: 'lobby',
  initial: 'disconnected',
  types: {} as {
    context: LobbyContext;
    events: LobbyEvent;
  },
  context: {
    playerName: '',
    roomCode: '',
    errorMessage: '',
    connectionStatus: 'Disconnected',
  },
  states: {
    disconnected: {
      on: {
        CONNECT: 'connecting',
      },
    },
    connecting: {
      on: {
        CONNECTION_SUCCESS: {
          target: 'menu',
          actions: assign({
            connectionStatus: 'Connected',
          }),
        },
        CONNECTION_FAILED: {
          target: 'disconnected',
          actions: assign({
            connectionStatus: 'Connection failed. Retry...',
          }),
        },
      },
    },
    menu: {
      on: {
        CREATE_ROOM: {
          target: 'creatingRoom',
          actions: assign({
            playerName: ({ event }) => event.playerName,
            errorMessage: '',
          }),
        },
        JOIN_ROOM_CLICK: {
          target: 'joinView',
          actions: assign({
            playerName: ({ event }) => event.playerName,
            errorMessage: '',
          }),
        },
        BACK_TO_MENU: 'exiting',
      },
    },
    joinView: {
      on: {
        JOIN_ROOM: {
          target: 'joiningRoom',
          actions: assign({
            playerName: ({ event }) => event.playerName,
            roomCode: ({ event }) => event.roomCode,
            errorMessage: '',
          }),
        },
        SHOW_JOIN_VIEW: 'menu',
      },
    },
    creatingRoom: {
      on: {
        ROOM_CREATED: {
          target: 'waiting',
          actions: assign({
            roomCode: ({ event }) => event.roomCode,
          }),
        },
        ROOM_ERROR: {
          target: 'menu',
          actions: assign({
            errorMessage: ({ event }) => event.error,
          }),
        },
      },
    },
    joiningRoom: {
      on: {
        ROOM_JOINED: {
          target: 'waiting',
          actions: assign({
            roomCode: ({ event }) => event.roomCode,
          }),
        },
        ROOM_ERROR: {
          target: 'joinView',
          actions: assign({
            errorMessage: ({ event }) => event.error,
          }),
        },
      },
    },
    waiting: {
      on: {
        READY: 'readying',
        LEAVE_ROOM: 'leavingRoom',
        START_GAME: 'transitioning',
      },
    },
    readying: {
      on: {
        READY_SENT: 'waiting',
      },
    },
    leavingRoom: {
      on: {
        ROOM_LEFT: 'menu',
      },
    },
    transitioning: {
      type: 'final',
    },
    exiting: {
      type: 'final',
    },
  },
});
