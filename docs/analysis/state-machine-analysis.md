# State Machine Architecture Analysis - Call Break Card Game

## Executive Summary

This document provides a comprehensive analysis of the current state management architecture in the Call Break card game codebase. The analysis identifies that while the codebase uses well-defined phases (BIDDING, PLAYING, etc.), there is **no formal state machine implementation**. Instead, state transitions are managed through ad-hoc string-based phase changes scattered across multiple files.

---

## 1. Current Architecture Analysis

### 1.1 Phase Definition (Constants)

**Location**: `src/utils/constants.ts:98-108`

```typescript
export const PHASE = {
  IDLE: "idle",
  DEALING: "dealing",
  BIDDING: "bidding",
  PLAYING: "playing",
  TRICK_END: "trickEnd",
  ROUND_END: "roundEnd",
  GAME_OVER: "gameOver",
} as const;
```

The server also uses its own phase definition in `server/src/rooms/GameState.ts:36`:
```typescript
@type("string") phase: string = "waiting"; // waiting, bidding, playing, trickEnd, roundEnd, gameOver
```

**Issue #1: Phase Mismatch**
- Client has `IDLE` while server has `waiting`
- No shared type definition between client and server
- String-based phases are error-prone

### 1.2 State Management Components

#### Client-Side State Management

| Component | File | Responsibility |
|-----------|------|----------------|
| `GameManager` | `src/managers/GameManager.ts` | Solo mode - owns phase, manages transitions |
| `NetworkManager` | `src/managers/NetworkManager.ts` | Multiplayer - listens to server phase changes |
| `SoloGameMode` | `src/modes/SoloGameMode.ts` | Wraps GameManager, forwards events |
| `MultiplayerGameMode` | `src/modes/MultiplayerGameMode.ts` | Wraps NetworkManager, translates events |
| `GameModeBase` | `src/modes/GameModeBase.ts` | Abstract base class for game modes |

#### Server-Side State Management

| Component | File | Responsibility |
|-----------|------|----------------|
| `GameState` | `server/src/rooms/GameState.ts` | Colyseus schema - holds phase as string |
| `CallBreakRoom` | `server/src/rooms/CallBreakRoom.ts` | Phase transitions via direct assignment |

### 1.3 Current State Transition Patterns

#### Pattern A: Direct Phase Assignment (Solo Mode)

**Location**: `src/managers/GameManager.ts`

```typescript
setPhase(phase: string) {
  this.phase = phase;
  this.emit(EVENTS.PHASE_CHANGED, phase);
}

// Usage scattered throughout:
this.setPhase(PHASE.DEALING);    // line 84
this.setPhase(PHASE.BIDDING);    // line 100
this.setPhase(PHASE.PLAYING);    // line 141
this.setPhase(PHASE.TRICK_END);  // line 243
this.setPhase(PHASE.ROUND_END);  // line 278
this.setPhase(PHASE.GAME_OVER);  // line 308
```

**Problems**:
- No validation of allowed transitions
- No guards or conditions
- No onEnter/onExit hooks
- State logic scattered across multiple methods

#### Pattern B: Server State Synchronization (Multiplayer Mode)

**Location**: `server/src/rooms/CallBreakRoom.ts`

```typescript
this.state.phase = "dealing";    // line 228
this.state.phase = "bidding";    // line 251
this.state.phase = "playing";    // line 298, 420
this.state.phase = "trickEnd";   // line 380
this.state.phase = "roundEnd";   // line 479
this.state.phase = "gameOver";   // line 495
this.state.phase = "waiting";    // line 522
```

**Problems**:
- Same issues as Pattern A
- Colyseus schema syncs changes, but no transition validation
- Race conditions possible during network latency

---

## 2. Identified Problems

### 2.1 No Transition Validation

**Current Risk**: Invalid state transitions are possible.

```typescript
// Nothing prevents this invalid transition:
this.state.phase = "gameOver";
this.state.phase = "bidding"; // Should not be allowed!
```

**Valid Transition Graph** (implicit, not enforced):
```
waiting -> dealing -> bidding -> playing <-> trickEnd
                                    |
                                    v
                              roundEnd -> playing (next round)
                                    |
                                    v
                               gameOver -> waiting (restart)
```

### 2.2 Scattered Transition Logic

**Problem**: Related state logic is spread across files.

| Phase | Logic Locations |
|-------|-----------------|
| `dealing` | GameManager.dealCards(), CallBreakRoom.dealCards() |
| `bidding` | GameManager.runBidding(), CallBreakRoom.handleBid() |
| `playing` | Multiple locations in both GameManager and CallBreakRoom |
| `trickEnd` | GameManager.completeTrick(), CallBreakRoom.completeTrick() |

