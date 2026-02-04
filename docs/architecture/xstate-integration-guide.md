# XState Integration Guide

## Overview

This document details the XState state machine implementation in the LobbyScene and provides a blueprint for adopting it in other scenes.

## What is XState?

XState is a JavaScript state management library that implements statecharts - a formalization of finite state machines. It provides:

- **Explicit state modeling**: All possible states are declared upfront
- **Impossible states prevention**: Can't be in two states simultaneously
- **Built-in transitions**: Declarative state changes with guards and actions
- **Type safety**: Full TypeScript support with typed events and context

## Why Use State Machines?

### Problems with Boolean Flags

```typescript
// Before: Multiple booleans create combinatorial explosion
private isCreatingRoom = false;
private isJoiningRoom = false;
private isReadying = false;
private isTransitioning = false;

// Can have impossible states like:
// isCreatingRoom = true AND isJoiningRoom = true
```

### Solution: Single Source of Truth

```typescript
// After: Only one state at a time
states: 'menu' | 'creatingRoom' | 'joiningRoom' | 'waiting' | 'readying';
```

## LobbyScene State Machine

### State Diagram

```
disconnected
    ↓ CONNECT
connecting
    ↓ CONNECTION_SUCCESS
menu
    ↓ CREATE_ROOM                    ↓ JOIN_ROOM_CLICK
creatingRoom                       joinView
    ↓ ROOM_CREATED                    ↓ JOIN_ROOM
    |                              joiningRoom
    |                                  ↓ ROOM_JOINED
    └─────────→ waiting ←──────────────┘
                  ↓ READY
               readying
                  ↓ READY_SENT
               waiting
                  ↓ START_GAME
            transitioning (final)
```

### Machine Definition

**Location**: `packages/client/src/machines/lobbyMachine.ts`

```typescript
export type LobbyContext = {
  playerName: string;
  roomCode: string;
  errorMessage: string;
  connectionStatus: string;
};

export type LobbyEvent =
  | { type: 'CONNECT' }
  | { type: 'CONNECTION_SUCCESS' }
  | { type: 'CREATE_ROOM'; playerName: string }
  | { type: 'ROOM_CREATED'; roomCode: string }
  | { type: 'ROOM_ERROR'; error: string };
// ... more events

export const lobbyMachine = createMachine({
  id: 'lobby',
  initial: 'disconnected',
  context: {
    playerName: '',
    roomCode: '',
    errorMessage: '',
    connectionStatus: 'Disconnected',
  },
  states: {
    disconnected: {
      on: { CONNECT: 'connecting' },
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
      },
    },
    // ... more states
  },
});
```

### Scene Integration

**Location**: `packages/client/src/scenes/LobbyScene.ts`

#### 1. Declare Actor

```typescript
export default class LobbyScene extends Phaser.Scene {
  private lobbyActor!: ReturnType<typeof createActor<typeof lobbyMachine>>;

  create() {
    // Create new actor on each scene start (important for scene restart)
    this.lobbyActor = createActor(lobbyMachine);
    this.setupStateMachine();
  }
}
```

#### 2. Setup State Machine

```typescript
private setupStateMachine() {
  // Subscribe to state changes
  this.lobbyActor.subscribe((state) => {
    this.updateUI(state.value as string, state.context);
  });

  // Start the machine
  this.lobbyActor.start();

  // Send initial event
  this.send({ type: 'CONNECT' });
}
```

#### 3. Update UI Based on State

```typescript
private updateUI(state: string, context: LobbyContext) {
  switch (state) {
    case 'menu':
      this.menuView.setVisible(true);
      this.joinView.setVisible(false);
      if (context.errorMessage) {
        this.menuView.setConnectionStatus(context.errorMessage, '#ef4444');
      }
      break;

    case 'creatingRoom':
      this.menuView.setButtonsEnabled(false);
      this.menuView.setConnectionStatus('Creating room...', '#f59e0b');
      break;

    // ... handle all states
  }
}
```

#### 4. Send Events

```typescript
private send(event: LobbyEvent) {
  this.lobbyActor.send(event);
}

// Usage in handlers
private handleCreateRoom() {
  this.send({ type: 'CREATE_ROOM', playerName: 'John' });

  // Async operations
  const room = await this.networkManager.createRoom(playerName);
  if (room) {
    this.send({ type: 'ROOM_CREATED', roomCode: room.code });
  } else {
    this.send({ type: 'ROOM_ERROR', error: 'Failed' });
  }
}
```

#### 5. Cleanup

```typescript
shutdown() {
  this.lobbyActor.stop();
  // ... destroy views
}
```

### View Integration (Callback Pattern)

Instead of Phaser event emitters, use direct callbacks:

