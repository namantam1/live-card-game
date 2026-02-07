# Server Code Structure + Colyseus Patterns (AI Reference)

Purpose: Provide a practical map of the server code and how Colyseus is used here. This is NOT a rigid pattern. The current code includes a few pragmatic shortcuts/anti-patterns. Use this doc to stay consistent while improving incrementally.

References:

- Colyseus quick reference: `ai-docs/colyseus-0.17.x/README.md`
- Colyseus official docs (latest): lifecycle, schema, state sync, monitor/playground, message validation.

## High-Level Layout (packages/server/src)

- `index.ts` : Server entrypoint (via `@colyseus/tools listen()`).
- `app.config.ts` : Colyseus server + Express configuration (rooms, CORS, health, monitor, playground).
- `rooms/CallBreakRoom.ts` : Main game room (authoritative game logic + message handlers).
- `rooms/GameState.ts` : Colyseus Schema state classes (Player, Card, TrickEntry, GameState).

Shared domain logic lives in `packages/shared/` and is imported into the server:

- `packages/shared/src/game-logic/*` : core rules (bidding, scoring, card utilities).
- `packages/shared/src/types/*` : shared types.
- `packages/shared/src/bot/*` : bot strategy + reactions.

## Colyseus Room Lifecycle (What to Expect)

Current room is `CallBreakRoom` (extends `Room`).

Lifecycle responsibilities (per Colyseus docs):

- `onCreate` : initialize state, register message handlers, set metadata.
- `onJoin` : validate inputs, create Player, add to state.
- `onLeave` : cleanup after a client leaves.
- `onDispose` : cleanup after room ends.

Docs also recommend handling unexpected disconnects with `onDrop` + `allowReconnection` and using `onReconnect` when they return.

## State Model (Schema)

The authoritative state is defined with `@colyseus/schema`:

- `GameState` holds game phase, round info, turn, trick, player list.
- `Player`, `Card`, `TrickEntry` are Schema classes.

Colyseus expects all state to be Schema objects and mutated server-side only.
Schema structures should be used only for state, not messages.

## Message Handling (Current Style)

Current code registers handlers inside `onCreate()`:

- `ready`, `bid`, `playCard`, `nextRound`, `restart`, `reaction`.

This is valid, but another Colyseus style is `messages = { ... }` with optional validation wrappers.

Recommended best practice: validate payloads (e.g., Zod + `validate()`) for safer message handling.

## Express Integration (app.config.ts)

`app.config.ts` sets up:

- CORS for all routes.
- `/health` endpoint.
- `/monitor` (Colyseus monitoring panel) — should be protected.
- `/` playground in non-production. (Playground is a dev tool.)

## Current Code Realities (Patterns + Anti-Patterns)

Keep these in mind when adding new features:

Patterns already used (good to follow):

- Authoritative server mutates state; clients only send requests.
- State uses Schema classes (`GameState`, `Player`, `Card`).
- Game logic partly in `packages/shared` to keep rules consistent across client + server.
- Use metadata for matchmaking (roomCode filter).

Anti-patterns / shortcuts in current code (do NOT treat as strict pattern):

- Reconnection handled inside `onLeave()` instead of `onDrop()`/`onReconnect()`. Docs suggest `onDrop()` for unexpected disconnects.
- Message payloads are not validated (no `validate()` / schema).
- Room exposes the actual room code in error messages (potential info leakage).
- `CallBreakRoom` mixes orchestration + heavy game logic + bot logic in one file.
- Some TODOs indicate logic that is wrong for multiplayer but still present (e.g., `restart`).

Use these as candidates for improvement, not as hard rules to copy.

## Practical Pattern for New Features

When adding a new server feature, prefer:

- **State-first design**:
  - Add fields to `GameState` only if needed for synchronization.
  - Keep transient values as local variables when no client needs them.

- **Message validation**:
  - Validate payloads using `validate()` (Zod recommended).
  - Keep message types consistent and small.

- **Logic placement**:
  - Rules and pure logic -> `packages/shared/src/game-logic`.
  - Bot strategy -> `packages/shared/src/bot`.
  - Room class -> orchestration and state mutations.

- **Lifecycle discipline**:
  - Clean up timers and temporary resources in `onDispose()`.
  - Use `onDrop` + `allowReconnection()` for network loss.

## Quick Checklist (Before You Commit)

- Is the state mutation server-only? (Clients should never mutate state.)
- Are new payloads validated?
- Are new timers cleared or naturally owned by Colyseus Clock?
- Is any logic better moved to `packages/shared`?
- Does the room file stay under control (size, cohesion)?

## Where to Look First

- Room entry: `packages/server/src/rooms/CallBreakRoom.ts`
- Schema state: `packages/server/src/rooms/GameState.ts`
- Shared game rules: `packages/shared/src/game-logic/`
- Shared bot behavior: `packages/shared/src/bot/`

Use this doc as a guide, not a straitjacket. When you see anti-patterns, prefer incremental cleanup rather than rigid rewrites.