### 2.3 Duplicate State Logic

**Client (GameManager.ts:242-275)**:
```typescript
async completeTrick() {
  this.setPhase(PHASE.TRICK_END);
  const winnerIndex = findTrickWinner(this.currentTrick, this.leadSuit!);
  this.players[winnerIndex].addTrick();
  // ... animation logic ...
  if (this.trickNumber >= CARDS_PER_PLAYER) {
    await this.completeRound();
  } else {
    this.setPhase(PHASE.PLAYING);
    // ...
  }
}
```

**Server (CallBreakRoom.ts:379-427)**:
```typescript
completeTrick(): void {
  this.state.phase = "trickEnd";
  const winnerId = this.findTrickWinner();
  winner.tricksWon++;
  // ...
  this.clock.setTimeout(() => {
    if (this.state.trickNumber >= CARDS_PER_PLAYER) {
      this.completeRound();
    } else {
      this.state.phase = "playing";
      // ...
    }
  }, 1500);
}
```

**Issue**: Near-identical logic duplicated, prone to drift.

### 2.4 No Side Effect Isolation

State changes currently trigger implicit side effects:
- UI updates via events
- Animation starts
- Sound effects
- Network messages

These are mixed with state transition logic, making testing difficult.

### 2.5 Missing Guard Conditions

**Example**: Playing a card should only work if:
1. Phase is "playing"
2. It's the player's turn
3. Card is in valid cards list
4. Player has not already played

Currently these are checked inline:
```typescript
// GameManager.ts:186-194
async playCard(cardData: CardData, playerIndex: number) {
  if (this.phase !== PHASE.PLAYING) return;
  if (playerIndex !== this.currentTurn) return;
  // ...validation logic...
}
```

This pattern is repeated in multiple places without formal guards.

### 2.6 No State History

When a user reconnects, there's no formal way to reconstruct:
- What happened before disconnection
- What actions are pending
- What the expected next state should be

### 2.7 Async Transition Complexity

Both client and server use `setTimeout`/`delayedCall` for timed transitions:

```typescript
// CallBreakRoom.ts:250
this.clock.setTimeout(() => {
  this.state.phase = "bidding";
  this.state.currentTurn = this.state.playerOrder[this.state.biddingPlayerIndex];
  this.checkBotTurn();
}, 1000);
```

**Problems**:
- Hard to test
- Race conditions possible
- No cancellation mechanism
- Animation timing coupled with game logic

---

## 3. Industry Best Practices

### 3.1 Finite State Machine (FSM) Pattern

