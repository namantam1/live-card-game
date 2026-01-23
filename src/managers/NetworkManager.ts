import { Client, Room } from "colyseus.js";
import type {
  CardData,
  CardSchema,
  ConnectionQuality,
  PlayerData,
  PlayerSchema,
  RoomAvailability,
  TrickEntrySchema,
} from "../type";
import { Suit } from "../utils/constants";

type EventCallback = (data?: any) => void;

export default class NetworkManager {
  private client: Client | null;
  private room: Room | null;
  private connected: boolean;
  private roomCode: string | null;
  playerId: string | null;
  private seatIndex: number;

  // Event listeners
  private listeners: Map<string, Set<EventCallback>>;

  // Reconnection state
  private reconnecting: boolean;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number;
  private reconnectDelay: number;
  private reconnectTimer: NodeJS.Timeout | null;

  // Connection monitoring
  private connectionQuality: ConnectionQuality;
  private lastPingTime: number;
  private pingInterval: NodeJS.Timeout | null;
  private pingTimeout: number;
  private serverUrl: string | null;

  // Saved state for reconnection (using new Colyseus reconnectionToken API)
  private reconnectionToken: string | null;

  constructor() {
    this.client = null;
    this.room = null;
    this.connected = false;
    this.roomCode = null;
    this.playerId = null;
    this.seatIndex = -1;

    // Event listeners
    this.listeners = new Map();

    // Reconnection state
    this.reconnecting = false;
    this.maxReconnectAttempts = 3;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 2000;
    this.reconnectTimer = null;

    // Connection monitoring
    this.connectionQuality = "good"; // 'good', 'fair', 'poor', 'offline'
    this.lastPingTime = Date.now();
    this.pingInterval = null;
    this.pingTimeout = 5000;
    this.serverUrl = null;

    // Saved state for reconnection (using new Colyseus reconnectionToken API)
    this.reconnectionToken = null;
  }

  async connect(serverUrl: string): Promise<boolean> {
    try {
      this.serverUrl = serverUrl;
      this.client = new Client(serverUrl);
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log("NetworkManager: Connected to server");
      this.emit("connectionChange", { quality: "good", connected: true });
      return true;
    } catch (error) {
      console.error("NetworkManager: Connection failed", error);
      this.connected = false;
      this.emit("connectionChange", { quality: "offline", connected: false });
      return false;
    }
  }

  async createRoom(playerName: string): Promise<Room | null> {
    if (!this.client) {
      console.error("NetworkManager: Not connected to server");
      return null;
    }

    try {
      this.room = await this.client.create("call_break", { name: playerName });
      this.playerId = this.room.sessionId;

      this.setupRoomListeners();

      console.log("NetworkManager: Room created, waiting for room code...");
      return this.room;
    } catch (error) {
      console.error("NetworkManager: Failed to create room", error);
      return null;
    }
  }

  async joinRoom(roomCode: string, playerName: string): Promise<Room | null> {
    if (!this.client) {
      console.error("NetworkManager: Not connected to server");
      return null;
    }

    try {
      // Find rooms with matching code
      const rooms = await this.client.getAvailableRooms("call_break");
      const targetRoom = rooms.find(
        (r: RoomAvailability) => r.metadata?.roomCode === roomCode,
      );

      if (!targetRoom) {
        console.error("NetworkManager: Room not found with code:", roomCode);
        throw new Error("Room not found. Please check the room code.");
      }

      this.room = await this.client.joinById(targetRoom.roomId, {
        name: playerName,
      });
      this.playerId = this.room.sessionId;
      this.setupRoomListeners();

      console.log("NetworkManager: Joined room");
      return this.room;
    } catch (error) {
      console.error("NetworkManager: Failed to join room", error);
      throw error;
    }
  }

