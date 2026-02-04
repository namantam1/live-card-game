import type { TrickEntry, Suit } from '../types/';
import { compareCards } from './comparison';

/**
 * Find the index winner of a completed trick (0-3)
 */
export function findTrickWinner(trick: TrickEntry[], leadSuit: Suit): number {
  let winnerIndex = 0;
  let winningCard = trick[0].card;

  for (let i = 1; i < trick.length; i++) {
    if (compareCards(trick[i].card, winningCard, leadSuit) > 0) {
      winnerIndex = i;
      winningCard = trick[i].card;
    }
  }

  return trick[winnerIndex].playerIndex;
}