```typescript
// View interface
export interface MenuViewCallbacks {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

// View accepts callbacks in constructor
export class MenuView {
  constructor(scene: Phaser.Scene, callbacks: MenuViewCallbacks) {
    this.callbacks = callbacks;
  }

  private createUI() {
    this.createButton('Create Room', () => {
      this.callbacks.onCreateRoom();
    });
  }
}

// Scene provides callbacks that send state machine events
this.menuView = new MenuView(this, {
  onCreateRoom: () => this.send({ type: 'CREATE_ROOM' }),
  onJoinRoom: () => this.send({ type: 'JOIN_ROOM_CLICK' }),
});
```

## Adoption Guide for Other Scenes

### Step 1: Identify States

Map out all possible states your scene can be in:

**Example for GameScene**:

- `initializing` - Loading game data
- `dealing` - Cards being dealt
- `bidding` - Players bidding
- `playing` - Trick-taking gameplay
- `trickComplete` - Showing trick winner
- `roundComplete` - Showing round results
- `gameOver` - Final scores
- `paused` - Game paused

### Step 2: Define Context

What data needs to be shared across states?

```typescript
export type GameContext = {
  currentPlayer: string;
  currentTrick: Card[];
  bids: Record<string, number>;
  scores: Record<string, number>;
  round: number;
  errorMessage: string;
};
```

### Step 3: Define Events

What actions can trigger state transitions?

```typescript
export type GameEvent =
  | { type: 'CARDS_DEALT' }
  | { type: 'BID_PLACED'; playerId: string; bid: number }
  | { type: 'ALL_BIDS_PLACED' }
  | { type: 'CARD_PLAYED'; playerId: string; card: Card }
  | { type: 'TRICK_COMPLETE'; winner: string }
  | { type: 'ROUND_COMPLETE' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };
```

### Step 4: Create Machine File

**Location**: `packages/client/src/machines/gameMachine.ts`

```typescript
import { createMachine, assign } from 'xstate';

export const gameMachine = createMachine({
  id: 'game',
  initial: 'initializing',
  types: {} as {
    context: GameContext;
    events: GameEvent;
  },
  context: {
    currentPlayer: '',
    currentTrick: [],
    bids: {},
    scores: {},
    round: 1,
    errorMessage: '',
  },
  states: {
    initializing: {
      on: {
        CARDS_DEALT: 'bidding',
      },
    },
    bidding: {
      on: {
        BID_PLACED: {
          actions: assign({
            bids: ({ context, event }) => ({
              ...context.bids,
              [event.playerId]: event.bid,
            }),
          }),
        },
        ALL_BIDS_PLACED: 'playing',
      },
    },
    playing: {
      on: {
        CARD_PLAYED: {
          actions: assign({
            currentTrick: ({ context, event }) => [
              ...context.currentTrick,
              event.card,
            ],
          }),
        },
        TRICK_COMPLETE: 'trickComplete',
        PAUSE: 'paused',
      },
    },
    paused: {
      on: {
        RESUME: 'playing',
      },
    },
    // ... more states
  },
});
```

### Step 5: Integrate into Scene

```typescript
import { createActor } from 'xstate';
import { gameMachine } from '../machines/gameMachine';
import type { GameEvent } from '../machines/gameMachine';

export default class GameScene extends Phaser.Scene {
  private gameActor!: ReturnType<typeof createActor<typeof gameMachine>>;

  create() {
    this.gameActor = createActor(gameMachine);
    this.setupStateMachine();
  }

  private setupStateMachine() {
    this.gameActor.subscribe((state) => {
      this.updateUI(state.value as string, state.context);
    });

    this.gameActor.start();
  }

  private updateUI(state: string, context: GameContext) {
    switch (state) {
      case 'bidding':
        this.showBiddingUI();
        break;
      case 'playing':
        this.enableCardPlay();
        break;
      // ... handle states
    }
  }

  private send(event: GameEvent) {
    this.gameActor.send(event);
  }

  shutdown() {
    this.gameActor.stop();
  }
}
```

### Step 6: Wire Network Events

```typescript
private setupNetworkListeners() {
  this.networkManager.on('cardDealt', () => {
    this.send({ type: 'CARDS_DEALT' });
  });

  this.networkManager.on('bidPlaced', (data) => {
    this.send({
      type: 'BID_PLACED',
      playerId: data.playerId,
      bid: data.bid
    });
  });
}
```

## Best Practices

### 1. One Actor Per Scene

Create a fresh actor in `create()` method to ensure clean state on scene restart.

```typescript
// ✅ Good
create() {
  this.actor = createActor(machine);
}

// ❌ Bad - reuses stopped actor
private actor = createActor(machine);
```

### 2. Use Type-Safe Events

Always define event types with payloads:

```typescript
// ✅ Good
type Event = { type: 'SUBMIT'; data: string } | { type: 'CANCEL' };

// ❌ Bad - no type safety
this.send({ type: 'SUBMIT', dat: 'typo!' }); // no error
```

### 3. Handle All States in updateUI

Use exhaustive switch statements:

