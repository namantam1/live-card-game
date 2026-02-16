# Migration Plan: Current Architecture → Game Framework

## Overview

This document outlines a step-by-step migration plan from the current architecture to the proposed Game Framework architecture described in `game-framework-architecture.md`.

**Migration Complexity:** Medium
**Estimated Effort:** 3-5 days (1 developer)
**Risk Level:** Low (incremental migration with testing at each step)

---

## Current State Analysis

### Current Architecture

```
MenuScene
  ↓
LobbyScene (creates NetworkManager)
  ↓ (passes via scene data)
GameScene (receives networkManager)
  ↓
GameModeFactory (creates mode based on data.isMultiplayer)
  ↓
SoloGameMode OR MultiplayerGameMode
  ↓ (event forwarding)
GameManager (Solo) OR NetworkManager → RoomManager (Multiplayer)
```

### Key Problems

1. **NetworkManager passed through scenes** - Tight coupling
2. **4-layer event forwarding chain** - Colyseus → RoomManager → NetworkManager → MultiplayerGameMode → GameScene
3. **GameScene is game-specific** - Only works for Call Break
4. **Duplicate logic** - `getPlayers()` in RoomManager and MultiplayerGameMode
5. **GameManager contains game rules** - Can't reuse for other games

---

## Migration Strategy

### Approach: Incremental Replacement

We'll migrate in phases, testing after each step. Old code remains functional until fully replaced.

**Key Principle:** The system should remain functional after each phase.

### Rollback Strategy

Each phase creates new code alongside existing code. If issues arise, simply don't switch to the new code paths.

---

## Phase 1: Create Service Layer

**Goal:** Establish service infrastructure without touching existing code.

**Effort:** 4-6 hours

### Step 1.1: Create ServiceLocator

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

**Test:**

```typescript
// Test in console/test file
ServiceLocator.register('test', { value: 42 });
console.log(ServiceLocator.get('test')); // { value: 42 }
```

### Step 1.2: Create EventBus Service

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

**Test:**

```typescript
const bus = EventBus.getInstance();
bus.onGameEvent('phaseChanged', (data) => console.log('Phase:', data.phase));
bus.publishGameEvent('phaseChanged', { phase: 'bidding' });
// Should log: Phase: bidding
```

### Step 1.3: Create NetworkService

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

### Step 1.4: Bootstrap Services in main.ts

```typescript
// src/main.ts - Add before creating Phaser game
import { ServiceLocator } from './core/ServiceLocator';
import { EventBus } from './services/EventBus';
import { NetworkService } from './services/NetworkService';

// Bootstrap services
async function bootstrapServices() {
  // Register EventBus
  ServiceLocator.register('eventBus', EventBus.getInstance());

  // Register and initialize NetworkService
  const networkService = new NetworkService();
  await networkService.initialize(
    import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567'
  );
  ServiceLocator.register('network', networkService);

  // Register other services
  ServiceLocator.register('audio', AudioManager.getInstance());
  ServiceLocator.register('presence', PresenceManager.getInstance());
}

// Modify existing code
async function main() {
  await bootstrapServices();

  const config = {
    // ... existing Phaser config
  };

  const game = new Phaser.Game(config);
}

main().catch(console.error);
```

**Test:** Services should be accessible in any scene:

```typescript
// In any scene
const eventBus = ServiceLocator.get<EventBus>('eventBus');
const network = ServiceLocator.get<NetworkService>('network');
```

**Phase 1 Complete Checklist:**

- [ ] ServiceLocator created and tested
- [ ] EventBus created with typed event maps and ScopedEventBus
- [ ] NetworkService created with connection monitoring and auto-reconnection
- [ ] Services registered in main.ts
- [ ] Services accessible from scenes
- [ ] Existing code still works (not using new services yet)

---

## Phase 2: Create Game Framework Layer

**Goal:** Create registries and game abstractions.

**Effort:** 6-8 hours