  setupRoomListeners(): void {
    if (!this.room) return;

    // Save reconnection token for the new Colyseus API
    this.reconnectionToken = this.room.reconnectionToken;

    // Start connection monitoring
    this.startConnectionMonitoring();

    // Handle seat assignment
    this.room.onMessage(
      "seated",
      (data: { seatIndex: number; roomCode: string }) => {
        this.seatIndex = data.seatIndex;
        this.roomCode = data.roomCode;
        console.log(
          `NetworkManager: Seated at ${this.seatIndex}, room code: ${this.roomCode}`,
        );
        this.emit("seated", data);
      },
    );

    // Handle dealt notification
    this.room.onMessage("dealt", () => {
      console.log("NetworkManager: Cards dealt");
      this.emit("dealt");
    });

    // Handle player left
    this.room.onMessage("playerLeft", (data: { name: string }) => {
      console.log(`NetworkManager: ${data.name} left`);
      this.emit("playerLeft", data);
    });

    // State change listeners
    this.room.state.listen("phase", (value: string, previousValue: string) => {
      console.log(
        `NetworkManager: Phase changed from ${previousValue} to ${value}`,
      );

      // Add extra validation during critical phase transitions
      if (value === "trickEnd") {
        console.log("NetworkManager: Entering trickEnd phase");
        console.log(
          "  - Current trick count:",
          this.room?.state?.currentTrick?.length || 0,
        );
        console.log(
          "  - Trick winner:",
          this.room?.state?.trickWinner || "not set",
        );
      }

      this.emit("phaseChange", { phase: value, previousPhase: previousValue });
    });

    this.room.state.listen("currentTurn", (value: string) => {
      console.log(`NetworkManager: Turn changed to ${value}`);
      this.emit("turnChange", {
        playerId: value,
        isMyTurn: value === this.playerId,
      });
    });

    this.room.state.listen("leadSuit", (value: string) => {
      this.emit("leadSuitChange", value);
    });

    this.room.state.listen("trickWinner", (value: string) => {
      if (value) {
        this.emit("trickWinner", value);
      }
    });

    this.room.state.listen("currentRound", (value: number) => {
      this.emit("roundChange", value);
    });

    this.room.state.listen("trickNumber", (value: number) => {
      this.emit("trickNumberChange", value);
    });

    // Player state changes
    this.room.state.players.onAdd((player: PlayerSchema, sessionId: string) => {
      console.log(`NetworkManager: Player ${player.name} joined`);
      this.emit("playerJoined", { player, sessionId });

      // Listen to player changes
      player.listen("bid", (value: number) => {
        this.emit("playerBid", { playerId: sessionId, bid: value });
      });

      player.listen("tricksWon", (value: number) => {
        this.emit("playerTricksWon", { playerId: sessionId, tricksWon: value });
      });

      player.listen("score", (value: number) => {
        this.emit("playerScoreChange", { playerId: sessionId, score: value });
      });

      player.listen("roundScore", (value: number) => {
        this.emit("playerRoundScore", {
          playerId: sessionId,
          roundScore: value,
        });
      });

      player.listen("isReady", (value: boolean) => {
        this.emit("playerReady", { playerId: sessionId, isReady: value });
      });

      player.listen("isConnected", (value: boolean) => {
        this.emit("playerConnection", {
          playerId: sessionId,
          isConnected: value,
        });
      });

      // Hand changes
      player.hand.onAdd((card: CardSchema, index: number) => {
        if (sessionId === this.playerId) {
          // For local player, emit the actual card
          this.emit("cardAdded", { card: this.cardToObject(card), index });
        } else {
          // For remote players, emit hand count change for visual update
          this.emit("remoteHandChanged", {
            playerId: sessionId,
            handCount: player.hand.length,
          });
        }
      });

      player.hand.onRemove((card: CardSchema, index: number) => {
        if (sessionId === this.playerId) {
          this.emit("cardRemoved", { cardId: card.id, index });
        } else {
          // For remote players, emit hand count change for visual update
          this.emit("remoteHandChanged", {
            playerId: sessionId,
            handCount: player.hand.length,
          });
        }
      });
    });

    this.room.state.players.onRemove(
      (player: PlayerSchema, sessionId: string) => {
        console.log(`NetworkManager: Player ${player.name} removed`);
        this.emit("playerRemoved", { player, sessionId });
      },
    );

    // Current trick changes
    this.room.state.currentTrick.onAdd((entry: TrickEntrySchema) => {
      console.log(`NetworkManager: Card played by ${entry.playerId}`);
      this.emit("cardPlayed", {
        playerId: entry.playerId,
        card: this.cardToObject(entry.card),
      });
    });

    this.room.state.currentTrick.onRemove(() => {
      this.emit("trickCleared");
    });

    // Room error handling
    this.room.onError((code: number, message?: string) => {
      console.error(`NetworkManager: Room error ${code}: ${message}`);
      this.emit("error", { code, message });
    });

    // Room leave handling
    this.room.onLeave((code: number) => {
      console.log(`NetworkManager: Left room with code ${code}`);

      // Stop connection monitoring
      this.stopConnectionMonitoring();

      // Check if this was an unexpected disconnect
      if (code !== 1000 && code !== 4000) {
        console.log(
          "NetworkManager: Unexpected disconnect, attempting reconnection...",
        );
        this.handleUnexpectedDisconnect();
      } else {
        // Clean disconnect
        this.emit("roomLeft", { code });
        this.room = null;
        this.roomCode = null;
        this.reconnectionToken = null;
      }
    });
  }

