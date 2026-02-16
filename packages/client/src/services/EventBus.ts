import Phaser from 'phaser';
import type {
  CardData,
  PlayerData,
  ConnectionQuality,
  ReactionData,
} from '../type.d';
import type { ChatMessage } from '@call-break/shared';

// ===== Typed Event Maps =====

export interface GameEventMap {
  phaseChanged: { phase: string };
  cardPlayed: { playerId: string; card: CardData };
  turnChanged: { playerId: string; isMyTurn?: boolean };
  trickComplete: { winnerId: string };
  bidPlaced: { playerIndex: number; bid: number };
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
 * Publishers: NetworkService, GameInstance, game modes
 * Subscribers: Scenes, UI components, game modes
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

  // Network events
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

  // Game events
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

  // Lobby events
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
   * All listeners are automatically removed when the scene shuts down.
   */
  subscribeTo(scene: Phaser.Scene): ScopedEventBus {
    return new ScopedEventBus(this, scene);
  }

  override destroy(): void {
    this.removeAllListeners();
  }
}

/**
 * Scene-scoped event bus wrapper.
 * CRITICAL: Automatically cleans up all listeners when scene shuts down.
 * Prevents memory leaks from orphaned event handlers.
 *
 * Usage:
 *   const events = eventBus.subscribeTo(this);
 *   events.onGameEvent('phaseChanged', (data) => { ... });
 *   // No manual cleanup needed — auto-removed on scene shutdown
 */
export class ScopedEventBus {
  private listeners: Array<{ event: string; fn: (data: unknown) => void }> = [];
  private bus: EventBus;
  private scene: Phaser.Scene;

  constructor(bus: EventBus, scene: Phaser.Scene) {
    this.bus = bus;
    this.scene = scene;
    // CRITICAL: Auto-cleanup on scene shutdown
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
      this.bus.removeListener(event, fn, this.scene);
    }
    this.listeners = [];
  }
}