### Step 2.1: Create GameRegistry

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

### Step 2.2: Create ModeRegistry

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

### Step 2.3: Create GameInstance

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

**Phase 2 Complete Checklist:**

- [ ] GameRegistry created
- [ ] ModeRegistry created
- [ ] GameInstance created
- [ ] All can be imported without errors

---

## Phase 3: Extract Call Break Game Logic

**Goal:** Separate game rules from GameManager into CallBreakGame.

**Effort:** 8-10 hours

### Step 3.1: Create BaseGame Interface

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

### Step 3.2: Extract CallBreakGame from GameManager

Create new file by extracting logic:

```typescript
// src/games/callbreak/CallBreakGame.ts
import { BaseGame } from '../BaseGame';
import type {
  CardData,
  PlayerData,
  GameState,
  PlayAreaConfig,
  PlayerPositionConfig,
  GameUIConfig,
  GamePhaseConfig,
  ActionPanelConfig,
  CardPlayHandler,
} from '../../types';
import {
  getValidCards,
  calculateScore,
  findTrickWinner,
  sortHand,
} from '../../utils/cards';
import { calculateBid, chooseBotCard, TRUMP_SUIT } from '@call-break/shared';

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
    return chooseBotCard(hand, state.leadSuit, state.currentTrick, {
      trumpSuit: TRUMP_SUIT,
      tricksWon: state.currentPlayer.tricksWon,
      bid: state.currentPlayer.bid,
      numPlayers: 4,
    });
  }

  getAIBid(hand: CardData[]): number {
    return calculateBid(hand, TRUMP_SUIT);
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

### Step 3.3: Register CallBreakGame

```typescript
// In main.ts, add after service bootstrap
import { GameRegistry } from './core/GameRegistry';
import { CallBreakGame } from './games/callbreak/CallBreakGame';

GameRegistry.register('callbreak', CallBreakGame);
```

**Test:**

```typescript
const GameClass = GameRegistry.get('callbreak');
const game = new GameClass();
console.log(game.name); // 'Call Break'
console.log(game.getPlayAreaConfig()); // { type: 'trick', positions: 4 }
console.log(game.getPhases()); // [{ id: 'dealing', ... }, ...]
console.log(game.getActionPanels()); // [{ type: 'bidding', showDuring: 'bidding' }]
console.log(game.getCardPlayHandler()); // 'trick'
```

**Phase 3 Complete Checklist:**

- [ ] BaseGame interface created with getPhases, getActionPanels, getCardPlayHandler
- [ ] CallBreakGame extracted from GameManager with rendering config methods
- [ ] CallBreakGame registered
- [ ] Game can be retrieved from registry
- [ ] GameManager still exists (not deleted yet)

---

## Phase 4: Refactor Game Modes

**Goal:** Update SoloMode and create new MultiplayerMode using services.

**Effort:** 10-12 hours

### Step 4.1: Create BaseMode Interface

```typescript
// src/modes/BaseMode.ts
import type { BaseGame } from '../games/BaseGame';
import Phaser from 'phaser';
import type { CardData, PlayerData, GameState } from '../types';

export abstract class BaseMode extends Phaser.Events.EventEmitter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly requiresNetwork: boolean;

  protected game!: BaseGame;

  abstract initialize(game: BaseGame): Promise<void>;
  abstract cleanup(): Promise<void>;

  abstract startGame(): Promise<void>;
  abstract sendMove(card: CardData): void;
  abstract sendBid(bid: number): void;

  abstract getPlayers(): PlayerData[];
  abstract getCurrentPlayer(): PlayerData | null;
  abstract getGameState(): GameState;
}
```

### Step 4.2: Refactor SoloMode

**Keep the existing SoloMode but update it to extend new BaseMode:**

```typescript
// src/modes/SoloModeNew.ts (create new file first)
import { BaseMode } from './BaseMode';
import type { BaseGame } from '../games/BaseGame';
// ... rest of implementation similar to current SoloGameMode
// but uses this.game (BaseGame) instead of GameManager
```

### Step 4.3: Create New MultiplayerMode

```typescript
// src/modes/MultiplayerModeNew.ts
import { BaseMode } from './BaseMode';
import type { BaseGame } from '../games/BaseGame';
import { ServiceLocator } from '../core/ServiceLocator';
import type { EventBus } from '../services/EventBus';
import type { NetworkService } from '../services/NetworkService';

