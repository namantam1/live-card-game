# Game Framework Architecture

## Overview

This document describes a scalable, pluggable architecture for supporting multiple card games (Call Break, Mindi, etc.) and game modes (Solo, Multiplayer, Tournament) in a Phaser 3 application.

**Key Principles:**

- **Separation of Concerns**: Clear boundaries between framework, games, modes, and rendering
- **Event-Driven**: Central event bus eliminates forwarding chains
- **Service-Oriented**: Global services accessible via Service Locator pattern
- **Pluggable**: Adding new games/modes = "switch in socket" - minimal code changes
- **Generic Scenes**: Scenes work for ANY game/mode combination

**Inspired by:**

- [Figma's Multiplayer Architecture](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [Discord's Real-Time Architecture](https://medium.com/@yadavmpadiyar/discord-real-time-architecture-at-internet-scale-bef4be6b7198)
- [Game Programming Patterns: Event Queue](https://gameprogrammingpatterns.com/event-queue.html)
- Unity/Unreal/Godot game frameworks

---

## Problems Solved

This architecture addresses critical issues in the current implementation that prevent scalability and maintainability.

### 1. **Misleading Naming and Responsibility Confusion**

**Current Problem:**

```typescript
// NetworkManager.ts - line 14
export default class NetworkManager {
  private connectionManager: ConnectionManager;
  private connectionMonitor: ConnectionMonitor;
  private reconnectionHandler: ReconnectionHandler;
  private roomManager: RoomManager;
```

- **NetworkManager** is actually a **Facade/Coordinator**, not a manager
- It manages nothing - just forwards calls to 4 other managers
- Name implies it handles network operations, but it's just a proxy layer
- Creates confusion about responsibility boundaries

**Solution:**

```typescript
// Clear, single-responsibility services
EventBus.getInstance(); // Pub/sub message broker
NetworkService; // Actual network operations
ServiceLocator.get('network'); // Global access, no facades
```

**Impact:** Clear naming = clear responsibility. No confusion about what each component does.

---

### 2. **Event Forwarding Hell (4-Layer Chain)**

**Current Problem:**

Trace a single `playerReaction` event through the system:

```
1. Colyseus Room: onMessage('playerReaction')
   ↓
2. RoomManager (line 109): emit('message:playerReaction', data)
   ↓
3. NetworkManager (line 224): on('message:playerReaction') → emit to MultiplayerGameMode
   ↓
4. MultiplayerGameMode (line 224): emit(EVENTS.REACTION, data)
   ↓
5. UIScene: Finally consumes the event
```

**4 layers of forwarding for a simple message!**

Each layer:

- Adds latency
- Increases debugging complexity
- Creates tight coupling
- Requires maintenance if event changes

**Solution:**

```typescript
// Direct pub/sub - ONE event emission
NetworkService.setupRoomEventPublishers() {
  this.room.onMessage('playerReaction', (data) => {
    this.eventBus.publishGameEvent('reaction', data);  // DONE!
  });
}

// Any component subscribes directly
UIScene.create() {
  this.eventBus.onGameEvent('reaction', (data) => {
    this.handleReaction(data);
  });
}
```

**Impact:** 1 hop instead of 4. Event travels: Colyseus → EventBus → Subscriber. That's it.

---

### 3. **Massive Code Duplication**

**Current Problem:**

`getPlayers()` exists in **TWO** places with identical logic:

```typescript
// RoomManager.ts:228-248 (20 lines)
getPlayers(): PlayerData[] {
  if (!this.room?.state?.players) return [];
  const players: PlayerData[] = [];
  this.room.state.players.forEach((player: PlayerSchema) => {
    players.push({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      // ... 15 more lines
    });
  });
  return players.sort((a, b) => a.seatIndex - b.seatIndex);
}

// MultiplayerGameMode.ts:111-137 (EXACT SAME CODE - 26 lines)
getPlayers(): PlayerData[] {
  // Identical implementation duplicated!
}
```

**Why does this exist twice?** No good reason. Pure duplication.

**Solution:**

```typescript
// ONE place - MultiplayerMode
getPlayers(): PlayerData[] {
  const room = this.networkService.getRoom();
  // ... implementation ONCE
}
```

**Impact:** DRY principle restored. Bug fixes in one place, not two.

---

### 4. **NetworkManager as Glorified Proxy**

**Current Problem:**

Every "send" method just forwards to RoomManager:

```typescript
// NetworkManager.ts:213-261
sendReady(): void {
  this.roomManager.send('ready');
}

sendBid(bid: number): void {
  this.roomManager.send('bid', { bid });
}

sendPlayCard(cardId: string): void {
  this.roomManager.send('playCard', { cardId });
}

sendNextRound(): void {
  this.roomManager.send('nextRound');
}

sendRestart(): void {
  this.roomManager.send('restart');
}

sendReaction(type: string): void {
  this.roomManager.send('reaction', { type });
}

sendChat(message: string): void {
  if (!message || message.trim().length === 0) {
    console.warn('NetworkManager: Cannot send empty chat message');
    return;
  }
  this.roomManager.send('chat', { message: message.trim() });
}
```

**Every single method = proxy to RoomManager.** Zero value added.

**Solution:**

```typescript
// Direct access
this.networkService.send('bid', { bid });
this.networkService.send('playCard', { cardId });
// No proxy layer needed
```

**Impact:** Removed 50+ lines of proxy code. Direct communication.

---

### 5. **Tight Coupling: Scenes Own Network Infrastructure**

**Current Problem:**

```typescript
// LobbyScene.ts:64
private initializeManagers() {
  this.networkManager = new NetworkManager();  // ❌ Scene creates network
}

// LobbyScene.ts:540
private startGame() {
  this.scene.start('GameScene', {
    networkManager: this.networkManager,  // ❌ Passed through scene data
    isMultiplayer: true,
  });
}

// GameScene.ts:62
init(data: any) {
  this.networkManager = data.networkManager;  // ❌ Scene depends on scene data
}
```

**Problems:**

- LobbyScene is responsible for network infrastructure (violates SRP)
- Network state passed through scene transitions (fragile)
- GameScene must know if game is networked (tight coupling)
- Cannot access network from other components without drilling props

**Solution:**

```typescript
// Anywhere in the app
const network = ServiceLocator.get<NetworkService>('network');
network.send('bid', { bid });

// No scene coupling, no prop drilling
```

**Impact:** Zero coupling between scenes and network. Services accessible globally.

---

### 6. **Game-Specific Scenes (Not Reusable)**

**Current Problem:**

```typescript
// GameScene.ts is "Call Break Game Scene"
// Hardcoded for Call Break only:
- 4 players (fixed)
- Trick-based gameplay (fixed)
- Bidding system (Call Break specific)
- Spades as trump (fixed)

// To add Mindi:
- Need new MindiScene
- Duplicate ALL scene logic
- Maintain TWO codebases
```

**Solution:**

```typescript
// GamePlayScene - works for ANY game
create() {
  const gameInstance = GameInstance.requireCurrent();
  const game = gameInstance.getGame();

  // Render based on game config (not hardcoded!)
  this.createPlayArea(game.getPlayAreaConfig());
  this.createPlayers(game.getPlayerPositions());

  // Works for Call Break, Mindi, Poker, ANY game!
}
```

**Impact:** One scene handles all games. Adding Mindi = zero scene changes.

---

### 7. **No Separation Between Game Type and Game Mode**

**Current Problem:**

Call Break game logic embedded in GameManager:

```typescript
// GameManager.ts contains:
- Card dealing logic (Call Break specific)
- Bidding system (Call Break specific)
- Scoring rules (Call Break specific)
- AI logic (Call Break specific)
- Trump suit (Spades - Call Break specific)
```

**To add Mindi:**

- Need new MindiManager
- Duplicate game flow
- Duplicate state management
- Cannot reuse modes (Solo, Multiplayer) for Mindi

**Solution:**

```typescript
// Separate concerns:
CallBreakGame extends BaseGame {
  // ONLY Call Break rules
  validateMove() { /* Call Break logic */ }
  calculateScore() { /* Call Break scoring */ }
}

MindiGame extends BaseGame {
  // ONLY Mindi rules
  validateMove() { /* Mindi logic */ }
  calculateScore() { /* Mindi scoring */ }
}

// Modes work for BOTH games
SoloMode.initialize(CallBreakGame)    // Solo Call Break
SoloMode.initialize(MindiGame)        // Solo Mindi
MultiplayerMode.initialize(CallBreakGame)  // Online Call Break
MultiplayerMode.initialize(MindiGame)      // Online Mindi
```

**Impact:** N games × M modes = all combinations. No duplication.

---

### 8. **Violation of Single Responsibility Principle**

**Current Problem:**

MultiplayerGameMode does **FIVE** different jobs (605 lines):

```typescript
// MultiplayerGameMode.ts responsibilities:
1. Network state listening (setupRoomStateListeners)
2. Network event forwarding (setupNetworkManagerListeners)
3. Player object creation/manipulation (createPlayers, direct player.removeCard())
4. Game state interpretation (getCurrentRound, getPhase)
5. Data conversion (cardToObject, getCurrentTrick)
```

**Solution:**

Each responsibility in its own component:

```typescript
NetworkService; // 1. Network listening + event publishing
MultiplayerMode; // 2. Game logic interpretation ONLY
GamePlayScene; // 3. Player object creation/rendering
NetworkService.getRoom(); // 4. Direct state access (no wrapper)
// 5. Data conversion inline (no separate adapter)
```

**Impact:** Each file has ONE job. Easy to understand, test, and modify.

---

### 9. **Poor Testability**

**Current Problem:**

```typescript
// To test MultiplayerGameMode:
- Need actual NetworkManager
- Need actual RoomManager
- Need Colyseus Room
- Need Phaser scene
- Need Player objects
- IMPOSSIBLE to unit test in isolation
```

**Solution:**

```typescript
// Test game logic without network/Phaser
const game = new CallBreakGame();
const validMoves = game.getValidMoves(hand, mockState);
expect(validMoves).toContain(expectedCard);

// Test mode with mock service
const mockNetwork = new MockNetworkService();
ServiceLocator.register('network', mockNetwork);
const mode = new MultiplayerMode();
// Easy to test!
```

**Impact:** Every component testable in isolation.

---

### 10. **Scalability Bottleneck**

**Current Problem:**

Adding new features requires changes across 4-5 files:

```typescript
// To add "Spectator Mode":
1. Modify NetworkManager (add methods)
2. Modify RoomManager (add listeners)
3. Modify MultiplayerGameMode (handle spectator state)
4. Modify GameScene (render spectators)
5. Modify UIScene (spectator UI)

// Each change risks breaking existing code
```

**Solution:**

```typescript
// To add "Spectator Mode":
1. Subscribe to events:
   eventBus.onLobbyEvent('spectatorJoined', this.handleSpectator);

// That's it! No changes to existing code.
```

**Impact:** New features = plug into EventBus. Zero impact on existing code.

---

## Summary: Problems → Solutions

| Problem                  | Current State               | New Architecture                |
| ------------------------ | --------------------------- | ------------------------------- |
| **Naming**               | NetworkManager is facade    | NetworkService does actual work |
| **Event forwarding**     | 4-layer chain               | 1 central EventBus              |
| **Duplication**          | getPlayers() in 2 places    | Single implementation           |
| **Proxy pattern**        | 50+ lines of forwarding     | Direct service access           |
| **Scene coupling**       | Scenes create/pass network  | ServiceLocator (global access)  |
| **Game-specific scenes** | GameScene = Call Break only | GamePlayScene = any game        |
| **Game/Mode confusion**  | Mixed in GameManager        | Separated into Game + Mode      |
| **SRP violations**       | 605-line god classes        | <200 line focused classes       |
| **Testing**              | Impossible to unit test     | Easy mocking/injection          |
| **Scalability**          | 5 files per feature         | 1 event subscription            |

**Bottom Line:** This architecture eliminates architectural debt and enables true scalability.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  main.ts → GameApplication.bootstrap()                       │
│  - Initializes Phaser game                                   │
│  - Bootstraps all services                                   │
│  - Registers games and modes                                 │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                             │
│  Global singletons accessible via ServiceLocator            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  EventBus    │  │NetworkService│  │AudioService  │      │
│  │  (pub/sub)   │  │(Colyseus)    │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │PresenceService│  │StorageService│                         │
│  └──────────────┘  └──────────────┘                         │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              GAME FRAMEWORK LAYER                            │
│  Core abstractions and registries                           │
│  ┌────────────────────────────────────────────────┐         │
│  │ GameRegistry (all available games)             │         │
│  │   register('callbreak', CallBreakGame)         │         │
│  │   register('mindi', MindiGame)                 │         │
│  │   get('callbreak') → CallBreakGame class       │         │
│  └────────────────────────────────────────────────┘         │
│  ┌────────────────────────────────────────────────┐         │
│  │ ModeRegistry (all available modes)             │         │
│  │   register('solo', SoloMode)                   │         │
│  │   register('multiplayer', MultiplayerMode)     │         │
│  │   get('solo') → SoloMode class                 │         │
│  └────────────────────────────────────────────────┘         │
│  ┌────────────────────────────────────────────────┐         │
│  │ GameInstance (current active game)             │         │
│  │   - Manages current game session               │         │
│  │   - Coordinates game + mode                    │         │
│  └────────────────────────────────────────────────┘         │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              GAME IMPLEMENTATION LAYER                       │
│  Game-specific rules and logic                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ CallBreakGame   │  │ MindiGame       │                  │
│  │ - Rules         │  │ - Rules         │                  │
│  │ - Scoring       │  │ - Scoring       │                  │
│  │ - Validation    │  │ - Validation    │                  │
│  └─────────────────┘  └─────────────────┘                  │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              MODE IMPLEMENTATION LAYER                       │
│  Mode-specific behavior (works for ALL games)               │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ SoloMode        │  │ MultiplayerMode │                  │
│  │ - AI opponents  │  │ - Network sync  │                  │
│  │ - Local state   │  │ - Room mgmt     │                  │
│  └─────────────────┘  └─────────────────┘                  │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                SCENE LAYER (Generic)                         │
│  Phaser scenes that work for ANY game/mode                  │
│  MenuScene → LobbyScene → GamePlayScene → ResultScene       │
│  - Render based on game config                              │
│  - Subscribe to game events via EventBus                    │
│  - NO game-specific logic                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Service Layer

#### ServiceLocator Pattern

Global services are registered once at bootstrap and accessible anywhere.

```typescript
// src/core/ServiceLocator.ts
export class ServiceLocator {
  private static services: Map<string, any> = new Map();

  static register<T>(name: string, instance: T): void {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} already registered`);
    }
    this.services.set(name, instance);
  }

  static get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found. Did you register it?`);
    }
    return service as T;
  }

  static has(name: string): boolean {
    return this.services.has(name);
  }

  static clear(): void {
    this.services.clear();
  }
}
```

