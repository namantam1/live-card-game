# Client Developer Guide

## Source Layout (`src/`)

```
core/                   Dependency injection & registries
  ServiceLocator.ts       Global service registry
  GameRegistry.ts         Game type registry (CallBreak, future: Mindi, etc.)
  ModeRegistry.ts         Game mode registry (Solo, Multiplayer)
  GameInstance.ts          Active game session coordinator

services/               Global singleton services
  EventBus.ts             Typed pub/sub message broker + ScopedEventBus
  NetworkService.ts       Colyseus connection, reconnection, monitoring

games/                  Game rule implementations
  BaseGame.ts             Abstract base class all games extend
  callbreak/
    CallBreakGame.ts      Call Break rules, scoring, AI, rendering config

modes/                  How the game is played
  BaseMode.ts             Abstract base class all modes extend
  SoloMode.ts             Play vs AI bots (uses GameManager internally)
  MultiplayerMode.ts      Play online via Colyseus

scenes/                 Phaser scenes
  BootScene.ts            Asset loading
  MenuScene.ts            Main menu (Solo / Multiplayer selection)
  LobbyScene.ts           Room create/join, player waiting, invites
  GameScene.ts            Main gameplay scene
  UIScene.ts              UI overlay (scoreboard, modals, bidding)
  DebugScene.ts           Dev-only debug scene

components/             UI components
  game/modals/            BiddingModal, RoundModal, GameOverModal, SettingsModal, ChatMessageModal
  game/overlays/          ReconnectionOverlay
  game/panels/            ScoreBoard
  lobby/                  MenuView, JoinView, WaitingView, OnlineUsersPanel
  shared/                 Button, Timer, NetworkIndicator, ReactionPanel, QuickChatPanel, ChatToast

objects/                Game entities (Phaser GameObjects)
  Card.ts                 Card sprite
  Hand.ts                 Player hand container
  Player.ts               Player display object
  TrickArea.ts            Center play area for tricks

managers/               Utility managers
  GameManager.ts          Solo game flow (dealing, turns, AI)
  AudioManager.ts         Sound effects and background music
  PresenceManager.ts      Online presence and invite system
  UserIdentityManager.ts  User identity (name, emoji, userId)
  StorageManager.ts       Local storage wrapper

machines/               State machines
  lobbyMachine.ts         XState lobby flow (menu -> create/join -> waiting -> game)

helpers/                UI helpers
  ui/background.ts        Background rendering
  ui/input.ts             Input utilities
  ui/table.ts             Table rendering

utils/                  Pure utility functions
  cards.ts                Card comparison, validation, sorting
  constants.ts            EVENTS, TRUMP_SUIT, Suit/Rank enums, animation timing
  uiConfig.ts             Responsive UI layout config
  validation.ts           Input validation (player name, room code)
```

---

## Bootstrap Flow (`main.ts`)

```
1. Register services:
   ServiceLocator.register('eventBus', EventBus.getInstance())
   ServiceLocator.register('network', new NetworkService())
   ServiceLocator.register('audio', AudioManager.getInstance())
   ServiceLocator.register('presence', PresenceManager.getInstance())

2. Initialize NetworkService (connects Colyseus client)

3. Register games:
   GameRegistry.register('callbreak', CallBreakGame)

4. Register modes:
   ModeRegistry.register('solo', SoloMode)
   ModeRegistry.register('multiplayer', MultiplayerMode)

5. Create Phaser.Game with scenes
```

### Registered Services

| Key        | Class             | Purpose                                  |
| ---------- | ----------------- | ---------------------------------------- |
| `eventBus` | `EventBus`        | Typed pub/sub message broker             |
| `network`  | `NetworkService`  | Colyseus connection, rooms, reconnection |
| `audio`    | `AudioManager`    | Sound effects, background music          |
| `presence` | `PresenceManager` | Online users, invites                    |

Access from anywhere:

```typescript
const eventBus = ServiceLocator.get<EventBus>('eventBus');
const network = ServiceLocator.get<NetworkService>('network');
```

---

## EventBus

Central typed pub/sub. Three event categories with typed payloads.

### Event Categories

**Game Events** (`game:*`) — Published by NetworkService (multiplayer) or GameManager (solo):
| Event | Payload | When |
|-------|---------|------|
| `phaseChanged` | `{ phase: string }` | Game phase transitions |
| `cardPlayed` | `{ playerId, card }` | Card added to trick |
| `turnChanged` | `{ playerId, isMyTurn? }` | Active player changes |
| `trickComplete` | `{ winnerId }` | Trick won |
| `bidPlaced` | `{ playerIndex, bid }` | Player bids |
| `trickCleared` | `undefined` | Trick area cleared |
| `roundChanged` | `{ round }` | Round number changes |
| `leadSuitChanged` | `{ suit }` | Lead suit set |
| `dealt` | `undefined` | Cards dealt |
| `reaction` | `ReactionData` | Player reaction |
| `chatMessage` | `ChatMessage` | Chat message |
| `chatError` | `{ error }` | Chat error |
| `roundComplete` | `{ players }` | Round finished |
| `gameComplete` | `{ winner, players }` | Game finished |
| `gameInstanceStarted` | `{ gameId, modeId }` | GameInstance started |
| `gameInstanceStopped` | `{ gameId, modeId }` | GameInstance stopped |