export class MultiplayerModeNew extends BaseMode {
  readonly id = 'multiplayer';
  readonly name = 'Multiplayer (Online)';
  readonly requiresNetwork = true;

  private eventBus!: EventBus;
  private networkService!: NetworkService;
  private playerId!: string;

  async initialize(game: BaseGame): Promise<void> {
    this.game = game;
    this.eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.networkService = ServiceLocator.get<NetworkService>('network');

    const room = this.networkService.getRoom();
    if (!room) {
      throw new Error('Not in a room. Join/create room first.');
    }

    this.playerId = room.sessionId;

    // Subscribe to game events from EventBus
    this.subscribeToGameEvents();
  }

  async cleanup(): Promise<void> {
    // Don't disconnect - NetworkService handles that
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

  private subscribeToGameEvents(): void {
    // Subscribe to events published by NetworkService
    this.eventBus.onGameEvent('phaseChanged', ({ phase }) => {
      this.emit('phaseChanged', phase);
    });

    this.eventBus.onGameEvent('turnChanged', ({ playerId }) => {
      this.emit('turnChanged', { playerId });
    });

    this.eventBus.onGameEvent('cardPlayed', ({ playerId, card }) => {
      this.emit('cardPlayed', { playerId, card });
    });

    this.eventBus.onGameEvent('bidPlaced', ({ playerId, bid }) => {
      this.emit('bidPlaced', { playerId, bid });
    });

    this.eventBus.onGameEvent('trickComplete', ({ winnerId }) => {
      this.emit('trickComplete', { winnerId });
    });

    this.eventBus.onGameEvent('reaction', (data) => {
      this.emit('reaction', data);
    });

    this.eventBus.onGameEvent('chatMessage', (data) => {
      this.emit('chatMessage', data);
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
        seatIndex: player.seatIndex,
        isLocal: player.id === this.playerId,
        bid: player.bid,
        tricksWon: player.tricksWon,
        score: player.score,
        roundScore: player.roundScore,
        isBot: player.isBot,
        isReady: player.isReady,
        isConnected: player.isConnected,
      });
    });

    return players.sort((a, b) => a.seatIndex - b.seatIndex);
  }

  getCurrentPlayer(): PlayerData | null {
    return this.getPlayers().find((p) => p.isLocal) || null;
  }

  getGameState(): GameState {
    const room = this.networkService.getRoom();
    return {
      phase: room?.state.phase || 'waiting',
      currentRound: room?.state.currentRound || 1,
      currentTurn: room?.state.currentTurn,
      leadSuit: room?.state.leadSuit,
      trickNumber: room?.state.trickNumber || 0,
      currentTrick: this.getCurrentTrick(),
      players: this.getPlayers(),
      currentPlayer: this.getCurrentPlayer()!,
    };
  }

  private getCurrentTrick(): any[] {
    const room = this.networkService.getRoom();
    if (!room?.state.currentTrick) return [];

    return Array.from(room.state.currentTrick).map((entry: any) => ({
      playerIndex: entry.playerId,
      card: {
        id: entry.card.id,
        suit: entry.card.suit,
        rank: entry.card.rank,
        value: entry.card.value,
      },
    }));
  }
}
```

### Step 4.4: Register Modes

```typescript
// In main.ts
import { ModeRegistry } from './core/ModeRegistry';
import { SoloModeNew } from './modes/SoloModeNew';
import { MultiplayerModeNew } from './modes/MultiplayerModeNew';