  cardToObject(card: CardSchema): CardData {
    return {
      id: card.id,
      suit: card.suit as CardData["suit"],
      rank: card.rank as CardData["rank"],
      value: card.value,
    };
  }

  sendReady(): void {
    if (this.room) {
      this.room.send("ready");
      console.log("NetworkManager: Sent ready");
    }
  }

  sendBid(bid: number): void {
    if (this.room) {
      this.room.send("bid", { bid });
      console.log(`NetworkManager: Sent bid ${bid}`);
    }
  }

  sendPlayCard(cardId: string): void {
    if (this.room) {
      this.room.send("playCard", { cardId });
      console.log(`NetworkManager: Sent playCard ${cardId}`);
    }
  }

  sendNextRound(): void {
    if (this.room) {
      this.room.send("nextRound");
      console.log("NetworkManager: Sent nextRound");
    }
  }

  sendRestart(): void {
    if (this.room) {
      this.room.send("restart");
      console.log("NetworkManager: Sent restart");
    }
  }

  getState(): any {
    return this.room?.state || null;
  }

  getMyHand(): CardData[] {
    if (!this.room || !this.playerId) return [];
    const player = this.room.state.players.get(this.playerId);
    if (!player) return [];
    return Array.from(player.hand).map((c) =>
      this.cardToObject(c as CardSchema),
    );
  }

  getPlayers(): PlayerData[] {
    if (!this.room) return [];
    const players: PlayerData[] = [];
    this.room.state.players.forEach(
      (player: PlayerSchema, sessionId: string) => {
        players.push({
          id: sessionId,
          name: player.name,
          emoji: player.emoji,
          seatIndex: player.seatIndex,
          isReady: player.isReady,
          isConnected: player.isConnected,
          bid: player.bid,
          tricksWon: player.tricksWon,
          score: player.score,
          roundScore: player.roundScore,
          isLocal: sessionId === this.playerId,
        });
      },
    );
    return players.sort((a, b) => a.seatIndex - b.seatIndex);
  }

  getPlayer(sessionId: string): PlayerSchema | null {
    return this.room?.state.players.get(sessionId) || null;
  }

  isMyTurn(): boolean {
    return this.room?.state.currentTurn === this.playerId;
  }

  getPhase(): string {
    return this.room?.state.phase || "waiting";
  }

  getLeadSuit(): Suit {
    return this.room?.state.leadSuit || "";
  }

  getRoomCode(): string | null {
    return this.roomCode;
  }

