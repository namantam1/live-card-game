/**
 * Scoring calculation for Call Break
 */

/**
 * Calculate round score for a player based on their bid and tricks won
 *
 * Scoring Rules:
 * - If tricks won >= bid: score = bid + 0.1 * (tricks won - bid)
 * - If tricks won < bid: score = -bid (negative)
 *
 * Examples:
 * - Bid 3, won 3: 3.0 points
 * - Bid 3, won 5: 3.2 points (3 + 0.1*2)
 * - Bid 4, won 2: -4.0 points (penalty)
 *
 * @param bid - Player's bid for the round
 * @param tricksWon - Number of tricks actually won
 * @returns Score for the round (can be negative)
 */
export function calculateScore(bid: number, tricksWon: number): number {
  if (tricksWon >= bid) {
    return bid + (tricksWon - bid) * 0.1;
  }
  return -bid;
}