ModeRegistry.register('solo', SoloModeNew);
ModeRegistry.register('multiplayer', MultiplayerModeNew);
```

**Phase 4 Complete Checklist:**

- [ ] BaseMode interface created
- [ ] SoloModeNew created (parallel to existing)
- [ ] MultiplayerModeNew created
- [ ] Modes registered
- [ ] Old modes still exist (not deleted yet)

---

## Phase 5: Update LobbyScene

**Goal:** LobbyScene uses NetworkService instead of creating NetworkManager, with ScopedEventBus for auto-cleanup.

**Effort:** 4-6 hours

### Step 5.1: Refactor LobbyScene

```typescript
// In src/scenes/LobbyScene.ts - make these changes

// Remove:
// private networkManager!: NetworkManager;

// Add:
import { ServiceLocator } from '../core/ServiceLocator';
import type { NetworkService } from '../services/NetworkService';
import type { EventBus, ScopedEventBus } from '../services/EventBus';

private networkService!: NetworkService;
private scopedEvents!: ScopedEventBus;

// In create():
create() {
  // OLD: this.networkManager = new NetworkManager();
  // NEW:
  this.networkService = ServiceLocator.get<NetworkService>('network');
  const eventBus = ServiceLocator.get<EventBus>('eventBus');
  this.scopedEvents = eventBus.subscribeTo(this); // Auto-cleans on shutdown

  // ... rest of create
  this.subscribeToLobbyEvents(); // NEW METHOD
}

// Replace setupNetworkListeners() with:
// NOTE: All listeners registered via scopedEvents are automatically removed
// when the scene shuts down — no manual cleanup needed.
private subscribeToLobbyEvents(): void {
  // Subscribe to events from EventBus instead of NetworkManager
  this.scopedEvents.onLobbyEvent('seated', (data: any) => {
    const state = this.lobbyActor.getSnapshot().value;
    if (state === 'creatingRoom') {
      this.send({ type: 'ROOM_CREATED', roomCode: data.roomCode });
    } else if (state === 'joiningRoom') {
      this.send({ type: 'ROOM_JOINED', roomCode: data.roomCode });
    }
  });

  this.scopedEvents.onLobbyEvent('playerJoined', () => {
    this.updatePlayersList();
  });

  this.scopedEvents.onLobbyEvent('playerRemoved', () => {
    this.updatePlayersList();
  });

  this.scopedEvents.onLobbyEvent('playerReady', () => {
    this.updatePlayersList();
    if (this.lobbyActor.getSnapshot().value === 'readying') {
      this.send({ type: 'READY_SENT' });
    }
  });

  this.scopedEvents.onGameEvent('phaseChanged', ({ phase }: any) => {
    if (phase === 'dealing' || phase === 'bidding') {
      this.send({ type: 'START_GAME' });
    }
  });

  this.scopedEvents.onNetworkEvent('error', ({ message }: any) => {
    const state = this.lobbyActor.getSnapshot().value;
    if (state === 'joiningRoom' || state === 'creatingRoom') {
      this.send({ type: 'ROOM_ERROR', error: message });
    }
  });

  this.scopedEvents.onNetworkEvent('connectionQualityChange', ({ quality }: any) => {
    this.networkIndicator?.updateQuality(quality);
  });
}

// Update room operations:
private async handleCreateRoom() {
  // OLD: await this.networkManager.createRoom(userId, playerName);
  // NEW:
  await this.networkService.createRoom('call_break', userId, playerName);
}

private async handleJoinRoom() {
  // OLD: await this.networkManager.joinRoom(roomCode, userId, playerName);
  // NEW:
  await this.networkService.joinRoom('call_break', roomCode, userId, playerName);
}

private handleReady() {
  // OLD: this.networkManager.sendReady();
  // NEW:
  this.networkService.send('ready');
}

private async handleLeaveRoom() {
  // OLD: await this.networkManager.leaveRoom();
  // NEW:
  this.networkService.disconnect();
}

