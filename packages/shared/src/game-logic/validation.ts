/**
 * Card validation logic - determines which cards are legal to play
 */

import type { CardData, Suit, TrickEntry } from '../types/';
import { TRUMP_SUIT } from '../constants/game';
import { compareCards } from './comparison';

/**
 * Get valid cards a player can play based on game rules
 *
 * Call Break Rules:
 * 1. If you're leading, you can play any card
 * 2. You must follow suit if you have cards of the lead suit
 * 3. If following suit, you must play higher than current highest if possible
 * 4. If you can't follow suit, you must play trump (spades) if you have any
 * 5. If playing trump, you must beat the current highest card if possible
 * 6. If you can't beat with trump (mandatoryTrumping=false), you can play any card
 * 7. If mandatoryTrumping=true, you must waste a trump even if you can't win
 *
 * @param hand - Player's current hand
 * @param leadSuit - The suit that was led (null if player is leading)
 * @param currentTrick - Current trick entries to determine highest card
 * @param mandatoryTrumping - If true, must play trump when void in lead suit even if can't win
 * @returns Array of valid cards that can be played
 */
export function getValidCards(
  hand: CardData[],
  leadSuit: Suit | null,
  currentTrick: TrickEntry[] = [],
  mandatoryTrumping: boolean = false
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
      (c) => compareCards(c, highestCard, leadSuit) > 0
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
      (c) => compareCards(c, highestCard, leadSuit) > 0
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
