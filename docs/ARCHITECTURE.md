# Call Break - Technical Architecture

## Overview

Call Break is a multiplayer trick-taking card game built with **Phaser 3** (client) and **Colyseus** (server). The architecture uses the **Abstract Factory Pattern** to cleanly separate solo (vs bots) and multiplayer (networked) game modes.

## Core Architecture Pattern

```
GameScene/UIScene
       ↓
  GameModeBase (abstract)
       ↓
   ┌───┴───┐
   ↓       ↓
Solo    Multiplayer
   ↓       ↓
GameMgr NetworkMgr
```

### Game Mode Abstraction

**`GameModeBase`** (abstract class) defines the contract:

- Lifecycle: `initialize()`, `startGame()`, `cleanup()`
- Player management: `createPlayers()`, `getPlayers()`
- Game actions: `onBidSelected()`, `onCardPlayed()`
- Events: `on()`, `off()` (EventEmitter pattern)

**Two Implementations:**

1. **`SoloGameMode`** → delegates to **`GameManager`**
   - Local game state and AI bot logic
   - Extends Phaser.Events.EventEmitter
   - Handles turn order, trick evaluation, scoring

2. **`MultiplayerGameMode`** → delegates to **`NetworkManager`**
   - Colyseus client wrapper
   - Server-authoritative state
   - Sends actions, receives state updates

**`GameModeFactory`** creates instances:

```typescript
const mode = GameModeFactory.createGameMode(
  isMultiplayer ? GameModeType.MULTIPLAYER : GameModeType.SOLO,
  { networkManager, trickArea, audioManager },
);
```

## Scene Flow

```
BootScene (asset loading)
    ↓
MenuScene (solo vs multiplayer selection)
    ↓
    ├─→ LobbyScene (multiplayer) → create/join room
    │        ↓
    └────────→ GameScene + UIScene (overlay)
```

### Scene Responsibilities

**`GameScene`** - Game rendering and player objects

- Creates game mode via factory
- Renders players, cards, trick area
- Forwards events between game mode and UI
- Handles multiplayer-specific UI (network indicator, reconnection overlay)

**`UIScene`** - HUD overlay (launched by GameScene)

- ScoreBoard, BiddingUI, Modals (round/game over/settings)
- Listens to unified game mode events (no mode conditionals!)
- Updates UI based on `phaseChanged`, `turnChanged`, `bidPlaced` events

**Key Principle:** Scenes depend on `GameModeBase` abstraction, NOT concrete implementations. No `if (isMultiplayer)` logic in event listeners.

## Managers

### GameManager (Solo Mode)

- Extends `Phaser.Events.EventEmitter`
- Manages game state: `phase`, `currentPlayerIndex`, `tricks`, `round`
- Bot AI with 3 difficulty levels (easy/medium/hard)
- Emits events: `EVENTS.PHASE_CHANGED`, `EVENTS.TURN_CHANGED`, `EVENTS.BID_PLACED`, etc.

### NetworkManager (Multiplayer)

- Colyseus client wrapper with event forwarding
- Room management: create (6-digit codes), join, leave, reconnection
- Sends actions: `sendBid()`, `sendPlayCard()`, `sendNextRound()`
- Receives state updates and emits events matching GameManager's interface

### AudioManager

- Singleton-like service for sound effects and background music
- Card sounds, win sounds, ambient music
- Volume control and mute functionality

## Game Objects

**`Player`** - Player entity (visual + data)

- Position index (0=bottom/local, 1=left, 2=top, 3=right)
- Contains `Hand` object for card management
- Stores `bid`, `tricksWon`, `score`
- In multiplayer: has `networkId` and `absoluteSeatIndex` for server communication

**`Hand`** - Card collection with fan layout

- Manages playable card validation (follows suit rules)
- Smooth animations for add/remove/reorganize
- Different layouts for local player (bottom, interactive) vs opponents (top/sides, card backs)

**`Card`** - Individual card sprite

- Properties: `suit`, `rank`, `id`
- Interactive (if playable) or disabled
- Tween animations for play/collect

**`TrickArea`** - Central area where cards are played

- 4 positions for played cards (relative to local player)
- Animations: card fly-in, winner collection
- `clear()` between tricks

**`BotAI`** - AI player logic (solo mode only)

- Three difficulty levels:
  - Easy: Random valid cards
  - Medium: Basic strategy (lead trump, follow high)
  - Hard: Advanced (count cards, calculate win probability)

## State Synchronization

### Solo Mode

- **Client-authoritative**: GameManager owns all state
- Events emitted immediately after state changes
- Deterministic: all logic runs locally

### Multiplayer Mode

- **Server-authoritative**: Colyseus room state is source of truth
- Client sends actions → Server validates → Broadcasts state change
- Schema-based state sync (Colyseus `@type` decorators)
- Reconnection: client re-syncs hand and game state on rejoin

## Event Flow Example: Playing a Card

