# @call-break/shared

Shared game logic, types, and constants for Call Break card game.

## Overview

This package contains the core game rules and logic used by both the client (Phaser 3) and server (Colyseus) implementations of Call Break. By centralizing game logic, we ensure consistent behavior across both implementations and eliminate code duplication.

## Installation

```bash
npm install
npm run build
```

## Usage

```typescript
import {
  // Types
  CardData,
  Suit,
  Rank,
  TrickEntry,
  GamePhase,

  // Constants
  SUITS,
  RANKS,
  RANK_VALUES,
  TRUMP_SUIT,
  TOTAL_ROUNDS,
  NUM_PLAYERS,

  // Game Logic
  createDeck,
  shuffleDeck,
  sortHand,
  getValidCards,
  compareCards,
  findTrickWinner,
  calculateScore
} from '@call-break/shared';
```

## API

### Types

- `CardData` - Represents a playing card
- `Suit` - Card suit type
- `Rank` - Card rank type
- `TrickEntry` - Card played in a trick
- `GamePhase` - Game state phases

### Constants

- `SUITS` - All valid suits
- `RANKS` - All valid ranks
- `RANK_VALUES` - Numeric values for ranks
- `TRUMP_SUIT` - Trump suit (spades)
- `TOTAL_ROUNDS` - Rounds per game (5)
- `NUM_PLAYERS` - Players per game (4)
- `CARDS_PER_PLAYER` - Cards per player (13)
- `MAX_BID` - Maximum bid value (8)

### Functions

#### `createDeck(): CardData[]`
Creates a standard 52-card deck.

#### `shuffleDeck(deck: CardData[]): CardData[]`
Shuffles a deck using Fisher-Yates algorithm.

#### `sortHand(hand: CardData[]): CardData[]`
Sorts cards by suit then rank (descending).

#### `getValidCards(hand, leadSuit, currentTrick, mandatoryTrumping): CardData[]`
Determines which cards are legal to play based on Call Break rules.

#### `compareCards(card1, card2, leadSuit): number`
Compares two cards. Returns positive if card1 wins, negative if card2 wins.

#### `findTrickWinner(trick, leadSuit): number`
Finds the winning player index for a completed trick.

#### `calculateScore(bid, tricksWon): number`
Calculates round score based on bid and tricks won.

## Testing

```bash
npm test
npm run test:watch
```

## Building

```bash
npm run build
npm run dev  # watch mode
```

## License

MIT
