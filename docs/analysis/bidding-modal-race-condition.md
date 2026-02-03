# Bidding Modal Race Condition Bug

## Issue Summary

In multiplayer mode, the bidding modal would sometimes fail to appear when the turn came back to the same player, particularly noticeable during round transitions (e.g., when starting round 5 after finishing round 4).

---

## Symptom

- **When**: Bidding phase in multiplayer mode
- **What**: Bidding modal intermittently doesn't show up
- **Frequency**: More common at round transitions, especially when the same player bids last in one round and first in the next round

---

## Root Cause Analysis

### The Race Condition

The issue was a **timing conflict between hide and show animations** in the `BiddingUI` component:

1. **Player places bid**
   - `BID_PLACED` event fires
   - `biddingUI.hide()` called
   - Starts 200ms fade-out animation
   - `onComplete` callback will set `container.setVisible(false)`

2. **Turn changes back to same player**
   - `TURN_CHANGED` event fires
   - After 300ms delay: `biddingUI.show()` called
   - Sets `container.setVisible(true)`
   - Starts 300ms fade-in animation

3. **Race condition occurs**
   - If `show()` is called while `hide()` animation is still running
   - `show()` makes container visible and starts fading in
   - **But** `hide()` animation's `onComplete` fires and sets `visible = false`
   - Result: Modal is hidden even though it should be showing

### Timeline Example

```
t=0ms:    Player bids → hide() starts (200ms animation)
t=100ms:  Turn changes → 300ms delay starts
t=200ms:  hide() animation completes → setVisible(false)
t=400ms:  show() is called → setVisible(true), fade-in starts
t=600ms:  ❌ But hide's onComplete might fire here, setting visible=false again
```

---

## Why Specifically at Round Transitions?

The bug was more apparent during round transitions due to **tighter timing** and **rotation patterns**:

### Bidding Rotation Pattern

The first bidder rotates each round:

```typescript
this.state.biddingPlayerIndex = (this.state.currentRound - 1) % NUM_PLAYERS;
```

- Round 1: Player 0 starts
- Round 2: Player 1 starts
- Round 3: Player 2 starts
- Round 4: Player 3 starts
- **Round 5: Player 0 starts** ← Same as Round 1

### Critical Scenario: Round 4 → Round 5

If Player 0 is the **last bidder** in Round 4 and **first bidder** in Round 5:

```
Round 4 ends:
  - Player 0 places final bid → modal hides (200ms animation)
  - Round modal shows/closes (user clicks Continue)

Round 5 starts:
  - Multiple rapid server events:
    * roundChange event
    * phase: "dealing" → "bidding"
    * currentTurn changes to Player 0
  - TURN_CHANGED fires → modal tries to show
  - ❌ Race condition: hide animation may still be active
```

The transition is faster than normal turn rotation because there's minimal delay between:

- Last bid of previous round (hide)
- First bid of new round (show)

---

## The Fix

Added tween cancellation at the start of both `show()` and `hide()` methods:

```typescript
show(): void {
  // Cancel any ongoing tweens to prevent race conditions
  this.scene.tweens.killTweensOf(this.container);

  this.container.setVisible(true);
  this.container.alpha = 0;
  // ... rest of show logic
}

hide(): void {
  // Cancel any ongoing tweens to prevent race conditions
  this.scene.tweens.killTweensOf(this.container);

  this.scene.tweens.add({
    // ... hide animation logic
  });
}
```

### How It Works

- `killTweensOf()` immediately stops all active tweens on the container
- This prevents old `onComplete` callbacks from firing after new animations start
- Ensures the final state always matches the most recent intention (show or hide)

---

## Files Modified

- `/packages/client/src/objects/game/BiddingUI.ts`
  - Added `this.scene.tweens.killTweensOf(this.container)` in `show()` method
  - Added `this.scene.tweens.killTweensOf(this.container)` in `hide()` method

---

## Testing Considerations

To reproduce the original bug:

1. Play multiplayer mode with 4 players
2. Complete rounds 1-4
3. Pay attention to Player 0 when transitioning to Round 5
4. Player 0 should be last to bid in Round 4 and first in Round 5
5. Original bug: Modal might not appear for Player 0's first bid in Round 5

After fix:

- Modal always appears correctly regardless of timing
- No visible artifacts or double-animations
- Smooth transitions even during rapid round changes

---

## Related Code References

### Event Flow

1. **UIScene.ts**: Listens for `TURN_CHANGED` and `BID_PLACED` events
2. **MultiplayerGameMode.ts**: Emits events based on NetworkManager state changes
3. **NetworkManager.ts**: Listens to Colyseus room state changes

### Timing Constants

```typescript
// From utils/constants.ts
export const UI_TIMING = {
  BIDDING_UI_DELAY: 300, // Delay before showing bidding UI
} as const;
```

### Animation Durations

- Hide animation: 200ms
- Show animation: 300ms
- UI delay before showing: 300ms

---

## Lessons Learned

1. **Always cancel ongoing animations** before starting new ones on the same target
2. **Race conditions can be subtle** - may only appear under specific timing scenarios
3. **Phaser's tween system** provides `killTweensOf()` specifically for this purpose
4. **UI timing matters** - delays and animation durations must be considered together
5. **Network events can fire rapidly** - client must handle quick succession gracefully
