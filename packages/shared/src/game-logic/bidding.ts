import { MAX_BID } from '../constants/config';
import type { CardData, Suit } from '../types';

export function calculateBid(
  hand: CardData[],
  trumpSuit: Suit,
  maxBid: number = MAX_BID
): number {
  let bid = 1; // Minimum bid

  // Count strong cards
  hand.forEach((card) => {
    // Aces are likely to win
    if (card.value === 14) bid++;
    // Kings have good chances
    else if (card.value === 13) bid += 0.5;
    // Queens in trumps are strong
    else if (card.value === 12 && card.suit === trumpSuit) bid += 0.5;
    // Trump cards are valuable
    else if (card.suit === trumpSuit && card.value >= 10) bid += 0.3;
  });

  // Round and clamp bid
  return Math.max(1, Math.min(maxBid, Math.round(bid)));
}
