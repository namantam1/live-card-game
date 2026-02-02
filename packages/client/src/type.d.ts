import { Rank, Suit } from "./utils/constants";

export type Position = {
  x: number;
  y: number;
};

export type DifficultyLevel = "easy" | "medium" | "hard";

export interface BotContext {
  tricksNeeded?: number;
  tricksWon?: number;
}

export interface TrickEntry {
  playerIndex: number;
  card: CardData;
}

export interface CardData {
  suit: Suit;
  rank: Rank;
  id: string;
  value: number;
}

export type ConnectionQuality = "good" | "fair" | "poor" | "offline";

export interface CardSchema {
  id: string;
  suit: string;
  rank: string;
  value: number;
}

export interface PlayerSchema {
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

export interface TrickEntrySchema {
  playerId: string;
  card: CardSchema;
}

export interface PlayerData {
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

export interface RoomAvailability {
  roomId: string;
  metadata?: {
    roomCode?: string;
  };
}
