/**
 * Card type definitions for Call Break game
 */

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

/**
 * Represents a playing card in the game
 */
export interface CardData {
  /** Unique identifier for the card (e.g., "A-spades") */
  id: string;
  /** Card suit */
  suit: Suit;
  /** Card rank */
  rank: Rank;
  /** Numeric value for comparison (2-14) */
  value: number;
}