// Update getPlayers():
private updatePlayersList() {
  // OLD: const players = this.networkManager.getPlayers();
  // NEW:
  const room = this.networkService.getRoom();
  if (!room?.state?.players) return;

  const players: PlayerData[] = [];
  room.state.players.forEach((player: any) => {
    players.push({
      id: player.id,
      name: player.name,
      // ... same as before
    });
  });

  this.waitingView.updatePlayers(players);
}

// Update startGame():
private startGame() {
  // DON'T pass networkManager anymore!
  this.cameras.main.fadeOut(ANIMATION.SCENE_TRANSITION);
  this.cameras.main.once('camerafadeoutcomplete', () => {
    this.scene.start('GameScene', {
      isMultiplayer: true,
      // networkManager: removed!
    });
  });
  // Note: ScopedEventBus listeners auto-cleaned on shutdown
}
```

**Test:**

- [ ] Can create room
- [ ] Can join room
- [ ] Player list updates
- [ ] Can send ready
- [ ] Game starts correctly
- [ ] No errors in console

**Phase 5 Complete Checklist:**

- [ ] LobbyScene refactored to use services and ScopedEventBus
- [ ] All lobby functionality works
- [ ] NetworkManager import removed from LobbyScene
- [ ] No scene data passed for network
- [ ] Auto-cleanup on scene shutdown (no manual listener removal)

---

## Phase 6: Update GameScene/GamePlayScene

**Goal:** GameScene uses GameInstance and ScopedEventBus instead of receiving data.

**Effort:** 6-8 hours

### Step 6.1: Refactor GameScene to GamePlayScene

```typescript
// src/scenes/GamePlayScene.ts
import Phaser from 'phaser';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameInstance } from '../core/GameInstance';
import { GameRegistry } from '../core/GameRegistry';
import { ModeRegistry } from '../core/ModeRegistry';
import type { EventBus, ScopedEventBus } from '../services/EventBus';
import type { BaseGame } from '../games/BaseGame';

/**
 * Generic gameplay scene
 * Works for ANY game/mode combination
 * Renders based on game config
 */
export class GamePlayScene extends Phaser.Scene {
  private scopedEvents!: ScopedEventBus; // Auto-cleanup on shutdown
  private gameInstance!: GameInstance;
  private players: Player[] = [];

  constructor() {
    super({ key: 'GamePlayScene' });
  }

  init(data: any) {
    // Create game instance based on mode
    const GameClass = GameRegistry.get('callbreak');
    const game = new GameClass();

    let mode;
    if (data.isMultiplayer) {
      const ModeClass = ModeRegistry.get('multiplayer');
      mode = new ModeClass();
    } else {
      const ModeClass = ModeRegistry.get('solo');
      mode = new ModeClass();
    }

    this.gameInstance = new GameInstance(game, mode);
  }

  async create() {
    const eventBus = ServiceLocator.get<EventBus>('eventBus');
    this.scopedEvents = eventBus.subscribeTo(this); // Auto-cleans on shutdown
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
    this.scopedEvents.onGameEvent('phaseChanged', ({ phase }) => {
      for (const panel of actionPanels) {
        if (panel.showDuring === phase) {
          this.showActionPanel(panel.type);
        }
      }
    });

    this.scopedEvents.onGameEvent('cardPlayed', ({ playerId, card }) => {
      const player = this.findPlayer(playerId);
      if (player) {
        this.animateCardPlay(player, card);
      }
    });

    this.scopedEvents.onGameEvent('trickComplete', ({ winnerId }) => {
      const winner = this.findPlayer(winnerId);
      if (winner) {
        this.animateTrickCollection(winner);
      }
    });
  }

