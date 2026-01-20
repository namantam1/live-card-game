# Reconnection Logic & Network Indicator Implementation

This document describes the reconnection logic and network strength indicator added to the Call Break multiplayer game.

## Overview

The implementation provides:
1. **Automatic reconnection** when players experience temporary network disconnections
2. **Network strength indicator** showing real-time connection quality
3. **Visual feedback** during reconnection attempts
4. **Graceful degradation** when reconnection fails

## Architecture

### 1. NetworkManager Enhancements

**Location**: `src/managers/NetworkManager.js`

#### New Features:

- **Connection Monitoring**: Monitors connection health by tracking state update intervals
- **Reconnection Logic**: Automatically attempts to reconnect up to 3 times with exponential backoff
- **Connection Quality Tracking**: Categorizes connection as 'good', 'fair', 'poor', or 'offline'

#### Key Properties:

```javascript
{
  reconnecting: false,              // Currently attempting reconnection
  maxReconnectAttempts: 3,         // Maximum reconnection attempts
  reconnectDelay: 2000,            // Initial delay between attempts (ms)
  connectionQuality: 'good',       // Current connection quality
  reconnectionToken: null,         // Colyseus reconnection token
  pingInterval: null,              // Connection monitoring interval
  pingTimeout: 5000                // Timeout for detecting poor connection
}
```

#### New Events Emitted:

- `connectionQualityChange`: Fired when connection quality changes
  ```javascript
  { quality: 'good'|'fair'|'poor'|'offline', connected: boolean }
  ```

- `reconnecting`: Fired when reconnection starts
  ```javascript
  { attempt: 1 }
  ```

- `reconnected`: Fired on successful reconnection
  ```javascript
  { message: 'Reconnected to game' }
  ```

- `reconnectionFailed`: Fired when all reconnection attempts fail
  ```javascript
  { message: 'Could not reconnect to the game' }
  ```

#### Connection Quality Detection:

The system monitors the time since the last state update:
- **Good**: Updates received within 5 seconds
- **Fair**: 5-10 seconds since last update
- **Poor**: 10-15 seconds since last update
- **Offline**: 15+ seconds since last update

### 2. Server-Side Reconnection Support

**Location**: `server/src/rooms/CallBreakRoom.ts`

#### Changes:

- Increased reconnection timeout from 30 to 60 seconds
- Added `reconnected` and `playerReconnected` messages
- Better logging for reconnection events
- Maintains player state during disconnection

#### How It Works:

1. When a player disconnects unexpectedly (`consented = false`), the server:
   - Marks player as `isConnected = false`
   - Waits up to 60 seconds for reconnection
   - Preserves player state (cards, score, bid, etc.)

2. On successful reconnection:
   - Restores player connection state
   - Sends confirmation to reconnected player
   - Notifies other players

3. On timeout:
   - Removes player from game
   - Ends room if all human players are gone

### 3. NetworkIndicator Component

**Location**: `src/components/NetworkIndicator.js`

#### Visual Design:

A compact signal strength indicator with 3 bars:
- **Green bars**: Good connection (all 3 bars visible)
- **Yellow bars**: Fair connection (2 bars visible)
- **Orange bars**: Poor connection (1 bar visible)
- **Red**: Offline (no bars visible)
- **Pulsing red**: Reconnecting state

#### Features:

- Hover tooltip showing connection status
- Pulsing animation during reconnection
- Flash animation on successful reconnection
- Shows reconnection attempt count

#### Usage:

```javascript
// Create indicator
this.networkIndicator = new NetworkIndicator(scene, x, y);

// Update quality
this.networkIndicator.updateQuality('good'|'fair'|'poor'|'offline');

// Show reconnecting state
this.networkIndicator.showReconnecting(attemptNumber);

// Show reconnected
this.networkIndicator.showReconnected();
```

### 4. GameScene Integration

**Location**: `src/scenes/GameScene.js`

#### New Features:

1. **Network Indicator**: Displayed in top-left corner during multiplayer
2. **Reconnection Overlay**: Full-screen overlay shown during reconnection with:
   - Spinning loading indicator
   - "Connection lost, Reconnecting..." message
   - Attempt counter (e.g., "Attempt 1 of 3")

3. **Event Handlers**:
   - `connectionQualityChange`: Updates network indicator
   - `reconnecting`: Shows overlay and updates indicator
   - `reconnected`: Hides overlay, shows success message
   - `reconnectionFailed`: Redirects to menu after showing error

### 5. LobbyScene Integration

**Location**: `src/scenes/LobbyScene.js`

#### Changes:

- Network indicator shown after server connection
- Updates based on connection quality
- Visual feedback for connection status

## User Experience Flow

### Normal Gameplay:
1. Player sees green network indicator (3 bars)
2. If connection degrades:
   - Indicator changes to yellow (2 bars) or orange (1 bar)
   - Gameplay continues normally

### Temporary Disconnect:
1. Player's connection drops (e.g., WiFi hiccup)
2. **Immediately**:
   - Network indicator turns red and pulses
   - Reconnection overlay appears
   - "Connection lost, Reconnecting..." message shown
3. **During Reconnection** (up to 3 attempts):
   - Overlay shows attempt number
   - Attempts occur with exponential backoff (2s, 4s, 8s)
4. **On Success**:
   - Overlay disappears
   - Green success message: "Reconnected!"
   - Indicator turns green
   - Game state is synchronized
   - Player continues from where they left off
