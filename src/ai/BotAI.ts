import { TRUMP_SUIT, MAX_BID, Suit } from "../utils/constants";
import { getCardValue, getValidCards } from "../utils/cards";
import { CardData, TrickEntry, DifficultyLevel, BotContext } from '../type';

export default class BotAI {
  private difficulty: DifficultyLevel;

  constructor(difficulty: DifficultyLevel = "medium") {
    this.difficulty = difficulty;
  }


  calculateBid(hand: CardData[]): number {
    switch (this.difficulty) {
      case "easy":
        return this.easyBid(hand);
      case "hard":
        return this.hardBid(hand);
      default:
        return this.mediumBid(hand);
    }
  }

  private easyBid(hand: CardData[]): number {
    // Simple: count high cards
    const highCards = hand.filter(
      (c: CardData) => getCardValue(c) >= 11,
    ).length;
    return Math.max(1, Math.min(MAX_BID, Math.floor(highCards / 2) + 1));
  }

  private mediumBid(hand: CardData[]): number {
    // Medium: consider high cards and trump count
    const highCards = hand.filter(
      (c: CardData) => getCardValue(c) >= 11,
    ).length;
    const trumps = hand.filter((c: CardData) => c.suit === TRUMP_SUIT).length;
    const aces = hand.filter((c: CardData) => c.rank === "A").length;

    let bid = aces;
    bid += Math.floor(highCards / 3);
    bid += Math.floor(trumps / 2);

    return Math.max(1, Math.min(MAX_BID, bid));
  }

  private hardBid(hand: CardData[]): number {
    // Hard: more sophisticated analysis
    let expectedTricks = 0;

    // Group by suit
    const suits: Record<Suit, CardData[]> = {
      spades: [],
      hearts: [],
      diamonds: [],
      clubs: [],
    };
    hand.forEach((c: CardData) => suits[c.suit].push(c));

    // Analyze each suit
    Object.entries(suits).forEach(([suit, cards]) => {
      cards.sort((a, b) => getCardValue(b) - getCardValue(a));

      cards.forEach((card, index) => {
        const value = getCardValue(card);

        if (suit === TRUMP_SUIT) {
          // High trumps are very likely to win
          if (value >= 12) expectedTricks += 0.9;
          else if (value >= 10) expectedTricks += 0.6;
          else expectedTricks += 0.2;
        } else {
          // Non-trump high cards
          if (value === 14)
            expectedTricks += 0.8; // Ace
          else if (value === 13)
            expectedTricks += 0.5; // King
          else if (value === 12 && index === 0) expectedTricks += 0.3; // Queen if highest
        }
      });

      // Void suits can be trumped
      if (cards.length === 0 && suits[TRUMP_SUIT].length > 0) {
        expectedTricks += 0.3;
      }
    });

    return Math.max(1, Math.min(MAX_BID, Math.round(expectedTricks)));
  }

  chooseCard(
    hand: CardData[],
    leadSuit: Suit | null,
    currentTrick: TrickEntry[] = [],
    context: BotContext = {},
  ): CardData {
    const validCards = leadSuit ? getValidCards(hand, leadSuit) : hand;

    if (validCards.length === 1) {
      return validCards[0];
    }

    switch (this.difficulty) {
      case "easy":
        return this.easyPlay(validCards, leadSuit, currentTrick);
      case "hard":
        return this.hardPlay(validCards, leadSuit, currentTrick, context);
      default:
        return this.mediumPlay(validCards, leadSuit, currentTrick);
    }
  }