**Usage:**

```typescript
// Bootstrap (main.ts)
ServiceLocator.register('eventBus', new EventBus());
ServiceLocator.register('network', new NetworkService());

// Anywhere in code
const eventBus = ServiceLocator.get<EventBus>('eventBus');
const network = ServiceLocator.get<NetworkService>('network');
```

#### EventBus Service

Central pub/sub message broker - eliminates event forwarding chains.

Uses **typed event maps** for compile-time safety on event names and data payloads.
Includes **ScopedEventBus** helper for automatic listener cleanup on scene shutdown.

```typescript
// src/services/EventBus.ts
import Phaser from 'phaser';
import type {
  CardData,
  PlayerData,
  ConnectionQuality,
  ReactionData,
} from '../types';
import type { ChatMessage } from '@call-break/shared';

// ===== Typed Event Maps =====

export interface GameEventMap {
  phaseChanged: { phase: string };
  cardPlayed: { playerId: string; card: CardData };
  turnChanged: { playerId: string };
  trickComplete: { winnerId: string };
  bidPlaced: { playerId: string; bid: number };
  trickCleared: undefined;
  roundChanged: { round: number };
  leadSuitChanged: { suit: string };
  dealt: undefined;
  reaction: ReactionData;
  chatMessage: ChatMessage;
  chatError: { error: string };
  roundComplete: { players: PlayerData[] };
  gameComplete: { winner: PlayerData; players: PlayerData[] };
  gameInstanceStarted: { gameId: string; modeId: string };
  gameInstanceStopped: { gameId: string; modeId: string };
}

export interface NetworkEventMap {
  connected: undefined;
  connectionFailed: { error: any };
  disconnected: { code: number; wasUnexpected: boolean };
  reconnecting: { attempt: number };
  reconnected: { message: string };
  reconnectionFailed: { message: string };
  connectionQualityChange: { quality: ConnectionQuality; connected: boolean };
  error: { code: number; message: string };
}

export interface LobbyEventMap {
  seated: { seatIndex: number; roomCode: string };
  playerJoined: { player: any };
  playerRemoved: { player: any };
  playerReady: { playerId: string; isReady: boolean };
  playerConnectionChanged: { playerId: string; isConnected: boolean };
  playerLeft: { name: string };
  createRoomFailed: { error: any };
  joinRoomFailed: { error: any };
}

/**
 * Central event bus for all game/network events
 * Pattern: Pub/Sub Message Broker
 *
 * Publishers: NetworkService, GameInstance, SoloMode
 * Subscribers: Scenes, UI components, game modes
 *
 * Uses typed event maps for compile-time safety.
 */
export class EventBus extends Phaser.Events.EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // Network events (published by NetworkService)
  publishNetworkEvent<K extends keyof NetworkEventMap>(
    event: K,
    data?: NetworkEventMap[K]
  ): void {
    this.emit(`network:${event}`, data);
  }

  onNetworkEvent<K extends keyof NetworkEventMap>(
    event: K,
    callback: (data: NetworkEventMap[K]) => void,
    context?: any
  ): void {
    this.on(`network:${event}`, callback, context);
  }

  // Game events (published by GameInstance/Game modes)
  publishGameEvent<K extends keyof GameEventMap>(
    event: K,
    data?: GameEventMap[K]
  ): void {
    this.emit(`game:${event}`, data);
  }

  onGameEvent<K extends keyof GameEventMap>(
    event: K,
    callback: (data: GameEventMap[K]) => void,
    context?: any
  ): void {
    this.on(`game:${event}`, callback, context);
  }

  // Lobby events (published by NetworkService)
  publishLobbyEvent<K extends keyof LobbyEventMap>(
    event: K,
    data?: LobbyEventMap[K]
  ): void {
    this.emit(`lobby:${event}`, data);
  }

  onLobbyEvent<K extends keyof LobbyEventMap>(
    event: K,
    callback: (data: LobbyEventMap[K]) => void,
    context?: any
  ): void {
    this.on(`lobby:${event}`, callback, context);
  }

  /**
   * Create a scoped event subscription tied to a Phaser scene.
   * All listeners registered through the returned ScopedEventBus
   * are automatically removed when the scene shuts down.
   */
  subscribeTo(scene: Phaser.Scene): ScopedEventBus {
    return new ScopedEventBus(this, scene);
  }

  // Cleanup
  destroy(): void {
    this.removeAllListeners();
  }
}

/**
 * Scene-scoped event bus wrapper.
 * Automatically cleans up all listeners when the scene shuts down.
 * Prevents memory leaks and ghost handlers from orphaned scenes.
 *
 * Usage:
 *   const events = eventBus.subscribeTo(this);
 *   events.onGameEvent('phaseChanged', (data) => { ... });
 *   // No manual cleanup needed — auto-removed on scene shutdown
 */
export class ScopedEventBus {
  private listeners: Array<{ event: string; fn: Function }> = [];

  constructor(
    private bus: EventBus,
    private scene: Phaser.Scene
  ) {
    scene.events.once('shutdown', () => this.removeAll());
  }

  onGameEvent<K extends keyof GameEventMap>(
    event: K,
    callback: (data: GameEventMap[K]) => void
  ): void {
    const fullEvent = `game:${event}`;
    this.bus.on(fullEvent, callback, this.scene);
    this.listeners.push({ event: fullEvent, fn: callback });
  }

  onNetworkEvent<K extends keyof NetworkEventMap>(
    event: K,
    callback: (data: NetworkEventMap[K]) => void
  ): void {
    const fullEvent = `network:${event}`;
    this.bus.on(fullEvent, callback, this.scene);
    this.listeners.push({ event: fullEvent, fn: callback });
  }

  onLobbyEvent<K extends keyof LobbyEventMap>(
    event: K,
    callback: (data: LobbyEventMap[K]) => void
  ): void {
    const fullEvent = `lobby:${event}`;
    this.bus.on(fullEvent, callback, this.scene);
    this.listeners.push({ event: fullEvent, fn: callback });
  }

  removeAll(): void {
    for (const { event, fn } of this.listeners) {
      this.bus.removeListener(event, fn as any, this.scene);
    }
    this.listeners = [];
  }
}
```

