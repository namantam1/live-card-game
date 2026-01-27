import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

// Card schema
export class Card extends Schema {
  @type("string") id: string = "";
  @type("string") suit: string = "";
  @type("string") rank: string = "";
  @type("number") value: number = 0;
}

// Trick entry (card played in current trick)
export class TrickEntry extends Schema {
  @type("string") playerId: string = "";
  @type(Card) card: Card = new Card();
}

// Player schema
export class Player extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") emoji: string = "";
  @type("number") seatIndex: number = -1;
  @type("boolean") isReady: boolean = false;
  @type("boolean") isConnected: boolean = true;
  @type("boolean") isBot: boolean = false;
  @type("number") bid: number = 0;
  @type("number") tricksWon: number = 0;
  @type("number") score: number = 0;
  @type("number") roundScore: number = 0;
  @type([Card]) hand: ArraySchema<Card> = new ArraySchema<Card>();
}

// Main game state
export class GameState extends Schema {
  @type("string") roomCode: string = "";
  @type("string") phase: string = "waiting"; // waiting, bidding, playing, trickEnd, roundEnd, gameOver
  @type("number") currentRound: number = 1;
  @type("number") totalRounds: number = 5;
  @type("number") maxBid: number = 8;
  @type("number") trickNumber: number = 0;
  @type("string") currentTurn: string = ""; // Player ID whose turn it is
  @type("string") leadSuit: string = "";
  @type("string") trumpSuit: string = "spades";
  @type("number") biddingPlayerIndex: number = 0;
  @type("string") trickWinner: string = "";

  @type({ map: Player }) players: MapSchema<Player> = new MapSchema<Player>();
  @type([TrickEntry]) currentTrick: ArraySchema<TrickEntry> =
    new ArraySchema<TrickEntry>();
  @type(["string"]) playerOrder: ArraySchema<string> =
    new ArraySchema<string>(); // Seat order
}

// Card utilities
export const SUITS = ["spades", "hearts", "diamonds", "clubs"];
export const TRUMP_SUIT = "spades";
export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];
export const RANK_VALUES: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
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
        value: RANK_VALUES[rank],
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

export function getDealtCards(
  cards: CardData[],
  numPlayers: number,
  mandatoryFaceCard: boolean = true,
  maxAttempts: number = 100,
  attempt: number = 1,
): CardData[][] {
  if (attempt >= maxAttempts) {
    throw new Error(
      `Failed to deal valid hands after ${maxAttempts} attempts. This should be extremely rare.`,
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
      attempt + 1,
    );
  }

  // check if any hand has no face cards (J, Q, K, A), if so, reshuffle
  if (mandatoryFaceCard) {
    const faceCardValues = [11, 12, 13, 14]; // J, Q, K, A
    if (
      hands.some(
        (hand) => !hand.some((card) => faceCardValues.includes(card.value)),
      )
    ) {
      return getDealtCards(
        cards,
        numPlayers,
        mandatoryFaceCard,
        maxAttempts,
        attempt + 1,
      );
    }
  }

  return hands.map((hand) => sortHand(hand));
}

export function sortHand(cards: CardData[]): CardData[] {
  const suitOrder: Record<string, number> = {
    spades: 0,
    hearts: 1,
    diamonds: 2,
    clubs: 3,
  };
  return [...cards].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.value - a.value;
  });
}

export function getCardValue(card: CardData) {
  return RANK_VALUES[card.rank];
}

export function compareCards(
  card1: CardData,
  card2: CardData,
  leadSuit: string,
) {
  // Trump (spades) beats non-trump
  if (card1.suit === TRUMP_SUIT && card2.suit !== TRUMP_SUIT) return 1;
  if (card2.suit === TRUMP_SUIT && card1.suit !== TRUMP_SUIT) return -1;

  // If same suit (both trump or both same suit)
  if (card1.suit === card2.suit) {
    return getCardValue(card1) - getCardValue(card2);
  }

  // Lead suit beats non-lead, non-trump
  if (card1.suit === leadSuit) return 1;
  if (card2.suit === leadSuit) return -1;

  return 0;
}

// export function getValidCards(hand: CardData[], leadSuit: string): CardData[] {
//   if (!leadSuit) return hand;

//   const sameSuit = hand.filter((c) => c.suit === leadSuit);
//   if (sameSuit.length > 0) return sameSuit;

//   return hand;
// }
export function getValidCards(
  hand: CardData[],
  leadSuit: string | null,
  currentTrick: TrickEntry[] = [],
  mandatoryTrumping: boolean = false,
): CardData[] {
  if (!leadSuit || currentTrick.length === 0) {
    // Leading - can play anything
    return hand;
  }

  // Find the current highest card in the trick
  let highestCard = currentTrick[0].card;
  for (let i = 1; i < currentTrick.length; i++) {
    if (compareCards(currentTrick[i].card, highestCard, leadSuit) > 0) {
      highestCard = currentTrick[i].card;
    }
  }

  // Check if player has cards of the lead suit
  const leadSuitCards = hand.filter((c) => c.suit === leadSuit);
  if (leadSuitCards.length > 0) {
    // Must play higher card of lead suit if possible
    const higherCards = leadSuitCards.filter(
      (c) => compareCards(c, highestCard, leadSuit) > 0,
    );
    if (higherCards.length > 0) {
      return higherCards;
    }
    // If no higher cards, can play any card of the lead suit
    return leadSuitCards;
  }

  // Player is void in lead suit - must play spades if possible
  const spadeCards = hand.filter((c) => c.suit === TRUMP_SUIT);
  if (spadeCards.length > 0) {
    // Check if player can beat the current highest card with a spade
    const higherSpades = spadeCards.filter(
      (c) => compareCards(c, highestCard, leadSuit) > 0,
    );

    if (higherSpades.length > 0) {
      // Must play a higher spade
      return higherSpades;
    }

    // Player only has lower spades
    if (mandatoryTrumping) {
      // Must play a spade even if it can't win (wasting trump)
      return spadeCards;
    } else {
      // Overtake exception: can play any card if can't beat highest
      return hand;
    }
  }

  // No spades - can play anything
  return hand;
}

export function calculateScore(bid: number, tricksWon: number): number {
  if (tricksWon >= bid) {
    return bid + (tricksWon - bid) * 0.1;
  }
  return -bid;
}