  async leaveRoom(): Promise<void> {
    if (this.room) {
      await this.room.leave(true); // Pass true to indicate consented leave
      this.room = null;
      this.roomCode = null;
      this.seatIndex = -1;
    }
  }

  disconnect(): void {
    this.stopConnectionMonitoring();
    this.cancelReconnection();
    this.leaveRoom();
    this.client = null;
    this.connected = false;
    this.reconnectionToken = null;
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  isInRoom(): boolean {
    return this.room !== null;
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  emit(event: string, data?: any): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback: EventCallback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`NetworkManager: Error in ${event} listener`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  startConnectionMonitoring(): void {
    if (this.pingInterval) return;

    this.lastPingTime = Date.now();
    this.connectionQuality = "good";

    // Monitor state updates to detect connection health
    this.pingInterval = setInterval(() => {
      const timeSinceLastPing = Date.now() - this.lastPingTime;

      if (timeSinceLastPing > this.pingTimeout * 3) {
        // No updates for a long time - poor connection or offline
        this.updateConnectionQuality("offline");
      } else if (timeSinceLastPing > this.pingTimeout * 2) {
        // Slow connection
        this.updateConnectionQuality("poor");
      } else if (timeSinceLastPing > this.pingTimeout) {
        // Fair connection
        this.updateConnectionQuality("fair");
      } else {
        // Good connection
        this.updateConnectionQuality("good");
      }
    }, 2000);

    // Update ping time whenever we receive state updates
    if (this.room && this.room.state) {
      const originalOnChange = this.room.state.onChange || (() => {});
      this.room.state.onChange = () => {
        this.lastPingTime = Date.now();
        originalOnChange();
      };
    }
  }

  stopConnectionMonitoring(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  updateConnectionQuality(quality: ConnectionQuality): void {
    if (this.connectionQuality !== quality) {
      this.connectionQuality = quality;
      console.log(`NetworkManager: Connection quality changed to ${quality}`);
      this.emit("connectionQualityChange", {
        quality,
        connected: quality !== "offline",
      });
    }
  }

  getConnectionQuality(): ConnectionQuality {
    return this.connectionQuality;
  }

  async handleUnexpectedDisconnect(): Promise<void> {
    if (this.reconnecting) return;

    this.reconnecting = true;
    this.updateConnectionQuality("offline");
    this.emit("reconnecting", { attempt: this.reconnectAttempts + 1 });

    await this.attemptReconnection();
  }

  async attemptReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("NetworkManager: Max reconnection attempts reached");
      this.reconnecting = false;
      this.emit("reconnectionFailed", {
        message: "Could not reconnect to the game",
      });
      this.emit("roomLeft", { code: 1006 }); // Abnormal closure
      this.room = null;
      this.roomCode = null;
      this.reconnectionToken = null;
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `NetworkManager: Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
    );

    try {
      // Try to reconnect using the reconnectionToken (new Colyseus API)
      if (this.reconnectionToken && this.client) {
        this.room = await this.client.reconnect(this.reconnectionToken);

        // Reconnection successful
        console.log("NetworkManager: Reconnection successful!");
        this.reconnecting = false;
        this.reconnectAttempts = 0;
        this.updateConnectionQuality("good");

        // Update reconnection token for future reconnections
        this.reconnectionToken = this.room.reconnectionToken;

        // Re-setup listeners
        this.setupRoomListeners();

        this.emit("reconnected", {
          message: "Reconnected to game",
        });
      } else {
        throw new Error("No reconnection token available");
      }
    } catch (error) {
      console.error("NetworkManager: Reconnection failed", error);

      // Schedule next attempt with exponential backoff
      const delay =
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`NetworkManager: Retrying in ${delay}ms...`);

      this.reconnectTimer = setTimeout(() => {
        this.attemptReconnection();
      }, delay);
    }
  }

  cancelReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
    this.reconnectAttempts = 0;
  }

  isReconnecting(): boolean {
    return this.reconnecting;
  }
}
