# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Call Break is a multiplayer card game built with Phaser 3 and Colyseus. The project consists of:

- **Client**: Phaser 3 game with PWA support (Vite build)
- **Server**: Colyseus multiplayer server (TypeScript)

## Development Commands

### Client (Root Directory)

```bash
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Build for production
npm run preview                # Preview production build
```

### Server (server/ Directory)

```bash
cd server
npm run dev                    # Start dev server with hot reload (port 2567)
npm run build                  # Compile TypeScript to dist/
npm start                      # Run production server from dist/
```

## Architecture

### Client Architecture

**Main Entry**: `src/main.js` - Phaser game initialization with scene registration and PWA setup

**Scene Flow**:

1. `BootScene` - Asset loading (cards, audio)
2. `MenuScene` - Main menu (solo vs multiplayer)
3. `LobbyScene` - Multiplayer lobby (create/join rooms)
4. `GameScene` - Main game rendering and player setup
5. `UIScene` - HUD overlay (scores, bids, controls)

**Managers** (Singleton-like services):

- `GameManager` - Solo game state, turn logic, scoring (EventEmitter pattern)
- `NetworkManager` - Colyseus client wrapper for multiplayer
- `AudioManager` - Sound effects and background music

**Game Objects**:

- `Card` (TypeScript) - Individual card with suit/rank
- `Hand` - Player's hand of cards with fan layout
- `Player` - Player entity (hand, score, bid)
- `TrickArea` - Central area where cards are played

**AI**: `BotAI` - Bot players with difficulty levels (easy/medium/hard) for solo mode

**Constants**: `src/utils/constants.ts` - Game rules (TRUMP_SUIT='spades', MAX_BID=8, etc.)

### Server Architecture

**Entry**: `server/src/index.ts` - Express + Colyseus server setup

**Game Room**: `server/src/rooms/CallBreakRoom.ts` - Main multiplayer room handling:

- Room creation with 6-digit codes
- Player join/leave
- Game state synchronization
- Turn-based action validation

**State**: `server/src/rooms/GameState.ts` - Colyseus Schema for state sync

### Key Patterns

1. **Dual Mode**: Game supports both solo (vs bots) and multiplayer (Colyseus). Mode selected in MenuScene, passed via `init(data)`.

2. **Manager Pattern**: GameManager (solo) vs NetworkManager (multiplayer) handle game logic separately.

3. **Event-Driven**: GameManager extends Phaser.Events.EventEmitter. UIScene listens to events like `EVENTS.PHASE_CHANGED`, `EVENTS.TURN_CHANGED`.

4. **State Sync**: In multiplayer, server is authoritative. Client sends actions (`room.send()`), server validates and broadcasts state changes.

5. **PWA**: Full offline support via Vite PWA plugin. Assets cached with Workbox. Landscape-only orientation enforced for mobile.

## Important Configuration

- **TypeScript**: Project is migrating from JS to TS. `tsconfig.json` has `strict: false` and `allowJs: true` for incremental migration.
- **Server URL**: Client uses `VITE_SERVER_URL` env var or defaults to `ws://localhost:2567`
- **Port**: Client dev server on 3000, game server on 2567 (configurable via PORT env var)
- **Trump Suit**: Always spades (hardcoded in `constants.ts`)
- **Game Rules**: 5 rounds, 13 cards per player, 4 players, max bid is 8

## File Structure Notes

- Mix of `.js` and `.ts` files (TypeScript migration in progress)
- Scenes are all `.js`, most utils/objects are `.ts` or `.js`
- Card assets in `public/cards/`, audio in `public/audio/`
- Server is fully TypeScript

## Testing & Debugging

- No test framework currently set up
- Use browser DevTools for client debugging
- Server logs to console (check terminal running `npm run dev`)
- Multiplayer testing requires running both client and server simultaneously