**Network Events** (`network:*`) — Published by NetworkService:
| Event | Payload | When |
|-------|---------|------|
| `connected` | `undefined` | Client connected |
| `connectionFailed` | `{ error }` | Connection failed |
| `disconnected` | `{ code, wasUnexpected }` | Disconnected from room |
| `reconnecting` | `{ attempt }` | Reconnection attempt |
| `reconnected` | `{ message }` | Successfully reconnected |
| `reconnectionFailed` | `{ message }` | All reconnect attempts failed |
| `connectionQualityChange` | `{ quality, connected }` | Connection quality changed |
| `error` | `{ code, message }` | Room error |

**Lobby Events** (`lobby:*`) — Published by NetworkService:
| Event | Payload | When |
|-------|---------|------|
| `seated` | `{ seatIndex, roomCode }` | Player assigned seat |
| `playerJoined` | `{ player }` | Player joined room |
| `playerRemoved` | `{ player }` | Player left room |
| `playerReady` | `{ playerId, isReady }` | Ready status changed |
| `playerConnectionChanged` | `{ playerId, isConnected }` | Connection status changed |
| `playerLeft` | `{ name }` | Player left (server message) |
| `createRoomFailed` | `{ error }` | Room creation failed |
| `joinRoomFailed` | `{ error }` | Room join failed |

### Publishing

```typescript
const eventBus = ServiceLocator.get<EventBus>('eventBus');
eventBus.publishGameEvent('phaseChanged', { phase: 'bidding' });
eventBus.publishNetworkEvent('connected');
eventBus.publishLobbyEvent('seated', { seatIndex: 0, roomCode: 'ABC123' });
```

### Subscribing

**Direct subscription** (manual cleanup required):

```typescript
eventBus.onGameEvent('phaseChanged', ({ phase }) => { ... });
```

**ScopedEventBus** (auto-cleanup on scene shutdown -- preferred in scenes):

```typescript
// In a Phaser scene's create():
const eventBus = ServiceLocator.get<EventBus>('eventBus');
const scopedEvents = eventBus.subscribeTo(this); // binds to scene lifecycle

scopedEvents.onGameEvent('phaseChanged', ({ phase }) => { ... });
scopedEvents.onNetworkEvent('reconnecting', ({ attempt }) => { ... });
scopedEvents.onLobbyEvent('playerJoined', () => { ... });
// All listeners auto-removed when scene shuts down. No manual cleanup.
```

---

## Game + Mode System

### BaseGame

Abstract class defining a card game's identity. All games extend this.

**Properties**: `id`, `name`, `minPlayers`, `maxPlayers`, `description`

**Methods to implement**:

| Method                                 | Purpose                                          |
| -------------------------------------- | ------------------------------------------------ |
| `getPlayAreaConfig()`                  | Play area type and positions count               |
| `getPlayerPositions()`                 | Player seat positions (x, y, rotation)           |
| `getUIConfig()`                        | UI feature flags (showBidding, showTricks, etc.) |
| `validateMove(card, state)`            | Is this card legal to play?                      |
| `getValidMoves(hand, leadSuit, trick)` | Which cards can be played?                       |
| `calculateScore(player, state)`        | Calculate player score                           |
| `shouldEndRound(state)`                | Should the round end?                            |
| `shouldEndGame(state)`                 | Should the game end?                             |
| `getAIMove(hand, state)`               | AI card selection                                |
| `getAIBid(hand)`                       | AI bid calculation                               |
| `getPhases()`                          | Game phases with UI flags                        |
| `getActionPanels()`                    | Action panels to show per phase                  |
| `getCardPlayHandler()`                 | Card play rendering style                        |

**Default implementations**: `getWinner()` (highest score), `getCardPlayHandler()` (trick-based).

### BaseMode

Abstract class defining how a game is played. All modes extend this.

**Properties**: `id`, `name`, `requiresNetwork`

**Methods to implement**:

| Method                            | Purpose                    |
| --------------------------------- | -------------------------- |
| `initialize(game, scene?, data?)` | Setup mode with game rules |
| `cleanup()`                       | Teardown                   |
| `startGame()`                     | Begin gameplay             |
| `sendMove(card)`                  | Player plays a card        |
| `sendBid(bid)`                    | Player places a bid        |
| `getPlayers()`                    | Current player data        |
| `getCurrentPlayer()`              | Local player data          |
| `getGameState()`                  | Full game state snapshot   |

