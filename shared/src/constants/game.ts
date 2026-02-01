/**
 * Core game constants for Call Break
 */

import type { Suit, Rank } from "../types/card.js";

/**
 * All valid card suits in the game
 */
export const SUITS: readonly Suit[] = [
  "spades",
  "hearts",
  "diamonds",
  "clubs",
] as const;

/**
 * All valid card ranks in ascending order
 */
export const RANKS: readonly Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;

/**
 * Numeric values for each rank (used for card comparison)
 */
export const RANK_VALUES: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
} as const;

/**
 * The trump suit in Call Break (always spades)
 */
export const TRUMP_SUIT: Suit = "spades";
