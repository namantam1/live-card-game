import { Rank, Suit } from "./utils/constants";

export type Position = {
  x: number;
  y: number;
};

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface BotContext {
  tricksNeeded?: number;
  tricksWon?: number;
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

type ConnectionQuality = "good" | "fair" | "poor" | "offline";

interface CardSchema {
  id: string;
  suit: string;
  rank: string;
  value: number;
}

interface PlayerSchema {
  id: string;
  name: string;
  emoji: string;
  seatIndex: number;
  isReady: boolean;
  isConnected: boolean;
  isBot: boolean;
  bid: number;
  tricksWon: number;
  score: number;
  roundScore: number;
  hand: any; // ArraySchema<CardSchema>
  listen: (
    property: string,
    callback: (value: any, previousValue?: any) => void,
  ) => void;
}

interface TrickEntrySchema {
  playerId: string;
  card: CardSchema;
}

interface PlayerData {
  id: string;
  name: string;
  emoji: string;
  seatIndex: number;
  isReady: boolean;
  isConnected: boolean;
  bid: number;
  tricksWon: number;
  score: number;
  roundScore: number;
  isLocal: boolean;
}

interface RoomAvailability {
  roomId: string;
  metadata?: {
    roomCode?: string;
  };
}
