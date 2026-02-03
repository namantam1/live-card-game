import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDealtCards,
  createDeck,
  sortHand,
  TRUMP_SUIT,
  type CardData,
} from './GameState.js';

describe('getDealtCards', () => {
  let deck: CardData[];

  beforeEach(() => {
    deck = createDeck();
  });

  it('should deal exactly 13 cards to each of 4 players', () => {
    const hands = getDealtCards(deck, 4);
    expect(hands).toHaveLength(4);
    hands.forEach((hand) => {
      expect(hand).toHaveLength(13);
    });
  });

  it('should ensure every player has at least one trump card (spade)', () => {
    const hands = getDealtCards(deck, 4);
    hands.forEach((hand) => {
      const hasTrump = hand.some((card) => card.suit === TRUMP_SUIT);
      expect(hasTrump).toBe(true);
    });
  });

  it('should ensure every player has at least one face card when mandatoryFaceCard=true', () => {
    const hands = getDealtCards(deck, 4, true);
    const faceCardValues = [11, 12, 13, 14]; // J, Q, K, A
    hands.forEach((hand) => {
      const hasFaceCard = hand.some((card) =>
        faceCardValues.includes(card.value)
      );
      expect(hasFaceCard).toBe(true);
    });
  });

  it('should allow hands without face cards when mandatoryFaceCard=false', () => {
    const hands = getDealtCards(deck, 4, false);
    // Just verify it completes without throwing
    expect(hands).toHaveLength(4);
  });

  it('should return sorted hands', () => {
    const hands = getDealtCards(deck, 4);
    hands.forEach((hand) => {
      const sortedHand = sortHand([...hand]);
      expect(hand).toEqual(sortedHand);
    });
  });

  it('should throw error when max attempts exceeded', () => {
    // Create a deck with no spades to force validation failure
    const invalidDeck = deck.filter((card) => card.suit !== TRUMP_SUIT);

    expect(() => {
      getDealtCards(invalidDeck, 4, true, 5);
    }).toThrow(/Failed to deal valid hands after 5 attempts/);
  });

  it('should deal all 52 cards without duplicates or missing cards', () => {
    const hands = getDealtCards(deck, 4);
    const allDealtCards = hands.flat();
    expect(allDealtCards).toHaveLength(52);

    // Check no duplicates
    const cardIds = allDealtCards.map((card) => card.id);
    const uniqueIds = new Set(cardIds);
    expect(uniqueIds.size).toBe(52);
  });
});