### GameInstance

Coordinates a game + mode pair. Singleton access via `GameInstance.getCurrent()` / `GameInstance.requireCurrent()`.

```typescript
// Created in GameScene.init():
const game = new CallBreakGame();
const mode = new MultiplayerMode();
const instance = new GameInstance(game, mode, scene, data);

// Started in GameScene.create():
await instance.start(); // calls mode.initialize(game, scene, data)

// Stopped when returning to menu:
await instance.stop(); // calls mode.cleanup()
```

---

## NetworkService

Single service handling all Colyseus networking. Absorbs the old `ConnectionManager`, `RoomManager`, `ConnectionMonitor`, and `ReconnectionHandler`.

**Room operations**:

```typescript
const network = ServiceLocator.get<NetworkService>('network');
await network.createRoom('call_break', userId, playerName);
await network.joinRoom('call_break', roomCode, userId, playerName);
network.send('bid', { bid: 3 });
network.send('playCard', { cardId: 'spades-A' });
network.send('ready');
network.disconnect();
```

**State queries**:

```typescript
network.getRoom(); // Room | null
network.isConnected(); // boolean
network.isReconnecting(); // boolean
network.getConnectionQuality(); // 'good' | 'fair' | 'poor' | 'offline'
```

**Auto-reconnection**: On unexpected disconnect (code != 1000 and != 4000), retries up to 3 times with exponential backoff (2s, 4s, 8s). On success, re-attaches all room event listeners to the new room object.

**Connection monitoring**: Tracks time since last server activity. Updates quality every 2s:

- `< 5s` -> good
- `5-10s` -> fair
- `10-15s` -> poor
- `> 15s` -> offline

All events are published to EventBus. No component needs to know about Colyseus directly.

---

## Scene Flow

```
BootScene -> MenuScene -> LobbyScene -> GameScene <-> UIScene
                |                          ^
            (Solo: directly to GameScene)
```

### GameScene

- `init(data)`: Creates `GameInstance` by looking up game/mode from registries based on `data.isMultiplayer`
- `create()`: Creates background, table, trick area, then calls `initializeGameMode()`
- `initializeGameMode()`: Creates players from mode data, sets up `ScopedEventBus` listeners, launches `UIScene`, starts `GameInstance`
- Listens to mode events (`TURN_CHANGED`, `CARD_PLAYED`, `TRICK_COMPLETE`, `GAME_COMPLETE`) for animations/sounds
- Listens to network events (`reconnecting`, `reconnected`, `reconnectionFailed`, `connectionQualityChange`) for connection UI

### LobbyScene

- Gets `NetworkService` and `EventBus` from `ServiceLocator`
- Uses XState `lobbyMachine` for state management (menu -> creating/joining -> waiting -> transitioning)
- Subscribes to lobby/game/network events via `ScopedEventBus`
- Transitions to `GameScene` with `{ isMultiplayer: true }` -- no networkManager in scene data

### UIScene

- Receives `GameInstance` via scene data
- Gets `mode` from `gameInstance.getMode()`
- Creates scoreboard, modals (bidding, round, game over, settings)
- Listens to mode events for UI updates
- Delegates actions (continue, restart, return to menu) back to `GameScene`

---

## How to Add a New Card Game

1. **Create game class** in `src/games/<gamename>/`:

```typescript
// src/games/mindi/MindiGame.ts
import { BaseGame, type PlayAreaConfig, ... } from '../BaseGame';

export class MindiGame extends BaseGame {
  readonly id = 'mindi';
  readonly name = 'Mindi';
  readonly minPlayers = 4;
  readonly maxPlayers = 6;

  getPlayAreaConfig(): PlayAreaConfig {
    return { type: 'trick', positions: 6 };
  }

  getPlayerPositions(): PlayerPositionConfig[] {
    // Return positions for up to 6 players
  }

  getUIConfig(): GameUIConfig {
    return { showBidding: false, showTricks: true, showScoreboard: true, cardBackStyle: 'mindi-back' };
  }

  // Implement all abstract methods: validateMove, getValidMoves, calculateScore,
  // shouldEndRound, shouldEndGame, getAIMove, getAIBid, getPhases, getActionPanels

  getPhases(): GamePhaseConfig[] {
    return [
      { id: 'dealing', label: 'Dealing', hasUI: false },
      { id: 'trumpSelect', label: 'Trump Selection', hasUI: true },
      { id: 'playing', label: 'Playing', hasUI: false },
      { id: 'roundEnd', label: 'Round End', hasUI: true },
      { id: 'gameOver', label: 'Game Over', hasUI: true },
    ];
  }

  getActionPanels(): ActionPanelConfig[] {
    return [{ type: 'trump-select', showDuring: 'trumpSelect' }];
  }
}
```

