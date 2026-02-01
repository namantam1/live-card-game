/**
 * Card deck creation and manipulation functions
 */

import type { CardData } from "../types/card";
import { SUITS, RANKS, RANK_VALUES } from "../constants/game";

/**
 * Create a standard 52-card deck
 * @returns Array of 52 cards
 */
export function createDeck(): CardData[] {
  const deck: CardData[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        id: `${rank}-${suit}`,
        value: RANK_VALUES[rank],
      });
    }
  }
  return deck;
}

/**
 * Shuffle a deck using Fisher-Yates algorithm
 * @param deck - Array of cards to shuffle
 * @returns New shuffled array (does not modify original)
 */
export function shuffleDeck(deck: CardData[]): CardData[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Sort a hand by suit then by rank (descending within each suit)
 * Suit order: spades, hearts, diamonds, clubs
 * @param hand - Array of cards to sort
 * @returns New sorted array (does not modify original)
 */
export function sortHand(hand: CardData[]): CardData[] {
  const suitOrder: Record<string, number> = {
    spades: 0,
    hearts: 1,
    diamonds: 2,
    clubs: 3,
  };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.value - a.value; // Descending order within suit
  });
}