  private subscribeToNetworkEvents(): void {
    this.scopedEvents.onNetworkEvent('reconnecting', ({ attempt }) => {
      this.reconnectionOverlay?.show(attempt);
    });

    this.scopedEvents.onNetworkEvent('reconnected', () => {
      this.reconnectionOverlay?.hide();
    });

    this.scopedEvents.onNetworkEvent('reconnectionFailed', () => {
      this.reconnectionOverlay?.hide();
      this.time.delayedCall(2000, () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
      });
    });

    this.scopedEvents.onNetworkEvent(
      'connectionQualityChange',
      ({ quality }) => {
        this.networkIndicator?.updateQuality(quality);
      }
    );
  }

  async returnToMenu() {
    await this.gameInstance.stop();
    this.scene.stop('UIScene');
    this.scene.start('MenuScene');
    // Note: ScopedEventBus listeners auto-cleaned on shutdown
  }
}
```

### Step 6.2: Update UIScene

```typescript
// src/scenes/UIScene.ts

// Remove:
// private gameMode!: GameModeBase;

// Add:
private gameInstance!: GameInstance;
private mode!: BaseMode;

init(data: any) {
  this.gameInstance = data.gameInstance;
  this.mode = this.gameInstance.getMode();
}

create() {
  // Use mode instead of gameMode
  this.setupEventListeners(this.mode);
}

private setupEventListeners(mode: BaseMode) {
  mode.on('phaseChanged', (phase: string) => {
    // ...
  });

  // ... rest of listeners
}
```

**Phase 6 Complete Checklist:**

- [ ] GamePlayScene uses GameInstance and ScopedEventBus
- [ ] UIScene uses GameInstance
- [ ] Action panels created dynamically from game config
- [ ] Network event subscriptions for reconnection UI
- [ ] Solo mode works
- [ ] Multiplayer mode works
- [ ] No scene data passing for network
- [ ] Auto-cleanup on scene shutdown (no manual listener removal)

---

## Phase 7: Delete Old Code

**Goal:** Remove obsolete files.

**Effort:** 2-3 hours

### Files to Delete

```bash
# Delete old network managers (ALL absorbed into NetworkService)
rm src/managers/NetworkManager.ts
rm src/managers/network/ConnectionManager.ts
rm src/managers/network/RoomManager.ts
rm src/managers/network/ReconnectionHandler.ts
rm src/managers/network/ConnectionMonitor.ts

# Delete old game modes (if fully replaced)
rm src/modes/SoloGameMode.ts
rm src/modes/MultiplayerGameMode.ts
rm src/modes/GameModeFactory.ts

