# Colyseus 0.17.x Quick Reference

**Minimal, focused documentation for day-to-day development.**

📚 **Official Docs**: https://docs.colyseus.io/

## Core Concepts

- **Rooms**: Isolated game sessions with shared state
- **State Sync**: Automatic state synchronization from server to clients
- **Messages**: Bidirectional communication between client and server

---

## Server: Room Definition

📖 [Room API Reference](https://docs.colyseus.io/room)

### Basic Structure

```typescript
import { Room, Client } from 'colyseus';
import { MyState } from './MyState';

export class MyRoom extends Room {
  state = new MyState();
  maxClients = 4;
  patchRate = 50; // State sync rate in ms (default: 50ms/20fps)
  autoDispose = true; // Auto-dispose when empty (default: true)

  messages = {
    move: (client, data) => {
      const player = this.state.players.get(client.sessionId);
      player.x = data.x;
      player.y = data.y;
    },
  };

  onCreate(options) {}
  onJoin(client, options, auth?) {}
  onLeave(client, code?) {}
  onDispose() {}
}
```

### Lifecycle Methods

📖 [Lifecycle Events](https://docs.colyseus.io/room#lifecycle-events)

```typescript
onCreate(options)           // Room created
onJoin(client, options)     // Client joined
onDrop(client)              // Client disconnected (use with allowReconnection)
onReconnect(client)         // Client reconnected
onLeave(client, code?)      // Client left permanently
onDispose()                 // Room cleanup before destruction
```

**Best Practice**: Use `onDrop` for reconnection handling, `onLeave` for cleanup.

### Message Handling

📖 [Message Handling](https://docs.colyseus.io/room#message-handling)

```typescript
messages = {
  action: (client, payload) => {
    // Handle specific message
  },
  '*': (client, type, payload) => {
    // Fallback for unhandled messages
  },
};
```

**With validation** (recommended):

```typescript
import { validate } from 'colyseus';
import { z } from 'zod';

messages = {
  move: validate(
    z.object({
      x: z.number(),
      y: z.number(),
    }),
    (client, data) => {
      // data is typed and validated
    }
  ),
};
```

### Common Methods

```typescript
// Broadcasting
this.broadcast('message-type', data);
this.broadcast('msg', data, { except: client }); // Exclude client
client.send('message-type', data); // Send to specific client

// Room control
this.lock(); // Remove from matchmaking
this.unlock(); // Return to matchmaking
await this.allowReconnection(client, 20); // 20 second reconnection window

// Timing (auto-cleaned on dispose)
this.clock.setTimeout(() => {}, 1000);
this.clock.setInterval(() => {}, 1000);
```

---

## Server: State Definition

📖 [State Synchronization](https://docs.colyseus.io/state) | [Schema Definition](https://docs.colyseus.io/state/schema)

### Schema Classes

```typescript
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') name: string;
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('boolean') connected: boolean = true;
}

export class MyState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type(['string']) messages = new ArraySchema<string>();
  @type('number') roundTime: number = 60;
}
```

### Supported Types

- Primitives: `"string"`, `"number"`, `"boolean"`, `"int8"` through `"uint64"`
- Collections: `{ map: Type }`, `{ set: Type }`, `["type"]` (array)
- Nested: Custom Schema classes

**Limitation**: Max 64 fields per Schema. Use nested structures if needed.

---

## Server: Room Registration

📖 [Server API](https://docs.colyseus.io/server)

```typescript
// app.config.ts
import { defineServer, defineRoom } from 'colyseus';
import { MyRoom } from './MyRoom';

const server = defineServer({
  rooms: {
    my_room: defineRoom(MyRoom),
  },
});
```

---

## Client: Connection

📖 [Client SDK](https://docs.colyseus.io/sdk)

### Setup

```typescript
import { Client } from '@colyseus/sdk';

const client = new Client('http://localhost:2567');
```

### Join Methods

```typescript
// Recommended: Join or create
const room = await client.joinOrCreate('my_room', {
  /* options */
});

// Others
await client.create('my_room', options); // Always create new
await client.join('my_room', options); // Join existing
await client.joinById('roomId', options); // Join by ID (for invites)
```

### Basic Room API

```typescript
room.sessionId; // Your unique session ID
room.roomId; // Room ID (shareable)
room.state; // Current synchronized state
room.reconnectionToken; // For manual reconnection

// Leave room
room.leave(); // Consented leave
room.leave(false); // Simulate unexpected disconnect
```

---

## Client: Messages

📖 [Send and Receive Messages](https://docs.colyseus.io/sdk#send-and-receive-messages)

### Send

```typescript
room.send('move', { x: 10, y: 20 });
```

### Receive

```typescript
room.onMessage('powerup', (data) => {
  console.log('Powerup received:', data);
});
```

---

## Client: State Sync

📖 [State Sync Callbacks](https://docs.colyseus.io/sdk/state-sync-callbacks)

### Listen to Changes

```typescript
import { Callbacks } from '@colyseus/sdk';

const callbacks = Callbacks.get(room);

// Collection changes
callbacks.onAdd('players', (player, sessionId) => {
  console.log('Player added:', player);
});

callbacks.onRemove('players', (player, sessionId) => {
  console.log('Player removed:', player);
});

// Instance changes
callbacks.onChange(player, () => {
  console.log('Player changed:', player.x, player.y);
});

// Property changes
callbacks.listen(player, 'x', (newValue, oldValue) => {
  console.log(`x changed from ${oldValue} to ${newValue}`);
});
```

### Full State Change

```typescript
room.onStateChange.once((state) => {
  console.log('First state received:', state);
});

room.onStateChange((state) => {
  console.log('State updated:', state);
});
```

---

## Client: Lifecycle Events

📖 [Connection Lifecycle](https://docs.colyseus.io/sdk#connection-lifecycle)

```typescript
room.onLeave((code) => {
  console.log('Left room, code:', code);
});

room.onError((code, message) => {
  console.error('Error:', message);
});

// Reconnection (automatic by default)
room.onDrop((code, reason) => {
  console.log('Connection dropped, reconnecting...');
});

room.onReconnect(() => {
  console.log('Reconnected!');
});
```

---

## Reconnection

📖 [Reconnection Handling](https://docs.colyseus.io/room/reconnection) | [Allow Reconnection](https://docs.colyseus.io/room#allow-reconnection)

### Server-Side

```typescript
async onDrop(client, code) {
  // Flag as inactive
  this.state.players.get(client.sessionId).connected = false;

  // Allow 20 second reconnection window
  try {
    await this.allowReconnection(client, 20);
  } catch (e) {
    // Reconnection timed out
  }
}

onReconnect(client) {
  this.state.players.get(client.sessionId).connected = true;
}

onLeave(client, code) {
  // Only called if reconnection fails or client.leave() called
  this.state.players.delete(client.sessionId);
}
```

### Client-Side (Automatic)

Automatic reconnection enabled by default. Configure if needed:

```typescript
room.reconnection.maxRetries = 10;
room.reconnection.maxDelay = 10000; // 10 seconds
room.reconnection.minUptime = 3000; // Must be connected 3s before reconnect allowed
```

---

## Best Practices

### State Management

- **Server authority**: Only server mutates state
- **Clients request changes**: Use messages to request state mutations
- **Granular updates**: Only changed properties are sent (automatic)
- **Batch updates**: Multiple changes in single tick sent together

### Message Patterns

- Use validation for all incoming messages
- Keep messages small and focused
- Use number types for high-frequency messages (smaller than strings)

### Performance

- Default `patchRate: 50ms` (20fps) is good for most games
- Increase for slower games, decrease for fast-paced (min: 16ms/60fps)
- Use `@type("int8")` etc. for smaller data types when appropriate
- Avoid unnecessary nested structures

### Reconnection

- Always implement `onDrop` + `allowReconnection` for production
- Store critical data in state for reconnection recovery
- Use `client.userData` for session-only data

---

## Common Patterns

### Player Join/Leave

```typescript
onJoin(client, options) {
  const player = new Player();
  player.name = options.name || "Guest";
  this.state.players.set(client.sessionId, player);
}

async onDrop(client) {
  this.state.players.get(client.sessionId).connected = false;
  await this.allowReconnection(client, 30);
}

onReconnect(client) {
  this.state.players.get(client.sessionId).connected = true;
}

onLeave(client) {
  this.state.players.delete(client.sessionId);
}
```

### Game Loop

```typescript
onCreate() {
  this.setSimulationInterval((deltaTime) => {
    // Update game logic at 60fps
    this.updateGameLogic(deltaTime);
  }, 1000 / 60);
}

updateGameLogic(deltaTime) {
  // Mutate state here - will auto-sync
}
```

### Room Metadata (for matchmaking)

```typescript
onCreate(options) {
  this.setMetadata({
    mode: options.mode,
    players: 0,
    maxPlayers: this.maxClients
  });
}

onJoin() {
  this.setMetadata({ players: this.clients.length });
}
```

---

## TypeScript Config

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  }
}
```

---

## Additional Resources

### Core Documentation

- 🏠 [Home](https://docs.colyseus.io/)
- 🚀 [Getting Started](https://docs.colyseus.io/getting-started)
- 📚 [Tutorials](https://docs.colyseus.io/tutorial)
- 💡 [Best Practices](https://docs.colyseus.io/best-practices)
- 🎯 [Examples](https://docs.colyseus.io/examples)

### Advanced Topics

- 🔐 [Authentication](https://docs.colyseus.io/auth)
- 🌐 [Matchmaker API](https://docs.colyseus.io/matchmaker)
- 📡 [Presence (Pub/Sub)](https://docs.colyseus.io/server/presence)
- 🔍 [State View (Filtering)](https://docs.colyseus.io/state/view)
- ⏰ [Timing Events](https://docs.colyseus.io/room/timing-events)
- 🚦 [HTTP Routes](https://docs.colyseus.io/server/http-routes)
- 📦 [Deployment](https://docs.colyseus.io/deployment)
- 📈 [Scalability](https://docs.colyseus.io/scalability)

### Community

- 💬 [Discord](http://chat.colyseus.io/)
- 🐙 [GitHub](https://github.com/colyseus/colyseus)
- 📖 [Migration Guide (0.17)](https://docs.colyseus.io/migrating/0.17)

---

**Note**: This covers 90% of day-to-day Colyseus usage. For topics not covered here, use the links above.
