import type { CardData, ReactionType, Suit } from '../types';

/**
 * Decide if bot should show a reaction and which one based on game context
 * Returns a reaction type or null if bot shouldn't react
 */
export function decideBotReaction(context: {
  event: 'trickWon' | 'trickLost' | 'roundEnd' | 'opponentCard';
  botTricksWon?: number;
  botBid?: number;
  opponentCard?: CardData;
  trumpSuit?: Suit;
}): ReactionType | null {
  // Bots react with 40% probability to avoid spam
  const shouldReact = Math.random() < 0.4;
  if (!shouldReact) return null;

  const {
    event,
    botTricksWon = 0,
    botBid = 1,
    opponentCard,
    trumpSuit,
  } = context;

  switch (event) {
    case 'trickWon': {
      // Bot won a trick
      const tricksStillNeeded = botBid - botTricksWon;

      if (tricksStillNeeded === 0) {
        // Just met the bid exactly!
        return pickRandom(['💯', '👍', '🔥']);
      } else if (tricksStillNeeded === 1) {
        // Close to meeting bid
        return pickRandom(['👍', '😍', '🔥']);
      } else if (tricksStillNeeded > botBid / 2) {
        // Still far from bid but won a trick
        return pickRandom(['👍', '😮']);
      } else {
        // On track
        return pickRandom(['👍', '🔥']);
      }
    }

    case 'trickLost': {
      // Bot lost a trick they might have needed
      const tricksStillNeeded = botBid - botTricksWon;
      const tricksRemaining = 13 - (botTricksWon + tricksStillNeeded);

      if (tricksStillNeeded > tricksRemaining) {
        // Can't possibly meet bid anymore
        return pickRandom(['😡', '👎']);
      } else if (tricksStillNeeded > 2) {
        // Falling behind
        return pickRandom(['😮', '👎']);
      }
      // Don't react if still comfortable
      return null;
    }

    case 'roundEnd': {
      // React to round results
      const tricksStillNeeded = botBid - botTricksWon;

      if (tricksStillNeeded === 0) {
        // Made exact bid - celebrate!
        return pickRandom(['💯', '😍', '🔥']);
      } else if (tricksStillNeeded < 0) {
        // Over-bid (penalty)
        return pickRandom(['😡', '👎']);
      } else {
        // Under-bid (penalty)
        return pickRandom(['😮', '👎']);
      }
    }

    case 'opponentCard': {
      // React to opponent's high-value card
      if (!opponentCard) return null;

      const cardValue = opponentCard.value;
      const isTrump = opponentCard.suit === trumpSuit;
      const isAce = opponentCard.rank === 'A';

      if (isAce && isTrump) {
        // Trump Ace - very powerful
        return pickRandom(['😮', '🔥']);
      } else if (isAce) {
        // Regular Ace
        return pickRandom(['😮', '👍']);
      } else if (isTrump && cardValue >= 13) {
        // High trump (King+)
        return pickRandom(['😮', '👍']);
      }

      // Don't react to normal plays
      return null;
    }

    default:
      return null;
  }
}

/**
 * Helper to pick a random reaction from an array
 */
function pickRandom(reactions: ReactionType[]): ReactionType {
  return reactions[Math.floor(Math.random() * reactions.length)];
}