  private easyPlay(
    validCards: CardData[],
    leadSuit: Suit | null,
    currentTrick: TrickEntry[],
  ): CardData {
    // Easy: play lowest valid card
    return validCards.sort(
      (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
    )[0];
  }

  private mediumPlay(
    validCards: CardData[],
    leadSuit: Suit | null,
    currentTrick: TrickEntry[],
  ): CardData {
    // Medium: try to win when possible, otherwise play low

    if (currentTrick.length === 0) {
      // Leading: play medium card
      const sorted = validCards.sort(
        (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
      );
      return sorted[Math.floor(sorted.length / 2)];
    }

    // Find current winning card
    const winningCard = this.findWinningCard(currentTrick, leadSuit);

    // Check if we can beat it
    const canWin = validCards.filter((c: CardData) =>
      this.beats(c, winningCard, leadSuit),
    );

    if (canWin.length > 0) {
      // Play lowest winning card
      return canWin.sort(
        (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
      )[0];
    }

    // Can't win: play lowest card
    return validCards.sort(
      (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
    )[0];
  }

  private hardPlay(
    validCards: CardData[],
    leadSuit: Suit | null,
    currentTrick: TrickEntry[],
    context: BotContext,
  ): CardData {
    const { tricksNeeded = 1, tricksWon = 0 } = context;

    if (currentTrick.length === 0) {
      // Leading
      return this.chooseLead(validCards, tricksNeeded - tricksWon);
    }

    const winningCard = this.findWinningCard(currentTrick, leadSuit);
    const isLastPlayer = currentTrick.length === 3;

    // Find cards that can win
    const winningCards = validCards.filter((c: CardData) =>
      this.beats(c, winningCard, leadSuit),
    );

    if (winningCards.length > 0) {
      if (isLastPlayer) {
        // Last player: win with lowest possible
        return winningCards.sort(
          (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
        )[0];
      }

      // Not last: consider if we need the trick
      if (tricksWon < tricksNeeded) {
        // Play to win
        return winningCards.sort(
          (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
        )[0];
      }
    }

    // Dump low card
    return validCards.sort(
      (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
    )[0];
  }

  private chooseLead(
    validCards: CardData[],
    tricksStillNeeded: number,
  ): CardData {
    if (tricksStillNeeded > 0) {
      // Need tricks: lead with strong cards
      const aces = validCards.filter(
        (c: CardData) => c.rank === "A" && c.suit !== TRUMP_SUIT,
      );
      if (aces.length > 0) return aces[0];

      // Lead with high trumps
      const highTrumps = validCards
        .filter((c: CardData) => c.suit === TRUMP_SUIT && getCardValue(c) >= 12)
        .sort((a: CardData, b: CardData) => getCardValue(b) - getCardValue(a));
      if (highTrumps.length > 0) return highTrumps[0];
    }

    // Lead with medium card
    const nonTrumps = validCards.filter((c: CardData) => c.suit !== TRUMP_SUIT);
    if (nonTrumps.length > 0) {
      const sorted = nonTrumps.sort(
        (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
      );
      return sorted[Math.floor(sorted.length / 2)];
    }

    // Only trumps: lead lowest
    return validCards.sort(
      (a: CardData, b: CardData) => getCardValue(a) - getCardValue(b),
    )[0];
  }

  private findWinningCard(
    trick: TrickEntry[],
    leadSuit: Suit | null,
  ): CardData {
    let winner = trick[0].card;

    for (let i = 1; i < trick.length; i++) {
      if (this.beats(trick[i].card, winner, leadSuit)) {
        winner = trick[i].card;
      }
    }

    return winner;
  }

  private beats(
    card1: CardData,
    card2: CardData,
    leadSuit: Suit | null,
  ): boolean {
    // Trump beats non-trump
    if (card1.suit === TRUMP_SUIT && card2.suit !== TRUMP_SUIT) return true;
    if (card2.suit === TRUMP_SUIT && card1.suit !== TRUMP_SUIT) return false;

    // Same suit: higher value wins
    if (card1.suit === card2.suit) {
      return getCardValue(card1) > getCardValue(card2);
    }

    // Lead suit beats non-lead non-trump
    if (card1.suit === leadSuit) return true;
    if (card2.suit === leadSuit) return false;

    return false;
  }
}
