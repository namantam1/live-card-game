// Card Utilities

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUES = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

export const createDeck = () => {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, id: `${rank}-${suit}` });
    }
  }
  return deck;
};

export const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const getCardValue = (card) => RANK_VALUES[card.rank];

export const compareCards = (card1, card2, leadSuit) => {
  // Trump (spades) beats non-trump
  if (card1.suit === 'spades' && card2.suit !== 'spades') return 1;
  if (card2.suit === 'spades' && card1.suit !== 'spades') return -1;

  // If same suit type (both trump or both lead suit)
  if (card1.suit === card2.suit) {
    return getCardValue(card1) - getCardValue(card2);
  }

  // Lead suit beats non-lead, non-trump
  if (card1.suit === leadSuit) return 1;
  if (card2.suit === leadSuit) return -1;

  return 0;
};

export const findWinner = (trick, leadSuit) => {
  let winnerIndex = 0;
  let winningCard = trick[0].card;

  for (let i = 1; i < trick.length; i++) {
    if (compareCards(trick[i].card, winningCard, leadSuit) > 0) {
      winnerIndex = i;
      winningCard = trick[i].card;
    }
  }

  return trick[winnerIndex].player;
};

export const sortHand = (hand) => {
  const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return getCardValue(b) - getCardValue(a);
  });
};

export const getCardImagePath = (card) => {
  const rankMap = { 'A': 'A', 'J': 'J', 'Q': 'Q', 'K': 'K' };
  const fileRank = rankMap[card.rank] || card.rank;
  return `${import.meta.env.BASE_URL}cards/${fileRank}-${card.suit}.svg`;
};
