// Game Constants
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export const TRUMP_SUIT = 'spades';
export const TOTAL_ROUNDS = 5;
export const CARDS_PER_PLAYER = 13;
export const NUM_PLAYERS = 4;
export const MAX_BID = 8;  // Maximum allowed bid value

// Player positions (for 4 players around a table)
export const PLAYER_POSITIONS = {
  bottom: { x: 0.5, y: 0.85, rotation: 0, labelY: 0.95 },
  left: { x: 0.20, y: 0.5, rotation: 90, labelX: 0.13 },   // Closer to table center
  top: { x: 0.5, y: 0.15, rotation: 180, labelY: 0.05 },
  right: { x: 0.80, y: 0.5, rotation: -90, labelX: 0.87 }, // Closer to table center
};

// Animation durations (in ms)
export const ANIMATION = {
  CARD_DEAL: 100,
  CARD_PLAY: 300,
  CARD_TO_CENTER: 400,
  TRICK_COLLECT: 800,
  BOT_THINK: 600,
  SCENE_TRANSITION: 500,
};

// Card dimensions
export const CARD = {
  WIDTH: 80,
  HEIGHT: 112,
  SCALE: 0.7,
  HAND_OVERLAP: 35,  // Increased for better card visibility
  HOVER_LIFT: 25,
};

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
};

// Game phases
export const PHASE = {
  IDLE: 'idle',
  DEALING: 'dealing',
  BIDDING: 'bidding',
  PLAYING: 'playing',
  TRICK_END: 'trickEnd',
  ROUND_END: 'roundEnd',
  GAME_OVER: 'gameOver',
};

// Events
export const EVENTS = {
  CARD_PLAYED: 'cardPlayed',
  TRICK_COMPLETE: 'trickComplete',
  ROUND_COMPLETE: 'roundComplete',
  GAME_COMPLETE: 'gameComplete',
  BID_PLACED: 'bidPlaced',
  TURN_CHANGED: 'turnChanged',
  PHASE_CHANGED: 'phaseChanged',
};