**Event Flow Example:**

```
ColyseusClient receives state change
    ↓
NetworkService.setupRoomEventPublishers()
    ↓
eventBus.publishGameEvent('phaseChanged', { phase: 'bidding' })
    ↓
Multiple subscribers receive event:
    - GamePlayScene.onPhaseChanged()
    - UIScene.updateUI()
    - GameInstance.handlePhaseChange()
```

#### NetworkService

Manages Colyseus connection, publishes all network events to EventBus.
Includes **connection monitoring** (heartbeat-based quality detection) and
**automatic reconnection** (retry with exponential backoff) — absorbing the
responsibilities of the current `ConnectionManager`, `ConnectionMonitor`, and
`ReconnectionHandler` into a single service.

```typescript
// src/services/NetworkService.ts
import { Client, Room, getStateCallbacks } from '@colyseus/sdk';
import { ServiceLocator } from '../core/ServiceLocator';
import type { EventBus } from './EventBus';
import type { ConnectionQuality } from '../types';

/**
 * Network service - manages Colyseus connection
 * Responsibilities:
 *   - Server connection lifecycle
 *   - Room create/join/leave
 *   - Publish ALL room events to EventBus
 *   - Connection quality monitoring (heartbeat-based)
 *   - Automatic reconnection with exponential backoff
 *
 * Absorbs: ConnectionManager, ConnectionMonitor, ReconnectionHandler
 * NO game logic, NO scene coupling
 */
export class NetworkService {
  private client: Client | null = null;
  private room: Room | null = null;
  private eventBus!: EventBus;
  private serverUrl: string = '';

  // Reconnection state
  private reconnectionToken: string | null = null;
  private reconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxReconnectAttempts = 3;
  private readonly reconnectBaseDelay = 2000; // ms, doubles each attempt

  // Connection monitoring state
  private connectionQuality: ConnectionQuality = 'good';
  private lastActivityTime: number = Date.now();
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private readonly activityTimeout = 5000; // ms

  async initialize(serverUrl: string): Promise<void> {
    this.eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.serverUrl = serverUrl;

    try {
      this.client = new Client(serverUrl);
      this.eventBus.publishNetworkEvent('connected');
    } catch (error) {
      this.eventBus.publishNetworkEvent('connectionFailed', { error });
      throw error;
    }
  }

  // ===== Room Operations =====

  async createRoom(
    gameType: string,
    userId: string,
    playerName: string
  ): Promise<Room | null> {
    if (!this.client) throw new Error('Not connected to server');

    try {
      this.room = await this.client.create(gameType, {
        userId,
        name: playerName,
      });
      this.reconnectionToken = this.room.reconnectionToken;
      this.setupRoomEventPublishers();
      this.startConnectionMonitor();
      return this.room;
    } catch (error) {
      this.eventBus.publishLobbyEvent('createRoomFailed', { error });
      return null;
    }
  }

  async joinRoom(
    gameType: string,
    roomCode: string,
    userId: string,
    playerName: string
  ): Promise<Room | null> {
    if (!this.client) throw new Error('Not connected to server');

    try {
      this.room = await this.client.join(gameType, {
        roomCode,
        userId,
        name: playerName,
      });
      this.reconnectionToken = this.room.reconnectionToken;
      this.setupRoomEventPublishers();
      this.startConnectionMonitor();
      return this.room;
    } catch (error) {
      this.eventBus.publishLobbyEvent('joinRoomFailed', { error });
      throw error;
    }
  }

  send(type: string, data?: any): void {
    if (!this.room) {
      console.warn(`NetworkService: Cannot send ${type} - no room`);
      return;
    }
    this.room.send(type, data);
  }

  getRoom(): Room | null {
    return this.room;
  }

  isConnected(): boolean {
    return this.room !== null;
  }

  isReconnecting(): boolean {
    return this.reconnecting;
  }

  getConnectionQuality(): ConnectionQuality {
    return this.connectionQuality;
  }

  // ===== Connection Monitor =====
  // Absorbed from ConnectionMonitor.ts
  // Tracks time since last server activity to detect connection quality.

  private startConnectionMonitor(): void {
    this.stopConnectionMonitor();
    this.lastActivityTime = Date.now();
    this.setQuality('good');

    this.monitorInterval = setInterval(() => {
      const elapsed = Date.now() - this.lastActivityTime;

      if (elapsed > this.activityTimeout * 3) {
        this.setQuality('offline');
      } else if (elapsed > this.activityTimeout * 2) {
        this.setQuality('poor');
      } else if (elapsed > this.activityTimeout) {
        this.setQuality('fair');
      } else {
        this.setQuality('good');
      }
    }, 2000);
  }

  private stopConnectionMonitor(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  private setQuality(quality: ConnectionQuality): void {
    if (this.connectionQuality !== quality) {
      this.connectionQuality = quality;
      this.eventBus.publishNetworkEvent('connectionQualityChange', {
        quality,
        connected: quality !== 'offline',
      });
    }
  }

  // ===== Automatic Reconnection =====
  // Absorbed from ReconnectionHandler.ts
  // On unexpected disconnect: retries up to 3 times with exponential backoff.
  // On success: re-attaches all room listeners to the NEW room object.

  private async handleUnexpectedDisconnect(): Promise<void> {
    if (this.reconnecting || !this.client || !this.reconnectionToken) return;

    this.reconnecting = true;
    this.reconnectAttempts = 0;
    this.stopConnectionMonitor();
    this.setQuality('offline');

    await this.attemptReconnection();
  }

  private async attemptReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.reconnecting = false;
      this.reconnectionToken = null;
      this.eventBus.publishNetworkEvent('reconnectionFailed', {
        message: 'Could not reconnect to the game',
      });
      return;
    }

    this.reconnectAttempts++;
    this.eventBus.publishNetworkEvent('reconnecting', {
      attempt: this.reconnectAttempts,
    });

    try {
      const room = await this.client!.reconnect(this.reconnectionToken!);

      // Success — update state
      this.room = room;
      this.reconnectionToken = room.reconnectionToken;
      this.reconnecting = false;
      this.reconnectAttempts = 0;

      // CRITICAL: Re-attach all room listeners to the NEW room object
      this.setupRoomEventPublishers();
      this.startConnectionMonitor();
      this.setQuality('good');

      this.eventBus.publishNetworkEvent('reconnected', {
        message: 'Reconnected to game',
      });
    } catch (error) {
      // Retry with exponential backoff
      const delay =
        this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1);

      this.reconnectTimer = setTimeout(() => {
        this.attemptReconnection();
      }, delay);
    }
  }

  private cancelReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
    this.reconnectAttempts = 0;
  }

  // ===== Room Event Publishers =====

  /**
   * Setup room listeners — ONLY publish to EventBus.
   * Any component can subscribe to what they need.
   *
   * IMPORTANT: This method is called after initial join AND after
   * successful reconnection (to re-attach to the new room object).
   */
  private setupRoomEventPublishers(): void {
    if (!this.room) return;

    const $ = getStateCallbacks(this.room);

    // Record activity on ANY state change (for connection monitor)
    this.room.onStateChange(() => {
      this.recordActivity();
    });

    // Publish game state changes
    $(this.room.state).listen('phase', (value: string) => {
      this.eventBus.publishGameEvent('phaseChanged', { phase: value });
    });

    $(this.room.state).listen('currentTurn', (playerId: string) => {
      this.eventBus.publishGameEvent('turnChanged', { playerId });
    });

    $(this.room.state).listen('trickWinner', (winnerId: string) => {
      this.eventBus.publishGameEvent('trickComplete', { winnerId });
    });

    $(this.room.state).listen('currentRound', (round: number) => {
      this.eventBus.publishGameEvent('roundChanged', { round });
    });

    $(this.room.state).listen('leadSuit', (suit: string) => {
      this.eventBus.publishGameEvent('leadSuitChanged', { suit });
    });

    // Current trick
    $(this.room.state).currentTrick.onAdd((entry: any) => {
      this.eventBus.publishGameEvent('cardPlayed', {
        playerId: entry.playerId,
        card: entry.card,
      });
    });

    $(this.room.state).currentTrick.onRemove(() => {
      this.eventBus.publishGameEvent('trickCleared');
    });

    // Publish lobby events
    $(this.room.state).players.onAdd((player: any) => {
      this.eventBus.publishLobbyEvent('playerJoined', { player });

      $(player).listen('bid', (bid: number) => {
        this.eventBus.publishGameEvent('bidPlaced', {
          playerId: player.id,
          bid,
        });
      });

      $(player).listen('isReady', (isReady: boolean) => {
        this.eventBus.publishLobbyEvent('playerReady', {
          playerId: player.id,
          isReady,
        });
      });

      $(player).listen('isConnected', (isConnected: boolean) => {
        this.eventBus.publishLobbyEvent('playerConnectionChanged', {
          playerId: player.id,
          isConnected,
        });
      });
    });

    $(this.room.state).players.onRemove((player: any) => {
      this.eventBus.publishLobbyEvent('playerRemoved', { player });
    });

    // Publish network messages
    this.room.onMessage('seated', (data) => {
      this.eventBus.publishLobbyEvent('seated', data);
    });

    this.room.onMessage('dealt', () => {
      this.eventBus.publishGameEvent('dealt');
    });

    this.room.onMessage('playerReaction', (data) => {
      this.eventBus.publishGameEvent('reaction', data);
    });

    this.room.onMessage('chatMessage', (data) => {
      this.eventBus.publishGameEvent('chatMessage', data);
    });

    this.room.onMessage('chatError', (data) => {
      this.eventBus.publishGameEvent('chatError', data);
    });

    this.room.onMessage('playerLeft', (data) => {
      this.eventBus.publishLobbyEvent('playerLeft', data);
    });

    // Publish connection events
    this.room.onError((code, message) => {
      this.eventBus.publishNetworkEvent('error', { code, message });
    });

    // CRITICAL: Handle unexpected disconnect → auto-reconnect
    this.room.onLeave((code) => {
      const wasUnexpected = code !== 1000 && code !== 4000;
      this.eventBus.publishNetworkEvent('disconnected', {
        code,
        wasUnexpected,
      });

      if (wasUnexpected) {
        this.handleUnexpectedDisconnect();
      } else {
        this.stopConnectionMonitor();
        this.cleanupRoom();
      }
    });
  }

  // ===== Cleanup =====

  private cleanupRoom(): void {
    this.room = null;
    this.reconnectionToken = null;
  }

  disconnect(): void {
    this.cancelReconnection();
    this.stopConnectionMonitor();
    this.room?.leave();
    this.cleanupRoom();
  }

  destroy(): void {
    this.disconnect();
    this.client = null;
  }
}
```

