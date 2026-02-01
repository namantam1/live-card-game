/**
 * Card comparison and value functions
 */

import type { CardData, Suit } from "../types/";
import { RANK_VALUES, TRUMP_SUIT } from "../constants/game";

/**
 * Get the numeric value of a card
 * @param card - The card to evaluate
 * @returns Numeric value from 2-14
 */
export function getCardValue(card: CardData): number {
  return RANK_VALUES[card.rank];
}

/**
 * Compare two cards given a lead suit
 * @param card1 - First card
 * @param card2 - Second card
 * @param leadSuit - The suit that was led in the trick
 * @returns Positive if card1 wins, negative if card2 wins, 0 if equal
 */
export function compareCards(
  card1: CardData,
  card2: CardData,
  leadSuit: Suit,
): number {
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
