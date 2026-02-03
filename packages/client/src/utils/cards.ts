import type { CardData } from '../type';
export {
  createDeck,
  shuffleDeck,
  sortHand,
  getCardValue,
  compareCards,
  findTrickWinner,
  getValidCards,
  calculateScore,
} from '@call-break/shared';

/**
 * Get the asset path for a card image
 */
export function getCardAssetKey(card: CardData) {
  return `card-${card.id}`;
}