---

### 2. Game Framework Layer

#### GameRegistry

Registry of all available games in the application.

```typescript
// src/core/GameRegistry.ts
import type { BaseGame } from '../games/BaseGame';

/**
 * Registry of all available games
 * Games are registered at bootstrap in main.ts
 */
export class GameRegistry {
  private static games: Map<string, typeof BaseGame> = new Map();

  static register(id: string, gameClass: typeof BaseGame): void {
    if (this.games.has(id)) {
      throw new Error(`Game ${id} already registered`);
    }
    this.games.set(id, gameClass);
  }

  static get(id: string): typeof BaseGame {
    const game = this.games.get(id);
    if (!game) {
      throw new Error(
        `Game ${id} not found. Available games: ${this.getAvailableGames()}`
      );
    }
    return game;
  }

  static has(id: string): boolean {
    return this.games.has(id);
  }

  static getAll(): Array<{ id: string; game: typeof BaseGame }> {
    return Array.from(this.games.entries()).map(([id, game]) => ({ id, game }));
  }

  static getAvailableGames(): string[] {
    return Array.from(this.games.keys());
  }

  static clear(): void {
    this.games.clear();
  }
}
```

#### ModeRegistry

Registry of all available game modes.

```typescript
// src/core/ModeRegistry.ts
import type { BaseMode } from '../modes/BaseMode';

/**
 * Registry of all available game modes
 * Modes are registered at bootstrap in main.ts
 */
export class ModeRegistry {
  private static modes: Map<string, typeof BaseMode> = new Map();

  static register(id: string, modeClass: typeof BaseMode): void {
    if (this.modes.has(id)) {
      throw new Error(`Mode ${id} already registered`);
    }
    this.modes.set(id, modeClass);
  }

  static get(id: string): typeof BaseMode {
    const mode = this.modes.get(id);
    if (!mode) {
      throw new Error(
        `Mode ${id} not found. Available modes: ${this.getAvailableModes()}`
      );
    }
    return mode;
  }

  static has(id: string): boolean {
    return this.modes.has(id);
  }

  static getAll(): Array<{ id: string; mode: typeof BaseMode }> {
    return Array.from(this.modes.entries()).map(([id, mode]) => ({ id, mode }));
  }

  static getAvailableModes(): string[] {
    return Array.from(this.modes.keys());
  }

  static clear(): void {
    this.modes.clear();
  }
}
```