2. **Register in `src/main.ts`**:

```typescript
import { MindiGame } from './games/mindi/MindiGame';
GameRegistry.register('mindi', MindiGame);
```

3. **Add server room** in `packages/server/` if multiplayer is needed.

4. **Update MenuScene** to offer the new game as a selection option.

No changes needed to: `GameScene`, `LobbyScene`, `UIScene`, `NetworkService`, `EventBus`, modes.

---

## How to Add a New Game Mode

1. **Create mode class** in `src/modes/`:

```typescript
// src/modes/TournamentMode.ts
import { BaseMode } from './BaseMode';

export class TournamentMode extends BaseMode {
  readonly id = 'tournament';
  readonly name = 'Tournament';
  readonly requiresNetwork = true;

  async initialize(game: BaseGame, scene?: any, data?: any): Promise<void> {
    this.game = game;
    // Setup tournament-specific state
  }

  async cleanup(): Promise<void> { ... }
  async startGame(): Promise<void> { ... }
  sendMove(card: CardData): void { ... }
  sendBid(bid: number): void { ... }
  getPlayers(): PlayerData[] { ... }
  getCurrentPlayer(): PlayerData | null { ... }
  getGameState(): GameState { ... }
}
```

2. **Register in `src/main.ts`**:

```typescript
ModeRegistry.register('tournament', TournamentMode);
```

3. **Update MenuScene** to offer the new mode.

Works with all registered games automatically.

---

## How to Add a New Event

1. **Add to the typed event map** in `src/services/EventBus.ts`:

```typescript
export interface GameEventMap {
  // existing events...
  myNewEvent: { someField: string; anotherField: number };
}
```

2. **Publish** from wherever the event originates:

```typescript
eventBus.publishGameEvent('myNewEvent', { someField: 'val', anotherField: 42 });
```

3. **Subscribe** in any scene or component:

```typescript
scopedEvents.onGameEvent('myNewEvent', ({ someField, anotherField }) => {
  // handle
});
```

For network or lobby events, use `NetworkEventMap`/`LobbyEventMap` and the corresponding publish/subscribe methods.

---

## How to Send a New Message to the Server

1. **Send via NetworkService**:

```typescript
const network = ServiceLocator.get<NetworkService>('network');
network.send('myMessageType', { key: 'value' });
```

2. **Listen for server responses** by adding a listener in `NetworkService.setupRoomEventPublishers()`:

```typescript
this.room.onMessage('myResponse', (data) => {
  this.eventBus.publishGameEvent('myResponseEvent', data);
});
```

3. **Add the event type** to `GameEventMap` (or whichever map fits) and subscribe where needed.

---

## How to Add a New UI Component to GameScene

1. **Create component** in `src/components/game/` (modal, panel, or overlay).

2. **Instantiate in GameScene** or UIScene's `create()` method.

3. **Wire to events** using `ScopedEventBus`:

```typescript
this.scopedEvents.onGameEvent('someEvent', (data) => {
  this.myComponent.update(data);
});
```

---

## Key Types (`type.d.ts`)

```typescript
interface PlayerData {
  id: string;
  name: string;
  emoji: string;
  seatIndex: number;
  isReady: boolean;
  isConnected: boolean;
  isBot: boolean;
  bid: number;
  tricksWon: number;
  score: number;
  roundScore: number;
  isLocal: boolean;
  hand?: CardData[];
}

interface CardData {
  suit: Suit;
  rank: Rank;
  id: string;
  value: number;
}

interface GameState {
  phase: string;
  currentRound: number;
  currentTurn: string;
  leadSuit: Suit | null;
  trickNumber: number;
  currentTrick: any[];
  players: PlayerData[];
  currentPlayer: PlayerData;
}

type ConnectionQuality = 'good' | 'fair' | 'poor' | 'offline';
```

---

## Conventions

- **Services** are singletons accessed via `ServiceLocator.get<T>(key)`.
- **Scenes** use `ScopedEventBus` (`eventBus.subscribeTo(this)`) for auto-cleanup.
- **Modes** extend `Phaser.Events.EventEmitter` and forward EventBus events as local emits for scenes to consume.
- **Games** are pure logic -- no Phaser dependencies, no network awareness.
- **Scene data passing** is minimal: only `{ isMultiplayer: boolean }` from Lobby to GameScene, and `{ gameInstance }` from GameScene to UIScene.
- Types live in `type.d.ts` (client) and `packages/shared/src/types/` (shared).
- Game constants (suits, ranks, events) are in `utils/constants.ts`.
- Shared game logic (validation, scoring, bot AI) lives in `packages/shared/`.
