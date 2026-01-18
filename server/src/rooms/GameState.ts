import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

// Card schema
export class Card extends Schema {
  @type('string') id: string = '';
  @type('string') suit: string = '';
  @type('string') rank: string = '';
  @type('number') value: number = 0;
}

// Trick entry (card played in current trick)
export class TrickEntry extends Schema {
  @type('string') playerId: string = '';
  @type(Card) card: Card = new Card();
}

// Player schema
export class Player extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('string') emoji: string = '';
  @type('number') seatIndex: number = -1;
  @type('boolean') isReady: boolean = false;
  @type('boolean') isConnected: boolean = true;
  @type('boolean') isBot: boolean = false;
  @type('number') bid: number = 0;
  @type('number') tricksWon: number = 0;
  @type('number') score: number = 0;
  @type('number') roundScore: number = 0;
  @type([Card]) hand: ArraySchema<Card> = new ArraySchema<Card>();
}

// Main game state
export class GameState extends Schema {
  @type('string') roomCode: string = '';
  @type('string') phase: string = 'waiting'; // waiting, bidding, playing, trickEnd, roundEnd, gameOver
  @type('number') currentRound: number = 1;
  @type('number') totalRounds: number = 5;
  @type('number') maxBid: number = 8;
  @type('number') trickNumber: number = 0;
  @type('string') currentTurn: string = ''; // Player ID whose turn it is
  @type('string') leadSuit: string = '';
  @type('string') trumpSuit: string = 'spades';
  @type('number') biddingPlayerIndex: number = 0;
  @type('string') trickWinner: string = '';

  @type({ map: Player }) players: MapSchema<Player> = new MapSchema<Player>();
  @type([TrickEntry]) currentTrick: ArraySchema<TrickEntry> = new ArraySchema<TrickEntry>();
  @type(['string']) playerOrder: ArraySchema<string> = new ArraySchema<string>(); // Seat order
}

// Card utilities
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export interface CardData {
  id: string;
  suit: string;
  rank: string;
  value: number;
}

export function createDeck(): CardData[] {
  const deck: CardData[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        value: RANK_VALUES[rank]
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: CardData[]): CardData[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function sortHand(cards: CardData[]): CardData[] {
  const suitOrder: Record<string, number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  return [...cards].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.value - a.value;
  });
}

export function getValidCards(hand: CardData[], leadSuit: string): CardData[] {
  if (!leadSuit) return hand;

  const sameSuit = hand.filter(c => c.suit === leadSuit);
  if (sameSuit.length > 0) return sameSuit;

  return hand;
}

export function calculateScore(bid: number, tricksWon: number): number {
  if (tricksWon >= bid) {
    return bid + (tricksWon - bid) * 0.1;
  }
  return -bid;
}