#### GameInstance

Manages the current active game session - coordinates game and mode.

```typescript
// src/core/GameInstance.ts
import type { BaseGame } from '../games/BaseGame';
import type { BaseMode } from '../modes/BaseMode';
import { ServiceLocator } from './ServiceLocator';
import type { EventBus } from '../services/EventBus';

/**
 * Represents the current active game session
 * Coordinates between game rules and game mode
 */
export class GameInstance {
  private static currentInstance: GameInstance | null = null;

  private game: BaseGame;
  private mode: BaseMode;
  private eventBus: EventBus;
  private isActive: boolean = false;

  constructor(game: BaseGame, mode: BaseMode) {
    this.game = game;
    this.mode = mode;
    this.eventBus = ServiceLocator.get<EventBus>('eventBus');
  }

  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error('GameInstance already started');
    }

    // Initialize mode with game
    await this.mode.initialize(this.game);

    // Set as current instance
    GameInstance.currentInstance = this;
    this.isActive = true;

    this.eventBus.publishGameEvent('gameInstanceStarted', {
      gameId: this.game.id,
      modeId: this.mode.id,
    });
  }

  async stop(): Promise<void> {
    if (!this.isActive) return;

    await this.mode.cleanup();
    this.isActive = false;
    GameInstance.currentInstance = null;

    this.eventBus.publishGameEvent('gameInstanceStopped', {
      gameId: this.game.id,
      modeId: this.mode.id,
    });
  }

  getGame(): BaseGame {
    return this.game;
  }

  getMode(): BaseMode {
    return this.mode;
  }

  isGameActive(): boolean {
    return this.isActive;
  }

  static getCurrent(): GameInstance | null {
    return GameInstance.currentInstance;
  }

  static requireCurrent(): GameInstance {
    if (!GameInstance.currentInstance) {
      throw new Error('No active GameInstance. Did you call start()?');
    }
    return GameInstance.currentInstance;
  }
}
```

---

### 3. Game Implementation Layer

#### BaseGame (Abstract)

All games must extend this base class.

```typescript
// src/games/BaseGame.ts
import type { CardData, PlayerData, GameState } from '../types';

/**
 * Base class for all card games
 * Each game implements its own rules, scoring, validation, and rendering config.
 *
 * Rendering config (getPhases, getActionPanels, getCardPlayHandler) allows
 * scenes to remain generic — they read config from the game class instead
 * of hardcoding game-specific conditionals.
 */
export abstract class BaseGame {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly minPlayers: number;
  abstract readonly maxPlayers: number;
  abstract readonly description?: string;

  // Game configuration
  abstract getPlayAreaConfig(): PlayAreaConfig;
  abstract getPlayerPositions(): PlayerPositionConfig[];
  abstract getUIConfig(): GameUIConfig;

  // Game rules
  abstract validateMove(card: CardData, state: GameState): boolean;
  abstract getValidMoves(hand: CardData[], state: GameState): CardData[];
  abstract calculateScore(player: PlayerData, state: GameState): number;

  // Game flow
  abstract shouldEndRound(state: GameState): boolean;
  abstract shouldEndGame(state: GameState): boolean;

  // Default implementation — most trick-taking games use highest score
  getWinner(players: PlayerData[]): PlayerData {
    return players.reduce((winner, player) =>
      player.score > winner.score ? player : winner
    );
  }

  // AI (for solo mode)
  abstract getAIMove(hand: CardData[], state: GameState): CardData;
  abstract getAIBid?(hand: CardData[]): number;

  // ===== Rendering Config =====
  // Scenes use these to build UI dynamically instead of hardcoding game logic.

  /**
   * What phases does this game have?
   * Scenes use this to know what UI to show per phase.
   */
  abstract getPhases(): GamePhaseConfig[];

  /**
   * What action panels should be shown during gameplay?
   * e.g., Call Break has a bidding panel; Mindi has a trump-select panel.
   * Scenes create panels based on this config — no game-specific conditionals.
   */
  abstract getActionPanels(): ActionPanelConfig[];

  /**
   * How should a card play be rendered?
   * Default: trick-based (move card to center).
   * Override for games with different card play mechanics.
   */
  getCardPlayHandler(): CardPlayHandler {
    return 'trick';
  }
}

export interface PlayAreaConfig {
  type: 'trick' | 'tableau' | 'custom';
  positions: number; // Number of card positions in play area
}

export interface PlayerPositionConfig {
  x: number; // Percentage (0-1)
  y: number; // Percentage (0-1)
  rotation: number; // Degrees
}

export interface GameUIConfig {
  showBidding: boolean;
  showTricks: boolean;
  showScoreboard: boolean;
  cardBackStyle: string;
}

export interface GamePhaseConfig {
  id: string; // Phase identifier (matches server phase string)
  label: string; // Display label
  hasUI: boolean; // Whether this phase requires a UI panel/modal
}

export interface ActionPanelConfig {
  type: 'bidding' | 'trump-select' | 'custom';
  showDuring: string; // Phase ID when this panel should be visible
  config?: any; // Panel-specific configuration
}

export type CardPlayHandler = 'trick' | 'tableau' | 'discard';
```

#### CallBreakGame Implementation

```typescript
// src/games/callbreak/CallBreakGame.ts
import { BaseGame } from '../BaseGame';
import type { CardData, PlayerData, GameState } from '../../types';
import { getValidCards, calculateScore, findTrickWinner } from './rules';

/**
 * Call Break card game implementation
 */
export class CallBreakGame extends BaseGame {
  readonly id = 'callbreak';
  readonly name = 'Call Break';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;
  readonly description = 'A classic trick-taking card game';

  getPlayAreaConfig(): PlayAreaConfig {
    return {
      type: 'trick',
      positions: 4,
    };
  }

  getPlayerPositions(): PlayerPositionConfig[] {
    return [
      { x: 0.5, y: 0.85, rotation: 0 }, // Bottom (local)
      { x: 0.1, y: 0.5, rotation: 90 }, // Left
      { x: 0.5, y: 0.15, rotation: 180 }, // Top
      { x: 0.9, y: 0.5, rotation: 270 }, // Right
    ];
  }

  getUIConfig(): GameUIConfig {
    return {
      showBidding: true,
      showTricks: true,
      showScoreboard: true,
      cardBackStyle: 'callbreak-back',
    };
  }

  validateMove(card: CardData, state: GameState): boolean {
    const validCards = this.getValidMoves(state.currentPlayer.hand, state);
    return validCards.some((c) => c.id === card.id);
  }

  getValidMoves(hand: CardData[], state: GameState): CardData[] {
    return getValidCards(hand, state.leadSuit, state.currentTrick);
  }

  calculateScore(player: PlayerData, state: GameState): number {
    return calculateScore(player.bid, player.tricksWon);
  }

  shouldEndRound(state: GameState): boolean {
    return state.trickNumber >= 13; // 13 tricks per round
  }

  shouldEndGame(state: GameState): boolean {
    return state.currentRound >= 5; // 5 rounds per game
  }

  getWinner(players: PlayerData[]): PlayerData {
    return players.reduce((winner, player) =>
      player.score > winner.score ? player : winner
    );
  }

  getAIMove(hand: CardData[], state: GameState): CardData {
    // AI logic from shared package
    return chooseBotCard(hand, state.leadSuit, state.currentTrick, {
      trumpSuit: 'spades',
      tricksWon: state.currentPlayer.tricksWon,
      bid: state.currentPlayer.bid,
      numPlayers: 4,
    });
  }

  getAIBid(hand: CardData[]): number {
    return calculateBid(hand, 'spades');
  }

  // ===== Rendering Config =====

  getPhases(): GamePhaseConfig[] {
    return [
      { id: 'dealing', label: 'Dealing', hasUI: false },
      { id: 'bidding', label: 'Bidding', hasUI: true },
      { id: 'playing', label: 'Playing', hasUI: false },
      { id: 'trickEnd', label: 'Trick End', hasUI: false },
      { id: 'roundEnd', label: 'Round End', hasUI: true },
      { id: 'gameOver', label: 'Game Over', hasUI: true },
    ];
  }

  getActionPanels(): ActionPanelConfig[] {
    return [{ type: 'bidding', showDuring: 'bidding' }];
  }

  getCardPlayHandler(): CardPlayHandler {
    return 'trick';
  }
}
```