```typescript
private updateUI(state: string, context: Context) {
  switch (state) {
    case 'stateA':
      // ...
      break;
    case 'stateB':
      // ...
      break;
    default:
      console.warn('Unhandled state:', state);
  }
}
```

### 4. Centralize UI Updates

Don't update UI in multiple places:

```typescript
// ✅ Good - single source of truth
private updateUI(state: string) {
  switch (state) {
    case 'loading':
      this.showLoader(true);
      break;
  }
}

// ❌ Bad - scattered UI updates
private showLoader(visible: boolean) {
  // Don't call this directly from handlers
}
```

### 5. Separate Async Logic from Machine

Keep machine pure, handle async in scene:

```typescript
// ✅ Good
private async handleLogin() {
  this.send({ type: 'LOGIN_START' });

  try {
    const user = await api.login();
    this.send({ type: 'LOGIN_SUCCESS', user });
  } catch (error) {
    this.send({ type: 'LOGIN_ERROR', error: error.message });
  }
}

// ❌ Bad - async in machine (use invoke for this)
states: {
  loggingIn: {
    // Avoid this unless using invoke services
  }
}
```

### 6. Use Guards for Validation

Prevent invalid transitions:

```typescript
states: {
  playing: {
    on: {
      PLAY_CARD: {
        target: 'cardPlayed',
        guard: ({ context, event }) =>
          context.hand.includes(event.card),
      },
    },
  },
}
```

### 7. Clean State Transitions

Clear temporary data when transitioning:

```typescript
states: {
  error: {
    on: {
      RETRY: {
        target: 'loading',
        actions: assign({
          errorMessage: '', // Clear error
        }),
      },
    },
  },
}
```

## Benefits Achieved

### Code Quality

- **-21% lines of code** (450 → 355 lines in LobbyScene)
- **No event emitter boilerplate** (removed 15 lines of `on()`/`off()` calls)
- **Single responsibility** - updateUI() only handles UI updates

### Maintainability

- **Visual state flow** - can diagram all states and transitions
- **Explicit transitions** - can't accidentally enter invalid state
- **Type safety** - TypeScript catches invalid events/states

### Debugging

- **State logs** - `console.log(state.value)` shows exact state
- **State inspector** - use XState DevTools or Stately Studio
- **Predictable behavior** - same event + state = same result

### Testing

- **Unit test machines** - test state transitions independently
- **Mock states** - test UI for specific state without triggering flow
- **No race conditions** - state machine prevents concurrent transitions

## Common Patterns

### Loading States

```typescript
states: {
  idle: {
    on: { FETCH: 'loading' }
  },
  loading: {
    on: {
      SUCCESS: 'success',
      ERROR: 'error',
    }
  },
  success: {
    on: { FETCH: 'loading' }
  },
  error: {
    on: { RETRY: 'loading' }
  }
}
```

### Nested States (Substates)

```typescript
states: {
  playing: {
    initial: 'waitingForMove',
    states: {
      waitingForMove: {
        on: { MOVE: 'validating' }
      },
      validating: {
        on: {
          VALID: 'processing',
          INVALID: 'waitingForMove',
        }
      },
      processing: {
        on: { COMPLETE: '#game.nextTurn' }
      }
    }
  }
}
```

### Parallel States (Multiple Things at Once)

```typescript
type: 'parallel',
states: {
  audio: {
    initial: 'playing',
    states: {
      playing: { on: { MUTE: 'muted' } },
      muted: { on: { UNMUTE: 'playing' } }
    }
  },
  game: {
    initial: 'active',
    states: {
      active: { on: { PAUSE: 'paused' } },
      paused: { on: { RESUME: 'active' } }
    }
  }
}
```

## Migration Checklist

When migrating a scene to XState:

- [ ] List all boolean state flags
- [ ] Draw state diagram on paper
- [ ] Define Context type
- [ ] Define Event types (union of all events)
- [ ] Create machine file in `machines/` folder
- [ ] Add actor declaration in scene
- [ ] Initialize actor in `create()`
- [ ] Implement `updateUI()` switch statement
- [ ] Create `send()` helper method
- [ ] Replace Phaser events with callbacks in views
- [ ] Wire network events to state machine events
- [ ] Stop actor in `shutdown()`
- [ ] Test all state transitions
- [ ] Remove old boolean flags
- [ ] Update related documentation

## Resources

- [XState Documentation](https://stately.ai/docs/xstate)
- [Stately Studio (Visual Editor)](https://stately.ai/editor)
- [XState Examples](https://github.com/statelyai/xstate/tree/main/examples)
- [State Machine Cheatsheet](https://stately.ai/docs/cheatsheet)

## Conclusion

State machines provide a robust, maintainable way to manage complex scene state. While they require upfront planning, they eliminate entire classes of bugs and make the codebase more predictable. The patterns established in LobbyScene can be replicated across all scenes for consistent state management.