Reference: [Game Programming Patterns - State](https://gameprogrammingpatterns.com/state.html)

**Core Principles**:
1. Fixed set of states the machine can be in
2. Machine can only be in one state at a time
3. Sequence of inputs (events) transitions between states
4. Each state has entry/exit actions

### 3.2 TypeScript State Machine Benefits

Reference: [Building State Machines in TypeScript](https://medium.com/@floyd.may/building-a-typescript-state-machine-cc9e55995fa8)

- **Type Safety**: Compiler prevents invalid transitions
- **Predictability**: All states and transitions declared upfront
- **Maintainability**: Adding/modifying states is isolated
- **Debuggability**: State graphs are visualizable
- **Testability**: States can be tested in isolation

### 3.3 XState for Complex Games

Reference: [XState Documentation](https://stately.ai/docs/xstate)

XState provides:
- Hierarchical (nested) states
- Parallel states
- History states
- Guards (conditional transitions)
- Actions (side effects)
- Services (async operations)
- Actor model for component communication
- Visual debugging tools

Game-specific benefits from [Thoughts on Building a Game with XState](https://asukawang.com/blog/thoughts-on-building-a-game-with-xstate/):
- Event-based transitions guarantee predictable behavior changes
- Encapsulation makes state machines robust
- `spawn` API for entity communication
- Visual debugging with XState Visualizer

---

## 4. Recommended Solutions

### 4.1 Option A: Lightweight Custom FSM (Minimal Change)

**Effort**: Low-Medium
**Risk**: Low
**Best For**: Quick improvement without new dependencies

Create a type-safe FSM class:

```typescript
// src/state/GameStateMachine.ts

type GamePhase = 'waiting' | 'dealing' | 'bidding' | 'playing' | 'trickEnd' | 'roundEnd' | 'gameOver';

interface Transition<Context> {
  from: GamePhase | GamePhase[];
  to: GamePhase;
  guard?: (context: Context) => boolean;
  onTransition?: (context: Context) => void;
}

interface StateConfig<Context> {
  onEnter?: (context: Context) => void;
  onExit?: (context: Context) => void;
}

class GameStateMachine<Context> {
  private currentState: GamePhase;
  private states: Map<GamePhase, StateConfig<Context>>;
  private transitions: Transition<Context>[];
  private context: Context;
  private listeners: Set<(state: GamePhase, prevState: GamePhase) => void>;

  constructor(initialState: GamePhase, context: Context) {
    this.currentState = initialState;
    this.context = context;
    this.states = new Map();
    this.transitions = [];
    this.listeners = new Set();
  }

  defineState(phase: GamePhase, config: StateConfig<Context>): this {
    this.states.set(phase, config);
    return this;
  }

  defineTransition(transition: Transition<Context>): this {
    this.transitions.push(transition);
    return this;
  }

  can(to: GamePhase): boolean {
    return this.transitions.some(t => {
      const fromMatch = Array.isArray(t.from)
        ? t.from.includes(this.currentState)
        : t.from === this.currentState;
      const toMatch = t.to === to;
      const guardPass = !t.guard || t.guard(this.context);
      return fromMatch && toMatch && guardPass;
    });
  }

  transition(to: GamePhase): boolean {
    const validTransition = this.transitions.find(t => {
      const fromMatch = Array.isArray(t.from)
        ? t.from.includes(this.currentState)
        : t.from === this.currentState;
      return fromMatch && t.to === to && (!t.guard || t.guard(this.context));
    });

    if (!validTransition) {
      console.error(`Invalid transition: ${this.currentState} -> ${to}`);
      return false;
    }

    const prevState = this.currentState;
    const currentConfig = this.states.get(this.currentState);
    const nextConfig = this.states.get(to);

    // Exit current state
    currentConfig?.onExit?.(this.context);

    // Execute transition action
    validTransition.onTransition?.(this.context);

    // Update state
    this.currentState = to;

    // Enter new state
    nextConfig?.onEnter?.(this.context);

    // Notify listeners
    this.listeners.forEach(fn => fn(to, prevState));

    return true;
  }

  getState(): GamePhase {
    return this.currentState;
  }

  subscribe(fn: (state: GamePhase, prevState: GamePhase) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
```

**Usage**:
```typescript
const gameFSM = new GameStateMachine<GameContext>('waiting', context)
  .defineState('waiting', {
    onEnter: (ctx) => ctx.resetGame(),
  })
  .defineState('dealing', {
    onEnter: (ctx) => ctx.dealCards(),
    onExit: (ctx) => ctx.notifyDealt(),
  })
  .defineState('bidding', {
    onEnter: (ctx) => ctx.startBidding(),
  })
  .defineTransition({ from: 'waiting', to: 'dealing' })
  .defineTransition({ from: 'dealing', to: 'bidding' })
  .defineTransition({
    from: 'bidding',
    to: 'playing',
    guard: (ctx) => ctx.allPlayersBid(),
  })
  .defineTransition({ from: 'playing', to: 'trickEnd' })
  .defineTransition({
    from: 'trickEnd',
    to: 'playing',
    guard: (ctx) => ctx.trickNumber < 13,
  })
  .defineTransition({
    from: 'trickEnd',
    to: 'roundEnd',
    guard: (ctx) => ctx.trickNumber >= 13,
  })
  .defineTransition({
    from: 'roundEnd',
    to: 'dealing',
    guard: (ctx) => ctx.currentRound < ctx.totalRounds,
  })
  .defineTransition({
    from: 'roundEnd',
    to: 'gameOver',
    guard: (ctx) => ctx.currentRound >= ctx.totalRounds,
  })
  .defineTransition({ from: 'gameOver', to: 'waiting' });
```

### 4.2 Option B: XState Integration (Recommended for Production)

**Effort**: Medium-High
**Risk**: Medium (new dependency, learning curve)
**Best For**: Long-term maintainability, complex games

Reference: [XState GitHub](https://github.com/statelyai/xstate)

```typescript
// src/state/gameMachine.ts
import { createMachine, assign } from 'xstate';

interface GameContext {
  currentRound: number;
  totalRounds: number;
  trickNumber: number;
  currentPlayerIndex: number;
  players: PlayerData[];
  currentTrick: TrickEntry[];
  leadSuit: string | null;
}

type GameEvent =
  | { type: 'START_GAME' }
  | { type: 'CARDS_DEALT' }
  | { type: 'BID_PLACED'; playerId: string; bid: number }
  | { type: 'CARD_PLAYED'; playerId: string; cardId: string }
  | { type: 'TRICK_COLLECTED' }
  | { type: 'ROUND_SCORED' }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESTART' };

export const gameMachine = createMachine({
  id: 'callBreakGame',
  initial: 'waiting',
  context: {
    currentRound: 1,
    totalRounds: 5,
    trickNumber: 0,
    currentPlayerIndex: 0,
    players: [],
    currentTrick: [],
    leadSuit: null,
  },
  states: {
    waiting: {
      on: {
        START_GAME: {
          target: 'dealing',
          actions: 'resetGame',
        },
      },
    },
    dealing: {
      entry: 'dealCards',
      on: {
        CARDS_DEALT: 'bidding',
      },
    },
    bidding: {
      entry: 'initializeBidding',
      on: {
        BID_PLACED: [
          {
            target: 'playing',
            cond: 'allPlayersBid',
            actions: 'recordBid',
          },
          {
            target: 'bidding',
            actions: ['recordBid', 'nextBidder'],
          },
        ],
      },
    },
    playing: {
      entry: 'initializePlayPhase',
      on: {
        CARD_PLAYED: [
          {
            target: 'trickEnd',
            cond: 'trickComplete',
            actions: 'playCard',
          },
          {
            target: 'playing',
            actions: ['playCard', 'nextPlayer'],
          },
        ],
      },
    },
    trickEnd: {
      entry: 'determineTrickWinner',
      on: {
        TRICK_COLLECTED: [
          {
            target: 'roundEnd',
            cond: 'roundComplete',
          },
          {
            target: 'playing',
            actions: 'setupNextTrick',
          },
        ],
      },
    },
    roundEnd: {
      entry: 'calculateScores',
      on: {
        NEXT_ROUND: [
          {
            target: 'gameOver',
            cond: 'gameComplete',
          },
          {
            target: 'dealing',
            actions: 'incrementRound',
          },
        ],
      },
    },
    gameOver: {
      entry: 'determineWinner',
      on: {
        RESTART: {
          target: 'waiting',
          actions: 'resetGame',
        },
      },
    },
  },
}, {
  guards: {
    allPlayersBid: (context) => {
      return context.players.every(p => p.bid > 0);
    },
    trickComplete: (context) => {
      return context.currentTrick.length === 3; // 4th card about to be played
    },
    roundComplete: (context) => {
      return context.trickNumber >= 13;
    },
    gameComplete: (context) => {
      return context.currentRound >= context.totalRounds;
    },
  },
  actions: {
    resetGame: assign({
      currentRound: 1,
      trickNumber: 0,
      currentPlayerIndex: 0,
      currentTrick: [],
      leadSuit: null,
    }),
    dealCards: (context, event) => {
      // Emit deal cards action
    },
    recordBid: assign({
      players: (context, event) => {
        if (event.type !== 'BID_PLACED') return context.players;
        return context.players.map(p =>
          p.id === event.playerId ? { ...p, bid: event.bid } : p
        );
      },
    }),
    nextBidder: assign({
      currentPlayerIndex: (context) =>
        (context.currentPlayerIndex + 1) % context.players.length,
    }),
    playCard: assign({
      currentTrick: (context, event) => {
        if (event.type !== 'CARD_PLAYED') return context.currentTrick;
        // Add card to trick
        return [...context.currentTrick, { playerId: event.playerId, cardId: event.cardId }];
      },
      leadSuit: (context, event) => {
        if (context.currentTrick.length === 0 && event.type === 'CARD_PLAYED') {
          // Set lead suit from first card
          return getCardSuit(event.cardId);
        }
        return context.leadSuit;
      },
    }),
    nextPlayer: assign({
      currentPlayerIndex: (context) =>
        (context.currentPlayerIndex + 1) % context.players.length,
    }),
    determineTrickWinner: (context) => {
      // Calculate winner, emit event
    },
    setupNextTrick: assign({
      currentTrick: [],
      leadSuit: null,
      trickNumber: (context) => context.trickNumber + 1,
    }),
    calculateScores: (context) => {
      // Calculate round scores
    },
    incrementRound: assign({
      currentRound: (context) => context.currentRound + 1,
      trickNumber: 0,
    }),
    determineWinner: (context) => {
      // Determine game winner
    },
  },
});
```

**Benefits**:
- Visual debugging with [XState Visualizer](https://stately.ai/viz)
- TypeScript type inference
- Built-in testing utilities
- Serializable state (helpful for reconnection)

### 4.3 Option C: Shared State Machine for Client/Server

**Effort**: High
**Risk**: Medium-High
**Best For**: Eliminating client/server state duplication

Create a shared package that both client and server use:

```
/packages
  /shared-state
    /src
      gameMachine.ts      # XState or custom FSM
      types.ts            # Shared types
      transitions.ts      # Transition definitions
      guards.ts           # Guard functions
```

**Server**: Runs the state machine, broadcasts state changes
**Client**: Receives state updates, uses same FSM for validation/prediction

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Effort: 2-3 days)

1. **Create shared type definitions**
   - Unified `GamePhase` type
   - Shared between client and server
   - Transition type definitions

2. **Implement basic FSM class**
   - Start with Option A (custom FSM)
   - Add transition validation
   - Add state change logging

3. **Refactor GameManager**
   - Replace direct `setPhase()` calls with FSM transitions
   - Move transition logic into state machine
   - Keep existing event emissions for backward compatibility

### Phase 2: Server Integration (Effort: 2-3 days)

1. **Apply FSM to CallBreakRoom**
   - Same pattern as client
   - Ensure transitions are validated server-side

2. **Add transition guards**
   - Validate game conditions before transitions
   - Return meaningful errors for invalid transitions

3. **Add audit logging**
   - Log all state transitions with context
   - Useful for debugging and analytics

### Phase 3: Advanced Features (Effort: 3-5 days)

1. **Migrate to XState (optional)**
   - Replace custom FSM with XState
   - Add visual debugging
   - Implement hierarchical states if needed

2. **Add state serialization**
   - For reconnection support
   - Save/restore game state

3. **Add testing infrastructure**
   - Unit tests for state transitions
   - Integration tests for game flows

---

## 6. Quick Win: Immediate Improvements

If a full refactor isn't feasible now, these changes provide immediate benefits:

### 6.1 Add Transition Validation Function

```typescript
// src/utils/stateValidation.ts

const VALID_TRANSITIONS: Record<string, string[]> = {
  'waiting': ['dealing'],
  'idle': ['dealing'],
  'dealing': ['bidding'],
  'bidding': ['playing'],
  'playing': ['trickEnd'],
  'trickEnd': ['playing', 'roundEnd'],
  'roundEnd': ['dealing', 'gameOver'],
  'gameOver': ['waiting', 'idle'],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: string, to: string): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid state transition: ${from} -> ${to}`);
  }
}
```

### 6.2 Wrap setPhase with Validation

```typescript
// In GameManager.ts
setPhase(phase: string) {
  if (this.phase !== phase) {
    assertValidTransition(this.phase, phase);
  }
  this.phase = phase;
  this.emit(EVENTS.PHASE_CHANGED, phase);
}
```

### 6.3 Add Phase Enum Type Safety

```typescript
// Replace string with enum
type GamePhase = typeof PHASE[keyof typeof PHASE];

// Update function signatures
setPhase(phase: GamePhase) { ... }
getPhase(): GamePhase { ... }
```

---

## 7. Conclusion

The current architecture has functional but fragile state management. The lack of formal state machine leads to:

- Potential for invalid state transitions
- Duplicated logic between client and server
- Difficult debugging and testing
- Risk of state inconsistencies

**Recommended Approach**:

Start with **Option A (Custom FSM)** for immediate improvements with minimal risk, then evaluate migration to **Option B (XState)** based on project needs and team familiarity.

The quick wins in Section 6 can be implemented immediately to add safety guards without major refactoring.

---

## References

- [Game Programming Patterns - State](https://gameprogrammingpatterns.com/state.html)
- [XState Documentation](https://stately.ai/docs/xstate)
- [XState GitHub Repository](https://github.com/statelyai/xstate)
- [TypeState - Strongly Typed FSM for TypeScript](https://github.com/eonarheim/TypeState)
- [Thoughts on Building a Game with XState](https://asukawang.com/blog/thoughts-on-building-a-game-with-xstate/)
- [Game Level Logic with XState Library](https://nicastro.in/html5-game-dev-tutorials/excaliburjs-tutorials/game-level-logic-xstate-library-excaliburjs)
- [Building a TypeScript State Machine](https://medium.com/@floyd.may/building-a-typescript-state-machine-cc9e55995fa8)
- [Composable State Machines in TypeScript](https://medium.com/@MichaelVD/composable-state-machines-in-typescript-type-safe-predictable-and-testable-5e16574a6906)