---

### 4. Mode Implementation Layer

#### BaseMode (Abstract)

All game modes must extend this base class.

```typescript
// src/modes/BaseMode.ts
import type { BaseGame } from '../games/BaseGame';
import Phaser from 'phaser';

/**
 * Base class for all game modes
 * Modes define HOW the game is played (solo, multiplayer, tournament)
 * Modes are game-agnostic - they work with ANY BaseGame
 */
export abstract class BaseMode extends Phaser.Events.EventEmitter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly requiresNetwork: boolean;

  protected game!: BaseGame;

  // Lifecycle
  abstract initialize(game: BaseGame): Promise<void>;
  abstract cleanup(): Promise<void>;

  // Game operations
  abstract startGame(): Promise<void>;
  abstract sendMove(card: CardData): void;
  abstract sendBid(bid: number): void;

  // State access
  abstract getPlayers(): PlayerData[];
  abstract getCurrentPlayer(): PlayerData | null;
  abstract getGameState(): GameState;
}
```

#### SoloMode Implementation

```typescript
// src/modes/SoloMode.ts
import { BaseMode } from './BaseMode';
import type { BaseGame } from '../games/BaseGame';
import { ServiceLocator } from '../core/ServiceLocator';
import type { EventBus } from '../services/EventBus';

/**
 * Solo mode - play against AI
 * Works for ANY game that implements BaseGame
 */
export class SoloMode extends BaseMode {
  readonly id = 'solo';
  readonly name = 'Solo (vs AI)';
  readonly requiresNetwork = false;

  private eventBus!: EventBus;
  private gameState!: GameState;
  private aiPlayers: AIPlayer[] = [];

  async initialize(game: BaseGame): Promise<void> {
    this.game = game;
    this.eventBus = ServiceLocator.get<EventBus>('eventBus');

    // Create AI players
    this.aiPlayers = this.createAIPlayers(game.maxPlayers - 1);

    // Initialize game state
    this.gameState = this.createInitialState();
  }

  async cleanup(): Promise<void> {
    this.aiPlayers = [];
    this.removeAllListeners();
  }

  async startGame(): Promise<void> {
    // Deal cards, start first round
    this.dealCards();
    this.eventBus.publishGameEvent('phaseChanged', { phase: 'bidding' });
  }

  sendMove(card: CardData): void {
    // Validate move using game rules
    if (!this.game.validateMove(card, this.gameState)) {
      console.warn('Invalid move');
      return;
    }

    // Apply move
    this.applyMove(card);

    // AI players take turns
    this.processAITurns();
  }

  sendBid(bid: number): void {
    this.gameState.currentPlayer.bid = bid;

    // AI players bid
    this.processAIBids();
  }

  private createAIPlayers(count: number): AIPlayer[] {
    const aiPlayers: AIPlayer[] = [];
    const names = ['Ace', 'Max', 'Zara', 'Nova'];

    for (let i = 0; i < count; i++) {
      aiPlayers.push({
        id: `ai-${i}`,
        name: names[i],
        emoji: ['🤖', '🦊', '🐱', '🦄'][i],
        isAI: true,
      });
    }

    return aiPlayers;
  }

  private processAITurns(): void {
    // Use game's AI logic to determine moves
    const aiMove = this.game.getAIMove(
      this.gameState.currentPlayer.hand,
      this.gameState
    );

    this.applyMove(aiMove);
  }

  private processAIBids(): void {
    this.aiPlayers.forEach((ai) => {
      const bid = this.game.getAIBid?.(ai.hand) || 1;
      ai.bid = bid;
      this.eventBus.publishGameEvent('bidPlaced', { playerId: ai.id, bid });
    });
  }

  getPlayers(): PlayerData[] {
    return [this.gameState.localPlayer, ...this.aiPlayers];
  }

  getCurrentPlayer(): PlayerData | null {
    return this.gameState.currentPlayer;
  }

  getGameState(): GameState {
    return this.gameState;
  }
}
```

#### MultiplayerMode Implementation

```typescript
// src/modes/MultiplayerMode.ts
import { BaseMode } from './BaseMode';
import type { BaseGame } from '../games/BaseGame';
import { ServiceLocator } from '../core/ServiceLocator';
import type { EventBus } from '../services/EventBus';
import type { NetworkService } from '../services/NetworkService';

/**
 * Multiplayer mode - play online via Colyseus
 * Works for ANY game that implements BaseGame
 */
export class MultiplayerMode extends BaseMode {
  readonly id = 'multiplayer';
  readonly name = 'Multiplayer (Online)';
  readonly requiresNetwork = true;

  private eventBus!: EventBus;
  private networkService!: NetworkService;

  async initialize(game: BaseGame): Promise<void> {
    this.game = game;
    this.eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.networkService = ServiceLocator.get<NetworkService>('network');

    // Subscribe to network events
    this.subscribeToNetworkEvents();
  }

  async cleanup(): Promise<void> {
    this.networkService.disconnect();
    this.removeAllListeners();
  }

  async startGame(): Promise<void> {
    // Server controls game start
    // Just wait for events
  }

  sendMove(card: CardData): void {
    this.networkService.send('playCard', { cardId: card.id });
  }

  sendBid(bid: number): void {
    this.networkService.send('bid', { bid });
  }

  private subscribeToNetworkEvents(): void {
    // Subscribe to game events from network
    this.eventBus.onGameEvent('phaseChanged', ({ phase }) => {
      this.emit('phaseChanged', phase);
    });

    this.eventBus.onGameEvent('turnChanged', ({ playerId }) => {
      this.emit('turnChanged', playerId);
    });

    this.eventBus.onGameEvent('cardPlayed', ({ playerId, card }) => {
      this.emit('cardPlayed', { playerId, card });
    });
  }

  getPlayers(): PlayerData[] {
    const room = this.networkService.getRoom();
    if (!room?.state?.players) return [];

    const players: PlayerData[] = [];
    room.state.players.forEach((player: any) => {
      players.push({
        id: player.id,
        name: player.name,
        emoji: player.emoji,
        bid: player.bid,
        tricksWon: player.tricksWon,
        score: player.score,
        isLocal: player.id === room.sessionId,
      });
    });

    return players;
  }

  getCurrentPlayer(): PlayerData | null {
    return this.getPlayers().find((p) => p.isLocal) || null;
  }

  getGameState(): GameState {
    const room = this.networkService.getRoom();
    return {
      phase: room?.state.phase,
      currentRound: room?.state.currentRound,
      currentTurn: room?.state.currentTurn,
      // ... map from room state
    };
  }
}
```

---

### 5. Scene Layer (Generic)

#### GamePlayScene - Generic Gameplay

Scene that works for ANY game/mode combination.
Uses **ScopedEventBus** for automatic listener cleanup on scene shutdown.
Creates **action panels** dynamically based on game config (no game-specific conditionals).

