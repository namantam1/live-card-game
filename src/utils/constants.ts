import { CARD_CONFIG } from "./uiConfig";

// Re-export game constants from shared package
export {
  SUITS,
  RANKS,
  RANK_VALUES,
  TRUMP_SUIT,
  TOTAL_ROUNDS,
  CARDS_PER_PLAYER,
  NUM_PLAYERS,
  MAX_BID,
  type Suit,
  type Rank,
} from "@call-break/shared";

// Player positions (for 4 players around a table)
export type Position = "bottom" | "left" | "top" | "right";
export interface PlayerPosition {
  x: number;
  y: number;
  rotation: number;
  labelY?: number;
  labelX?: number;
}

export const PLAYER_POSITIONS: Record<Position, PlayerPosition> = {
  bottom: { x: 0.5, y: 0.85, rotation: 0, labelY: 0.95 },
  left: { x: 0.2, y: 0.5, rotation: 90, labelX: 0.13 }, // Closer to table center
  top: { x: 0.5, y: 0.15, rotation: 180, labelY: 0.05 },
  right: { x: 0.8, y: 0.5, rotation: -90, labelX: 0.87 }, // Closer to table center
};

// Animation durations (in ms)
export const ANIMATION = {
  CARD_DEAL: 100,
  CARD_PLAY: 300,
  CARD_TO_CENTER: 400,
  TRICK_COLLECT: 800,
  BOT_THINK: 600,
  SCENE_TRANSITION: 500,
} as const;

// Card dimensions - now imported from centralized UI config
// You can adjust all card sizes in src/config/uiConfig.js
export const CARD = {
  WIDTH: CARD_CONFIG.WIDTH,
  HEIGHT: CARD_CONFIG.HEIGHT,
  SCALE: CARD_CONFIG.DESKTOP_SCALE,
  HAND_OVERLAP: CARD_CONFIG.HAND_OVERLAP,
  HOVER_LIFT: CARD_CONFIG.HOVER_LIFT,
} as const;

// Colors
export const COLORS = {
  PRIMARY: 0x6366f1,
  SECONDARY: 0x8b5cf6,
  SUCCESS: 0x22c55e,
  DANGER: 0xef4444,
  WARNING: 0xf59e0b,
  TABLE_GREEN: 0x065f46,
  TABLE_BORDER: 0x78350f,
  TEXT_LIGHT: 0xffffff,
  TEXT_MUTED: 0x94a3b8,
  PANEL_BG: 0x1e293b,
} as const;

// Game phases
export const PHASE = {
  IDLE: "idle",
  DEALING: "dealing",
  BIDDING: "bidding",
  PLAYING: "playing",
  TRICK_END: "trickEnd",
  ROUND_END: "roundEnd",
  GAME_OVER: "gameOver",
} as const;

export type GamePhase = (typeof PHASE)[keyof typeof PHASE];

// Events
export const EVENTS = {
  CARD_PLAYED: "cardPlayed",
  TRICK_COMPLETE: "trickComplete",
  ROUND_COMPLETE: "roundComplete",
  GAME_COMPLETE: "gameComplete",
  BID_PLACED: "bidPlayed",
  TURN_CHANGED: "turnChanged",
  PHASE_CHANGED: "phaseChanged",
  // Connection events (multiplayer only, ignored by solo mode)
  CONNECTION_QUALITY_CHANGED: "connectionQualityChanged",
  RECONNECTING: "reconnecting",
  RECONNECTED: "reconnected",
  RECONNECTION_FAILED: "reconnectionFailed",
  CONNECTION_ERROR: "connectionError",
  ROOM_LEFT: "roomLeft",
} as const;

// UI timing constants
export const UI_TIMING = {
  BIDDING_UI_DELAY: 300, // Delay before showing bidding UI to allow card animations to settle
} as const;

export type GameEvent = (typeof EVENTS)[keyof typeof EVENTS];

// Server configuration
export const SERVER = {
  // Use environment variable in production, fallback to localhost for development
  URL: (import.meta as any).env.VITE_SERVER_URL || "ws://localhost:2567",
} as const;
