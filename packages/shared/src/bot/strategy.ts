import { getValidCards } from '../game-logic/validation';
import type { CardData, TrickEntry, BotContext, Suit } from '../types';

/**
 * Choose the best card for a bot to play based on game context
 * Play highest non-trump when leading
 * Win with the lowest winning card when last to play
 * Compete for tricks only when they need more to meet their bid
 * Play the lowest card when they can't win or don't need the trick
 */
export function chooseBotCard(
  hand: CardData[],
  leadSuit: Suit | null,
  currentTrick: TrickEntry[] = [],
  context: BotContext = {}
): CardData {
  const validCards = leadSuit
    ? getValidCards(hand, leadSuit, currentTrick)
    : hand;

  if (validCards.length === 0 || validCards.length === 1) {
    return validCards[0];
  }

  return selectCard(validCards, leadSuit, currentTrick, context);
}

function selectCard(
  validCards: CardData[],
  leadSuit: Suit | null,
  currentTrick: TrickEntry[],
  context: BotContext
): CardData {
  const { trumpSuit, tricksWon = 0, bid = 1, numPlayers = 4 } = context;
  const isLeading = currentTrick.length === 0;
  const isLastPlayer = currentTrick.length === numPlayers - 1;

  // Find current winning card in trick
  let winningCard: CardData | null = null;
  if (!isLeading) {
    winningCard = findWinningCard(currentTrick, leadSuit, trumpSuit);
  }

  // Sort valid cards by value
  const sortedCards = [...validCards].sort((a, b) => a.value - b.value);
  const sortedCardsDesc = [...validCards].sort((a, b) => b.value - a.value);

  if (isLeading) {
    // When leading, play a strong non-trump card if possible
    const nonTrumpCards = sortedCardsDesc.filter((c) => c.suit !== trumpSuit);
    if (nonTrumpCards.length > 0) {
      return nonTrumpCards[0]; // Play highest non-trump
    }
    return sortedCardsDesc[0]; // Play highest card
  }

  // Following a lead
  const canWin = validCards.some((c) => {
    if (!winningCard) return true;
    return beats(c, winningCard, leadSuit, trumpSuit);
  });

  if (isLastPlayer && canWin) {
    // Last player and can win - play the lowest winning card
    const winningCards = validCards.filter(
      (c) => winningCard && beats(c, winningCard, leadSuit, trumpSuit)
    );
    return winningCards.sort((a, b) => a.value - b.value)[0];
  }

  if (canWin && tricksWon < bid) {
    // Need more tricks - try to win
    const winningCards = validCards.filter(
      (c) => winningCard && beats(c, winningCard, leadSuit, trumpSuit)
    );
    return winningCards.sort((a, b) => a.value - b.value)[0]; // Lowest winning card
  }

  // Can't win or don't need to - play lowest card
  return sortedCards[0];
}

function findWinningCard(
  trick: TrickEntry[],
  leadSuit: Suit | null,
  trumpSuit?: Suit
): CardData {
  let winner = trick[0].card;

  for (let i = 1; i < trick.length; i++) {
    if (beats(trick[i].card, winner, leadSuit, trumpSuit)) {
      winner = trick[i].card;
    }
  }

  return winner;
}

function beats(
  card1: CardData,
  card2: CardData,
  leadSuit: Suit | null,
  trumpSuit?: Suit
): boolean {
  // Trump beats non-trump
  if (trumpSuit) {
    if (card1.suit === trumpSuit && card2.suit !== trumpSuit) return true;
    if (card2.suit === trumpSuit && card1.suit !== trumpSuit) return false;
  }

  // Same suit: higher value wins
  if (card1.suit === card2.suit) {
    return card1.value > card2.value;
  }

  // Lead suit beats non-lead non-trump
  if (card1.suit === leadSuit) return true;
  if (card2.suit === leadSuit) return false;

  return false;
}
