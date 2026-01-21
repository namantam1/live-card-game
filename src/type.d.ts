import { Rank, Suit } from "./utils/constants";

export type Position = {
    x: number;
    y: number;
}

interface TrickEntry {
  playerIndex: number;
  card: Card;
}

interface CardData {
  suit: Suit;
  rank: Rank;
  id: string;
  value: number;
}