### Solo Mode

```
Player clicks card → Hand validates
  ↓
onCardPlayed(cardData)
  ↓
SoloGameMode.onCardPlayed()
  ↓
GameManager.playCard()
  ↓
GameManager updates state + emits "cardPlayed"
  ↓
GameScene listener → TrickArea.playCard() + audio
```

### Multiplayer Mode

```
Player clicks card → Hand validates
  ↓
onCardPlayed(cardData)
  ↓
MultiplayerGameMode.onCardPlayed()
  ↓
NetworkManager.sendPlayCard(cardId)
  ↓
Server validates + broadcasts state
  ↓
NetworkManager receives "cardPlayed" event
  ↓
Emits "cardPlayed" (matching GameManager interface)
  ↓
GameScene listener → TrickArea.playCard() + audio
```

**Key insight:** Both modes emit the same events, so GameScene/UIScene code is identical.

## File Structure

```
src/
├── scenes/
│   ├── BootScene.ts          # Asset loading
│   ├── MenuScene.ts          # Main menu
│   ├── LobbyScene.ts         # Multiplayer lobby
│   ├── GameScene.ts          # Main game (uses GameModeBase)
│   └── UIScene.ts            # HUD overlay (uses GameModeBase)
├── modes/
│   ├── GameModeBase.ts       # Abstract class (override keyword pattern)
│   ├── SoloGameMode.ts       # Delegates to GameManager
│   ├── MultiplayerGameMode.ts # Delegates to NetworkManager
│   └── GameModeFactory.ts    # Factory (Abstract Factory Pattern)
├── managers/
│   ├── GameManager.ts        # Solo game logic + EventEmitter
│   ├── NetworkManager.ts     # Colyseus client wrapper
│   └── AudioManager.ts       # Sound management
├── objects/
│   ├── Player.ts             # Player entity
│   ├── Hand.ts               # Card collection
│   ├── Card.ts               # Individual card
│   ├── TrickArea.ts          # Central play area
│   └── game/                 # UI components (ScoreBoard, Modals, etc.)
├── ai/
│   └── BotAI.ts              # AI difficulty levels
└── utils/
    └── constants.ts          # Game rules (TRUMP_SUIT='spades', etc.)

server/
├── src/
│   ├── index.ts              # Express + Colyseus setup
│   └── rooms/
│       ├── CallBreakRoom.ts  # Main game room logic
│       └── GameState.ts      # Colyseus Schema state
```

## Design Patterns Used

1. **Abstract Factory Pattern** - `GameModeFactory` creates game mode instances
2. **Strategy Pattern** - Different mode implementations with unified interface
3. **Observer Pattern** - EventEmitter for state change notifications
4. **Singleton Pattern** - AudioManager (one instance per scene)
5. **Facade Pattern** - NetworkManager wraps Colyseus complexity

## Game Rules (Constants)

- **Trump Suit**: Always Spades (hardcoded)
- **Players**: 4 (1 human + 3 bots in solo, 4 humans in multiplayer)
- **Rounds**: 5 total
- **Cards per player**: 13 (standard 52-card deck)
- **Bidding**: 1-8 tricks (max bid = 8)
- **Scoring**:
  - Met bid: `bid * 10 + (tricks - bid)`
  - Missed bid: `-bid * 10`

## Async/Await Critical Points

- **`cleanup()`** - Must be async to properly close WebSocket connections
- **`initialize()`** - Async for future asset loading or network setup
- **`returnToMenu()`** - Awaits cleanup before scene transition

## Testing Strategy

- **Manual Testing**: Play through full game in both modes
- **Network Testing**: Test reconnection, disconnect, lag scenarios
- **Bot AI Testing**: Verify each difficulty level plays valid moves
- **State Sync Testing**: Ensure multiplayer state matches across all clients

## Key Technical Decisions

1. **Why Abstract Class over Interface?**
   - Provides default implementations (console.error/warn)
   - `override` keyword improves readability (shows what's custom)
   - Better developer experience with runtime errors

2. **Why EventEmitter Pattern?**
   - Decouples game logic from UI rendering
   - Easy to add new listeners without modifying emitters
   - Phaser has built-in EventEmitter support

3. **Why Server-Authoritative Multiplayer?**
   - Prevents cheating (card counting, illegal moves)
   - Single source of truth for game state
   - Easier to maintain consistency across clients

4. **Why Separate GameScene and UIScene?**
   - Separation of concerns (game rendering vs HUD)
   - Easier to show/hide UI elements
   - Independent update cycles

## Common Gotchas

- **Bidding Modal Appearing Twice**: Only show on `turnChanged` event, NOT `phaseChanged`
- **WebSocket Not Closing**: Must await `cleanup()` in `returnToMenu()`
- **Relative vs Absolute Player Positions**: Multiplayer uses both (relative for visuals, absolute for server)
- **Card Validation**: Different logic for local player (actual cards) vs remote (placeholder card backs)