```typescript
// src/scenes/GamePlayScene.ts
import Phaser from 'phaser';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameInstance } from '../core/GameInstance';
import type { EventBus, ScopedEventBus } from '../services/EventBus';

/**
 * Generic gameplay scene
 * Works for ANY game/mode combination
 * Renders based on game config
 */
export class GamePlayScene extends Phaser.Scene {
  private events!: ScopedEventBus; // Auto-cleanup on shutdown
  private gameInstance!: GameInstance;
  private players: Player[] = [];

  constructor() {
    super({ key: 'GamePlayScene' });
  }

  create() {
    const eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.events = eventBus.subscribeTo(this); // Auto-cleans on shutdown
    this.gameInstance = GameInstance.requireCurrent();

    const game = this.gameInstance.getGame();
    const mode = this.gameInstance.getMode();

    // Render based on game config (not hardcoded!)
    this.createPlayArea(game.getPlayAreaConfig());
    this.createPlayers(game.getPlayerPositions());
    this.createActionPanels(game);

    // Subscribe to game events (auto-cleaned on shutdown)
    this.subscribeToGameEvents();

    // Subscribe to network events for reconnection UI
    this.subscribeToNetworkEvents();

    // Launch UI scene (parallel)
    this.scene.launch('UIScene', {
      gameInstance: this.gameInstance,
    });

    // Start game
    mode.startGame();
  }

  private createPlayArea(config: PlayAreaConfig): void {
    if (config.type === 'trick') {
      this.trickArea = new TrickArea(this, config.positions);
    }
    // Other types: tableau, custom, etc.
  }

  private createPlayers(positions: PlayerPositionConfig[]): void {
    const players = this.gameInstance.getMode().getPlayers();

    players.forEach((playerData, index) => {
      const posConfig = positions[index];
      const player = new Player(this, playerData, posConfig);
      this.players.push(player);
    });
  }

  /**
   * Create action panels based on game config.
   * No game-specific conditionals — the game class defines what panels it needs.
   */
  private createActionPanels(game: BaseGame): void {
    for (const panel of game.getActionPanels()) {
      switch (panel.type) {
        case 'bidding':
          this.biddingUI = new BiddingModal(this, (bid) =>
            this.gameInstance.getMode().sendBid(bid)
          );
          break;
        case 'trump-select':
          this.trumpSelectUI = new TrumpSelectModal(this, (suit) =>
            this.gameInstance.getMode().sendTrumpSelect(suit)
          );
          break;
        // Future panel types go here
      }
    }
  }

  private subscribeToGameEvents(): void {
    const game = this.gameInstance.getGame();
    const actionPanels = game.getActionPanels();

    // Phase changes — show/hide action panels based on game config
    this.events.onGameEvent('phaseChanged', ({ phase }) => {
      for (const panel of actionPanels) {
        if (panel.showDuring === phase) {
          this.showActionPanel(panel.type);
        }
      }
    });

    this.events.onGameEvent('cardPlayed', ({ playerId, card }) => {
      const player = this.findPlayer(playerId);
      if (player) {
        this.animateCardPlay(player, card);
      }
    });

    this.events.onGameEvent('trickComplete', ({ winnerId }) => {
      const winner = this.findPlayer(winnerId);
      if (winner) {
        this.animateTrickCollection(winner);
      }
    });
  }

  private subscribeToNetworkEvents(): void {
    this.events.onNetworkEvent('reconnecting', ({ attempt }) => {
      this.reconnectionOverlay?.show(attempt);
    });

    this.events.onNetworkEvent('reconnected', () => {
      this.reconnectionOverlay?.hide();
    });

    this.events.onNetworkEvent('reconnectionFailed', () => {
      this.reconnectionOverlay?.hide();
      this.time.delayedCall(2000, () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
    });

    this.events.onNetworkEvent('connectionQualityChange', ({ quality }) => {
      this.networkIndicator?.updateQuality(quality);
    });
  }

  private findPlayer(playerId: string): Player | undefined {
    return this.players.find((p) => p.id === playerId);
  }

  private animateCardPlay(player: Player, card: CardData): void {
    const cardObject = player.removeCard(card);
    this.trickArea.playCard(card, player.index, cardObject);
  }

  private animateTrickCollection(winner: Player): void {
    this.time.delayedCall(1000, () => {
      this.trickArea.collectTrick(winner.index);
    });
  }

  async returnToMenu() {
    await this.gameInstance.stop();
    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
    // Note: ScopedEventBus listeners auto-cleaned on shutdown
  }
}
```

#### LobbyScene - Generic Lobby

Uses **ScopedEventBus** for automatic listener cleanup.

```typescript
// src/scenes/LobbyScene.ts
import Phaser from 'phaser';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameRegistry } from '../core/GameRegistry';
import { ModeRegistry } from '../core/ModeRegistry';
import { GameInstance } from '../core/GameInstance';
import type { EventBus, ScopedEventBus } from '../services/EventBus';
import type { NetworkService } from '../services/NetworkService';

/**
 * Generic lobby scene
 * Works for ANY game (Call Break, Mindi, etc.)
 */
export class LobbyScene extends Phaser.Scene {
  private scopedEvents!: ScopedEventBus;
  private networkService!: NetworkService;
  private selectedGameId: string = 'callbreak'; // Default

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create() {
    const eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.scopedEvents = eventBus.subscribeTo(this); // Auto-cleans on shutdown
    this.networkService = ServiceLocator.get<NetworkService>('network');

    // Subscribe to lobby events (auto-cleaned on shutdown)
    this.subscribeToLobbyEvents();

    // Show game selection and room options
    this.createUI();
  }

  private subscribeToLobbyEvents(): void {
    this.scopedEvents.onLobbyEvent('seated', ({ roomCode }) => {
      this.showWaitingRoom(roomCode);
    });

    this.scopedEvents.onLobbyEvent('playerJoined', () => {
      this.updatePlayerList();
    });

    this.scopedEvents.onLobbyEvent('playerRemoved', () => {
      this.updatePlayerList();
    });

    this.scopedEvents.onLobbyEvent('playerReady', () => {
      this.updatePlayerList();
    });

    this.scopedEvents.onGameEvent('phaseChanged', ({ phase }) => {
      if (phase === 'bidding' || phase === 'dealing') {
        this.startGame();
      }
    });

    this.scopedEvents.onNetworkEvent('error', ({ message }) => {
      // Handle room creation/join errors
    });

    this.scopedEvents.onNetworkEvent(
      'connectionQualityChange',
      ({ quality }) => {
        this.networkIndicator?.updateQuality(quality);
      }
    );
  }

  private async handleCreateRoom(playerName: string): Promise<void> {
    const gameClass = GameRegistry.get(this.selectedGameId);
    const roomType = gameClass.prototype.id; // 'callbreak', 'mindi', etc.

    await this.networkService.createRoom(roomType, userId, playerName);
  }

  private async startGame(): Promise<void> {
    // Create game instance
    const GameClass = GameRegistry.get(this.selectedGameId);
    const ModeClass = ModeRegistry.get('multiplayer');

    const game = new GameClass();
    const mode = new ModeClass();
    const gameInstance = new GameInstance(game, mode);

    await gameInstance.start();

    // Transition to gameplay
    // Note: ScopedEventBus listeners auto-cleaned on shutdown
    this.scene.start('GamePlayScene');
  }
}
```

---

## Bootstrap

### main.ts - Application Entry Point

```typescript
// src/main.ts
import Phaser from 'phaser';
import { GameApplication } from './core/GameApplication';
import { ServiceLocator } from './core/ServiceLocator';
import { GameRegistry } from './core/GameRegistry';
import { ModeRegistry } from './core/ModeRegistry';
import { EventBus } from './services/EventBus';
import { NetworkService } from './services/NetworkService';
import { AudioService } from './services/AudioService';

// Games
import { CallBreakGame } from './games/callbreak/CallBreakGame';
// import { MindiGame } from './games/mindi/MindiGame'; // Future

// Modes
import { SoloMode } from './modes/SoloMode';
import { MultiplayerMode } from './modes/MultiplayerMode';

// Scenes
import { MenuScene } from './scenes/MenuScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GamePlayScene } from './scenes/GamePlayScene';
import { UIScene } from './scenes/UIScene';

/**
 * Bootstrap application
 */
async function bootstrap() {
  // 1. Register services
  ServiceLocator.register('eventBus', EventBus.getInstance());
  ServiceLocator.register('network', new NetworkService());
  ServiceLocator.register('audio', new AudioService());

  // 2. Initialize network service
  const networkService = ServiceLocator.get<NetworkService>('network');
  await networkService.initialize(import.meta.env.VITE_SERVER_URL);

  // 3. Register games
  GameRegistry.register('callbreak', CallBreakGame);
  // GameRegistry.register('mindi', MindiGame); // Future

  // 4. Register modes
  ModeRegistry.register('solo', SoloMode);
  ModeRegistry.register('multiplayer', MultiplayerMode);

  // 5. Create Phaser game
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1920,
      height: 1080,
    },
    scene: [MenuScene, LobbyScene, GamePlayScene, UIScene],
  };

  return new Phaser.Game(config);
}

// Start application
bootstrap().catch(console.error);
```