5. **On Failure**:
   - Error message shown
   - Player redirected to menu after 2 seconds

### Permanent Disconnect:
1. If server doesn't receive reconnection within 60 seconds:
   - Player is removed from game
   - Other players are notified
   - If all humans leave, room closes

## Testing the Implementation

### Manual Testing:

1. **Test Connection Quality Indicator**:
   - Start a multiplayer game
   - Check that green indicator appears in top-left
   - Hover over it to see "Good Connection" tooltip

2. **Test Reconnection (Chrome DevTools)**:
   - Open Chrome DevTools (F12)
   - Go to Network tab
   - Click "Offline" checkbox to simulate disconnect
   - Observe:
     - Red pulsing indicator
     - Reconnection overlay appears
     - Attempt counter increments
   - Uncheck "Offline" to restore connection
   - Observe:
     - "Reconnected!" message
     - Game continues normally

3. **Test Failed Reconnection**:
   - Disconnect as above
   - Wait for all 3 attempts to fail (~14 seconds)
   - Observe redirect to menu

4. **Test Connection Quality Changes**:
   - Use Chrome DevTools Network throttling
   - Set to "Slow 3G" or "Fast 3G"
   - Observe indicator color changes

## Configuration

### Reconnection Settings:

In `src/managers/NetworkManager.js`:

```javascript
this.maxReconnectAttempts = 3;     // Change number of attempts
this.reconnectDelay = 2000;        // Change initial delay (ms)
this.pingTimeout = 5000;           // Change connection quality threshold
```

### Server Settings:

In `server/src/rooms/CallBreakRoom.ts`:

```javascript
await this.allowReconnection(client, 60);  // Change timeout (seconds)
```

## UI Positioning

The network indicator is positioned in the **top-right corner** of the screen, to the left of the settings gear icon:
- **GameScene**: `width - 80, 30` - positioned to avoid overlap with settings icon
- **LobbyScene**: `width - 50, 30` - similar positioning for consistency

This ensures the indicator is always visible without being hidden by the scoreboard or other UI elements.

## Card Synchronization on Reconnection

When a player reconnects, the game state is synchronized in the following sequence:

1. **Reconnection Established**: NetworkManager completes reconnection to the room
2. **Brief Delay (200ms)**: Allows server state to fully propagate to client
3. **syncHandFromServer()**: Called to update player's hand and card counts
4. **Hand Update**:
   - Local player's hand is cleared and repopulated with current cards from server
   - Remote players' card counts are updated to show correct number of card backs
5. **Turn State Restoration**:
   - All players' turn indicators are updated based on current turn
   - If it's the reconnected player's turn during playing phase:
     - Cards are made playable with proper validation against lead suit
     - Turn indicator is shown
   - If it's another player's turn:
     - All cards are disabled for the reconnected player
     - Turn indicator is hidden
6. **Phase Handling**:
   - If reconnected during bidding phase and it's player's turn: bidding UI is triggered
   - If reconnected during playing phase and it's player's turn: playable cards are enabled
7. **Visual Feedback**: "Reconnected!" message displayed to user

This ensures that:
- Cards are properly synchronized without duplicates
- Card interactivity is restored correctly based on game state
- Players can immediately continue playing if it's their turn
- Turn indicators accurately reflect the current game state

## Known Limitations

1. **State Synchronization**: Player must wait for their turn even after reconnecting mid-trick
2. **Bot Behavior**: Bots continue playing during human player disconnection
3. **Network Detection**: Quality detection is based on state updates, not actual network metrics
4. **Mobile Considerations**: Background app switching may trigger disconnections

## Future Enhancements

1. Add option to disable auto-reconnection
2. Show other players' connection status
3. Add network ping/latency display
4. Implement "waiting for player to reconnect" state to pause gameplay
5. Add reconnection sound effects
6. Store game state locally for offline recovery

## Troubleshooting

### Indicator Not Showing:
- Check that scene is in multiplayer mode
- Verify NetworkManager is passed to scene
- Check browser console for errors

### Reconnection Not Working:
- Verify server is running
- Check that reconnectionToken is saved
- Ensure server reconnection timeout hasn't expired
- Check browser console for connection errors

### Connection Quality Always "Poor":
- State updates may be slow
- Adjust `pingTimeout` value
- Check server performance
- Verify network is stable

## API Reference

### NetworkManager Methods:

```javascript
// Get current connection quality
getConnectionQuality(): 'good'|'fair'|'poor'|'offline'

// Check if reconnecting
isReconnecting(): boolean

// Manually cancel reconnection
cancelReconnection(): void

// Stop connection monitoring
stopConnectionMonitoring(): void
```

### NetworkIndicator Methods:

```javascript
// Update connection quality
updateQuality(quality: string): void

// Show reconnecting state with attempt number
showReconnecting(attempt: number): void

// Show reconnected success state
showReconnected(): void
```

## Summary

This implementation provides a robust reconnection system that:
- ✅ Handles temporary network disruptions gracefully
- ✅ Provides clear visual feedback to users
- ✅ Maintains game state during reconnection
- ✅ Falls back gracefully when reconnection fails
- ✅ Works with both WiFi fluctuations and temporary disconnects
- ✅ Integrates seamlessly with existing game flow

The system significantly improves the multiplayer experience by preventing frustrating game exits due to brief network issues.
