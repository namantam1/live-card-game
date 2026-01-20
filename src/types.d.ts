import { Rank, Suit } from "./utils/constants";


// Player positions (for 4 players around a table)
export type Position = 'bottom' | 'left' | 'top' | 'right';
export interface PlayerPosition {
  x: number;
  y: number;
  rotation: number;
  labelY?: number;
  labelX?: number;
}


interface CardType {
  suit: Suit;
  rank: Rank;
  id: string;
  value: number;
}

interface TrickEntry {
  playerIndex: number;
  card: Card;
}