---

## Adding New Games/Modes

### Example 1: Adding Mindi Game

```typescript
// 1. Create game class
// src/games/mindi/MindiGame.ts
export class MindiGame extends BaseGame {
  readonly id = 'mindi';
  readonly name = 'Mindi';
  readonly minPlayers = 4;
  readonly maxPlayers = 6;

  getPlayAreaConfig(): PlayAreaConfig {
    return {
      type: 'trick',
      positions: 6, // Up to 6 players
    };
  }

  validateMove(card: CardData, state: GameState): boolean {
    // Mindi-specific rules
  }

  calculateScore(player: PlayerData, state: GameState): number {
    // Mindi-specific scoring
  }

  // Rendering config — scene uses this to build UI dynamically
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
    return [
      { type: 'trump-select', showDuring: 'trumpSelect' },
      // Note: NO bidding panel — Mindi doesn't have bidding
    ];
  }

  // ... implement other methods
}

// 2. Register in main.ts
GameRegistry.register('mindi', MindiGame);

// 3. Update MenuScene to show Mindi option
// NO changes to:
// - GamePlayScene (already generic!)
// - LobbyScene (already generic!)
// - Modes (work for all games!)
// - NetworkService (game-agnostic!)
```

### Example 2: Adding Tournament Mode

```typescript
// 1. Create mode class
// src/modes/TournamentMode.ts
export class TournamentMode extends BaseMode {
  readonly id = 'tournament';
  readonly name = 'Tournament';
  readonly requiresNetwork = true;

  async initialize(game: BaseGame): Promise<void> {
    // Tournament-specific initialization
    // Multiple rounds, leaderboards, etc.
  }

  // ... implement tournament logic
}

// 2. Register in main.ts
ModeRegistry.register('tournament', TournamentMode);

// 3. Works with ALL games automatically!
const callBreakTournament = new GameInstance(
  new CallBreakGame(),
  new TournamentMode()
);

const mindiTournament = new GameInstance(new MindiGame(), new TournamentMode());
```

---

## Benefits

### 1. True Separation of Concerns

| Layer     | Responsibility     | Knows About            |
| --------- | ------------------ | ---------------------- |
| Services  | Global utilities   | Nothing (singleton)    |
| Framework | Game/mode registry | Service locator only   |
| Games     | Rules & scoring    | Nothing (pure logic)   |
| Modes     | How game is played | BaseGame interface     |
| Scenes    | Rendering          | EventBus, GameInstance |

### 2. Zero Coupling

- ❌ Scenes don't know about network
- ❌ Games don't know about modes
- ❌ Modes don't know about scenes
- ✅ Communication via EventBus only

### 3. Pluggable Architecture

Adding new games/modes requires:

1. Create class extending base
2. Register in main.ts
3. **That's it!** No changes to existing code

### 4. Easy Testing

```typescript
// Test game logic without Phaser
const game = new CallBreakGame();
const validMoves = game.getValidMoves(hand, mockState);
expect(validMoves).toContain(expectedCard);

// Test mode with mock network
const mockNetwork = new MockNetworkService();
ServiceLocator.register('network', mockNetwork);
const mode = new MultiplayerMode();
// ... test mode behavior
```

### 5. Scalability

Current: 1 game (Call Break), 2 modes (Solo, Multiplayer)

Easy to add:

- ✅ 10+ different card games
- ✅ 5+ game modes
- ✅ New features (spectators, replays, etc.)
- ✅ Platform variations (mobile, web, desktop)

---

## Comparison: Current vs Proposed

| Aspect                | Current                       | Proposed                             |
| --------------------- | ----------------------------- | ------------------------------------ |
| **Adding Mindi**      | Duplicate entire structure    | Create `MindiGame.ts`, register      |
| **Adding Tournament** | New scenes + logic            | Create `TournamentMode.ts`, register |
| **Network access**    | Passed through scenes         | `ServiceLocator.get('network')`      |
| **Scene coupling**    | `GameScene` = Call Break only | `GamePlayScene` = any game           |
| **Event forwarding**  | 4-layer chain                 | 1 central EventBus                   |
| **Testing**           | Hard (tight coupling)         | Easy (mock services)                 |
| **Code reuse**        | Low (game-specific)           | High (generic)                       |
| **Lines of code**     | ~2000                         | ~1500 (25% reduction)                |

---

## Trade-offs

### Pros

- ✅ Extremely scalable
- ✅ True separation of concerns
- ✅ Easy to test
- ✅ Industry-standard patterns
- ✅ Adding features = plug & play

### Cons

- ⚠️ More upfront design
- ⚠️ Need to understand framework
- ⚠️ Slightly more boilerplate

---

## References

### Industry Architecture Patterns

**Figma's Multiplayer Architecture:**

- [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) - Server-side state management with WebSocket pub/sub
- [Deconstructing Figma's Multiplayer Magic](https://medium.com/frontend-simplified/deconstructing-the-magic-how-figma-achieved-seamless-real-time-multi-user-collaboration-37347f2ee292) - Analysis of CRDT-based conflict resolution
- [Making multiplayer more reliable](https://www.figma.com/blog/making-multiplayer-more-reliable/) - Figma's approach to connection resilience

**Discord's Real-Time Architecture:**

- [Discord: Real-Time Architecture at Internet Scale](https://medium.com/@yadavmpadiyar/discord-real-time-architecture-at-internet-scale-bef4be6b7198) - Sharded gateway and pub/sub patterns
- [How Discord Handles Two and Half Million Concurrent Voice Users](https://discord.com/blog/how-discord-handles-two-and-half-million-concurrent-voice-users-using-webrtc) - Elixir-based signaling architecture

### Game Development Patterns

**Event-Driven Architecture:**

- [Game Programming Patterns: Event Queue](https://gameprogrammingpatterns.com/event-queue.html) - Canonical reference for event bus pattern in games
- [Event-Driven Architecture (EDA)](https://www.confluent.io/learn/event-driven-architecture/) - Comprehensive guide to EDA patterns
- [Using an Enum-Based Event Bus Pattern In Unity](https://hackernoon.com/using-an-enum-based-event-bus-pattern-in-unity) - Unity-specific implementation

**Multiplayer Game Architecture:**

- [Client-Server Game Architecture](https://www.gabrielgambetta.com/client-server-game-architecture.html) - Gabriel Gambetta's authoritative guide
- [Game Networking Demystified, Part I: State vs. Input](https://ruoyusun.com/2019/03/28/game-networking-1.html) - State synchronization patterns
- [Unity Realtime Multiplayer, Part 7: Architectures in Different Genres](https://medium.com/my-games-company/unity-realtime-multiplayer-part-7-architectures-in-different-genres-8185e9a3a3ad) - Genre-specific patterns

### Design Patterns

**Message Broker & Pub/Sub:**

- [Event Bus Implementation(s)](https://medium.com/elixirlabs/event-bus-implementation-s-d2854a9fafd5) - Multiple event bus approaches
- [Design Patterns: Event Bus](https://dzone.com/articles/design-patterns-event-bus) - Event bus pattern overview
- [Software Architecture Patterns: Event-Driven Architecture](https://www.oreilly.com/library/view/software-architecture-patterns/9781491971437/ch02.html) - O'Reilly reference

**Service Locator Pattern:**

- [Service Locator Pattern](https://gameprogrammingpatterns.com/service-locator.html) - Game Programming Patterns reference
- Used by: Unity (static classes), Unreal Engine (Subsystems), Godot (Singletons)

### Game Engine References

These commercial engines use similar layered architectures:

**Unity:**

- Game Object / Component system
- Service-based architecture (AudioSource, NetworkManager, etc.)
- Event system (UnityEvent, C# events)
- ScriptableObjects for game configuration

**Unreal Engine:**

- Actor / Component model
- Subsystem architecture (game-agnostic services)
- Gameplay Framework (game mode, game state, player controller separation)
- Delegate system for events

**Godot:**

- Node system with signals (event bus)
- Singleton/Autoload pattern for global services
- Scene-based architecture (reusable, composable)

All three engines separate:

1. **Framework** (engine core)
2. **Game Logic** (rules, mechanics)
3. **Rendering** (scenes, visuals)
4. **Services** (audio, network, input)
