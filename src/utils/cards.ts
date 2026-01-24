import type { CardData, TrickEntry } from "../type";
import { SUITS, RANKS, RANK_VALUES, TRUMP_SUIT, type Suit } from "./constants";

/**
 * Create a standard 52-card deck
 */
export function createDeck(): CardData[] {
  const deck = [];
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
 * Fisher-Yates shuffle
 */
export function shuffleDeck(deck: CardData[]) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get numeric value of a card
 */
export function getCardValue(card: CardData) {
  return RANK_VALUES[card.rank];
}

/**
 * Compare two cards given a lead suit
 * Returns positive if card1 wins, negative if card2 wins
 */
export function compareCards(card1: CardData, card2: CardData, leadSuit: Suit) {
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

/**
 * Find winner of a trick
 * @param {Array} trick - Array of {playerIndex, card} objects
 * @param {string} leadSuit - The suit that was led
 * @returns {number} - Index of winning player
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

/**
 * Sort a hand by suit then by rank (descending)
 */
export function sortHand(hand: CardData[]) {
  const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return getCardValue(b) - getCardValue(a);
  });
}

/**
 * Get valid cards a player can play
 * @param {Array} hand - Player's hand
 * @param {string|null} leadSuit - The suit that was led (null if leading)
 * @param {Array} currentTrick - Current trick entries to determine highest card
 * @param {boolean} mandatoryTrumping - If true, must play lower trump when void in lead suit (default: true)
 * @returns {Array} - Valid cards to play
 */
export function getValidCards(
  hand: CardData[],
  leadSuit: Suit | null,
  currentTrick: TrickEntry[] = [],
  mandatoryTrumping: boolean = true,
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

/**
 * Calculate round score for a player
 * @param {number} bid - Player's bid
 * @param {number} tricksWon - Tricks actually won
 * @returns {number} - Score for the round
 */
export function calculateScore(bid: number, tricksWon: number): number {
  if (tricksWon >= bid) {
    return bid + (tricksWon - bid) * 0.1;
  }
  return -bid;
}

/**
 * Get the asset path for a card image
 */
export function getCardAssetKey(card: CardData) {
  return `card-${card.id}`;
}
