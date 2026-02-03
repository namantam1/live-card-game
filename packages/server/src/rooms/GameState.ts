import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';
import {
  SUITS,
  TRUMP_SUIT,
  RANKS,
  RANK_VALUES,
  createDeck,
  shuffleDeck,
  sortHand,
  getCardValue,
  compareCards,
  getValidCards,
  calculateScore,
  type CardData as SharedCardData,
} from '@call-break/shared';

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
  @type([TrickEntry]) currentTrick: ArraySchema<TrickEntry> =
    new ArraySchema<TrickEntry>();
  @type(['string']) playerOrder: ArraySchema<string> =
    new ArraySchema<string>(); // Seat order
}

// Re-export for compatibility
export type CardData = SharedCardData;
export { SUITS, TRUMP_SUIT, RANKS, RANK_VALUES, createDeck, shuffleDeck };

export function getDealtCards(
  cards: CardData[],
  numPlayers: number,
  mandatoryFaceCard: boolean = true,
  maxAttempts: number = 100,
  attempt: number = 1
): CardData[][] {
  if (attempt >= maxAttempts) {
    throw new Error(
      `Failed to deal valid hands after ${maxAttempts} attempts. This should be extremely rare.`
    );
  }

  const hands: CardData[][] = Array.from({ length: numPlayers }, () => []);
  shuffleDeck(cards).forEach((card, index) => {
    hands[index % numPlayers].push(card);
  });

  // check if any hand has no trump cards, if so, reshuffle
  if (hands.some((hand) => !hand.some((card) => card.suit === TRUMP_SUIT))) {
    return getDealtCards(
      cards,
      numPlayers,
      mandatoryFaceCard,
      maxAttempts,
      attempt + 1
    );
  }

  // check if any hand has no face cards (J, Q, K, A), if so, reshuffle
  if (mandatoryFaceCard) {
    const faceCardValues = [11, 12, 13, 14]; // J, Q, K, A
    if (
      hands.some(
        (hand) => !hand.some((card) => faceCardValues.includes(card.value))
      )
    ) {
      return getDealtCards(
        cards,
        numPlayers,
        mandatoryFaceCard,
        maxAttempts,
        attempt + 1
      );
    }
  }

  return hands.map((hand) => sortHand(hand));
}

// Re-export shared functions for compatibility
export { sortHand, getCardValue, compareCards, getValidCards, calculateScore };