# Optionally keep GameManager for reference
# or delete if fully extracted to CallBreakGame
# rm src/managers/GameManager.ts
```

### Rename New Files

```bash
# Rename new modes to standard names
mv src/modes/SoloModeNew.ts src/modes/SoloMode.ts
mv src/modes/MultiplayerModeNew.ts src/modes/MultiplayerMode.ts
```

### Update Imports

Search and replace across codebase:

- `SoloGameMode` → `SoloMode`
- `MultiplayerGameMode` → `MultiplayerMode`
- `GameModeBase` → `BaseMode`

**Phase 7 Complete Checklist:**

- [ ] Old files deleted (including ConnectionMonitor.ts)
- [ ] New files renamed
- [ ] All imports updated
- [ ] No TypeScript errors
- [ ] Application builds successfully

---

## Phase 8: Testing & Validation

**Goal:** Comprehensive testing of new architecture.

**Effort:** 4-6 hours

### Test Checklist

**Solo Mode:**

- [ ] Can start solo game from menu
- [ ] Cards dealt correctly
- [ ] Bidding works
- [ ] Card play works
- [ ] AI players work
- [ ] Trick collection works
- [ ] Round completion works
- [ ] Game completion works
- [ ] Restart works
- [ ] Return to menu works

**Multiplayer Mode:**

- [ ] Can create room
- [ ] Can join room
- [ ] Player list updates
- [ ] Ready system works
- [ ] Game starts when all ready
- [ ] Cards dealt
- [ ] Bidding synchronized
- [ ] Card play synchronized
- [ ] Trick collection synchronized
- [ ] Reactions work
- [ ] Chat works
- [ ] Round completion works
- [ ] Game completion works
- [ ] Reconnection works
- [ ] Leave room works

**Architecture:**

- [ ] ServiceLocator accessible everywhere
- [ ] EventBus receives all events
- [ ] ScopedEventBus auto-cleans on scene shutdown
- [ ] NetworkService publishes events
- [ ] NetworkService handles connection monitoring
- [ ] NetworkService handles auto-reconnection
- [ ] GameInstance manages lifecycle
- [ ] Registries work correctly
- [ ] No circular dependencies
- [ ] No memory leaks

### Performance Testing

- [ ] No performance regression
- [ ] Memory usage similar or better
- [ ] Network latency unchanged
- [ ] Frame rate stable

---

## Rollback Plan

If critical issues arise at any phase:

### Phase 1-2 Rollback

Simply don't use new services. Old code still works.

### Phase 3-4 Rollback

Keep old GameManager and game modes. Don't switch to new ones.

### Phase 5-6 Rollback

```bash
git revert <commit-hash>
```

Restore LobbyScene and GameScene to previous versions.

### Phase 7-8 Rollback

```bash
git checkout <previous-branch>
```

---

## Post-Migration Tasks

### Documentation

- [ ] Update README with new architecture
- [ ] Document service registration process
- [ ] Document how to add new games
- [ ] Document how to add new modes

### Code Quality

- [ ] Run linter
- [ ] Fix any warnings
- [ ] Add JSDoc comments
- [ ] Update type definitions

### Future Enhancements

- [ ] Add more games (Mindi, etc.)
- [ ] Add tournament mode
- [ ] Add practice mode
- [ ] Add spectator mode

---

## Timeline Estimate

| Phase     | Description       | Estimated Time  |
| --------- | ----------------- | --------------- |
| 1         | Service Layer     | 4-6 hours       |
| 2         | Game Framework    | 6-8 hours       |
| 3         | Extract CallBreak | 8-10 hours      |
| 4         | Refactor Modes    | 10-12 hours     |
| 5         | Update LobbyScene | 4-6 hours       |
| 6         | Update GameScene  | 6-8 hours       |
| 7         | Delete Old Code   | 2-3 hours       |
| 8         | Testing           | 4-6 hours       |
| **Total** |                   | **44-59 hours** |

**For 1 developer working full-time:** 6-8 working days
**For 1 developer working part-time (4h/day):** 11-15 calendar days

---

## Success Criteria

Migration is complete when:

1. All old manager files deleted (including ConnectionMonitor.ts)
2. Services registered and working
3. EventBus handling all events with typed event maps
4. ScopedEventBus auto-cleaning listeners on scene shutdown
5. CallBreakGame extracted with rendering config (phases, action panels, card play handler)
6. New modes working
7. LobbyScene using services and ScopedEventBus
8. GamePlayScene using GameInstance, ScopedEventBus, and dynamic action panels
9. NetworkService handling connection monitoring and auto-reconnection
10. All tests passing
11. No TypeScript errors
12. Application runs without issues

---

## Questions & Support

Before starting migration:

**Clarify:**

- [ ] Should we migrate presence/audio managers too?
- [ ] Do we need to support old save games?
- [ ] What's the rollback deadline?

**During migration:**

- Create feature branch: `feature/game-framework-migration`
- Make frequent commits at each phase
- Test thoroughly before moving to next phase
- Document any issues encountered

---

## Conclusion

This migration plan provides a **safe, incremental approach** to refactoring the architecture. Each phase builds on the previous one, with testing checkpoints and rollback options.

The new architecture will enable:

- Easy addition of new games
- Easy addition of new modes
- Better separation of concerns
- Improved testability
- Industry-standard patterns
- Scalable codebase

**Recommendation:** Execute this migration in a dedicated sprint with thorough testing at each phase.
