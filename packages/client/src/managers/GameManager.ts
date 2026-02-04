import Phaser, { Scene } from 'phaser';
import {
  PHASE,
  EVENTS,
  TOTAL_ROUNDS,
  CARDS_PER_PLAYER,
  NUM_PLAYERS,
  ANIMATION,
  TRUMP_SUIT,
  type Suit,
} from '../utils/constants';
import {
  createDeck,
  shuffleDeck,
  sortHand,
  findTrickWinner,
  getValidCards,
  calculateScore,
} from '../utils/cards';
import Player from '../objects/Player';
import TrickArea from '../objects/TrickArea';
import type { CardData, TrickEntry } from '../type';
import { calculateBid, chooseBotCard } from '@call-break/shared';

export default class GameManager extends Phaser.Events.EventEmitter {
  scene: Scene;
  players: Player[];
  trickArea: TrickArea | null;
  phase: string;
  currentRound: number;
  currentTurn: number;
  leadSuit: Suit | null;
  trickNumber: number;
  biddingPlayer: number;
  currentTrick: TrickEntry[];
  playerInfo: { name: string; emoji: string; isHuman: boolean }[];
  constructor(scene: Scene) {
    super();

    this.scene = scene;
    this.players = [];
    this.trickArea = null;

    // Game state
    this.phase = PHASE.IDLE;
    this.currentRound = 1;
    this.currentTurn = 0;
    this.leadSuit = null;
    this.trickNumber = 0;
    this.biddingPlayer = 0;
    this.currentTrick = [];

    // Player info
    this.playerInfo = [
      { name: 'You', emoji: '\uD83D\uDE0E', isHuman: true },
      { name: 'Ace', emoji: '\uD83E\uDD16', isHuman: false },
      { name: 'Max', emoji: '\uD83E\uDD8A', isHuman: false },
      { name: 'Zara', emoji: '\uD83D\uDC31', isHuman: false },
    ];
  }

  setPlayers(players: Player[]) {
    this.players = players;
  }

  setTrickArea(trickArea: TrickArea) {
    this.trickArea = trickArea;
  }

  setPhase(phase: string) {
    this.phase = phase;
    this.emit(EVENTS.PHASE_CHANGED, phase);
  }

  // Start a new game
  async startGame() {
    this.currentRound = 1;
    this.players.forEach((p) => p.fullReset());
    await this.startRound();
  }

  // Start a new round
  async startRound() {
    this.setPhase(PHASE.DEALING);

    // Reset round state
    this.trickNumber = 0;
    this.leadSuit = null;
    this.currentTrick = [];
    // Rotate the starting bidder each round (round 1 -> player 0, round 2 -> player 1, etc.)
    this.biddingPlayer = (this.currentRound - 1) % NUM_PLAYERS;

    // Reset players for new round
    this.players.forEach((p) => p.reset());

    // Deal cards
    await this.dealCards();

    // Start bidding
    this.setPhase(PHASE.BIDDING);
    await this.runBidding();
  }

  async dealCards() {
    const deck = shuffleDeck(createDeck());

    // Deal 13 cards to each player
    const dealPromises = this.players.map((player, index) => {
      const cards = deck.slice(
        index * CARDS_PER_PLAYER,
        (index + 1) * CARDS_PER_PLAYER
      );
      return player.setCards(sortHand(cards), true);
    });

    await Promise.all(dealPromises);
  }

  async runBidding() {
    for (let i = 0; i < NUM_PLAYERS; i++) {
      // Calculate actual player index with rotation
      const playerIndex = (this.biddingPlayer + i) % NUM_PLAYERS;
      this.emit(EVENTS.TURN_CHANGED, playerIndex);

      const player = this.players[playerIndex];

      if (player.isHuman) {
        // Wait for human bid (handled by UI)
        await this.waitForHumanBid();
      } else {
        // Bot bidding
        await this.delay(ANIMATION.BOT_THINK);
        const bid = this.calculateBotBid(player);
        player.setBid(bid);
        this.emit(EVENTS.BID_PLACED, { playerIndex, bid });
      }
    }

    // Start playing phase - the first bidder leads
    this.currentTurn = this.biddingPlayer;
    this.setPhase(PHASE.PLAYING);
    this.emit(EVENTS.TURN_CHANGED, this.biddingPlayer);
    this.updatePlayableCards();

    // If first player is a bot, automatically play
    if (!this.players[this.currentTurn].isHuman) {
      await this.playBotTurn();
    }
  }

  waitForHumanBid() {
    return new Promise((resolve) => {
      this.once('humanBidPlaced', resolve);
    });
  }

  placeHumanBid(bid: number) {
    const player = this.players[0];
    player.setBid(bid);
    this.emit(EVENTS.BID_PLACED, { playerIndex: 0, bid });
    this.emit('humanBidPlaced');
  }

  calculateBotBid(player: Player): number {
    const hand = player.getCardData();
    return calculateBid(hand, TRUMP_SUIT);
  }

  updatePlayableCards() {
    console.log('Updating playable cards for current turn:', this.currentTurn);
    this.players.forEach((player, index) => {
      if (index === this.currentTurn && player.isHuman) {
        player.updatePlayableCards(this.leadSuit!, this.currentTrick);
      } else {
        player.disableAllCards();
      }
    });
  }

  async playCard(cardData: CardData, playerIndex: number) {
    if (this.phase !== PHASE.PLAYING) return;
    if (playerIndex !== this.currentTurn) return;

    const player = this.players[playerIndex];

    // Validate move
    const hand = player.getCardData();
    const validCards = getValidCards(hand, this.leadSuit!, this.currentTrick);
    if (!validCards.find((c) => c.id === cardData.id)) return;

    // Set lead suit if first card
    if (this.currentTrick.length === 0) {
      this.leadSuit = cardData.suit;
    }

    // Remove card from hand and get the card object
    const cardObject = player.removeCard(cardData);

    // Play card to center
    await this.trickArea!.playCard(cardData, playerIndex, cardObject);

    // Add to current trick
    this.currentTrick.push({ playerIndex, card: cardData });

    this.emit(EVENTS.CARD_PLAYED, { playerIndex, card: cardData });

    // Check if trick is complete
    if (this.currentTrick.length === NUM_PLAYERS) {
      await this.completeTrick();
    } else {
      // Next player's turn
      this.currentTurn = (this.currentTurn + 1) % NUM_PLAYERS;
      this.emit(EVENTS.TURN_CHANGED, this.currentTurn);
      this.updatePlayableCards();

      // If bot's turn, play automatically
      if (!this.players[this.currentTurn].isHuman) {
        await this.playBotTurn();
      }
    }
  }

  async playBotTurn() {
    await this.delay(ANIMATION.BOT_THINK);

    const player = this.players[this.currentTurn];
    const hand = player.getCardData();

    const cardToPlay = chooseBotCard(hand, this.leadSuit, this.currentTrick, {
      trumpSuit: TRUMP_SUIT,
      tricksWon: player.tricksWon,
      bid: player.bid,
      numPlayers: NUM_PLAYERS,
    });

    await this.playCard(cardToPlay, this.currentTurn);
  }

  async completeTrick() {
    this.setPhase(PHASE.TRICK_END);

    // Find winner
    const winnerIndex = findTrickWinner(this.currentTrick, this.leadSuit!);
    this.players[winnerIndex].addTrick();

    this.emit(EVENTS.TRICK_COMPLETE, { winnerIndex });

    // Collect cards animation
    await this.delay(500);
    await this.trickArea!.collectTrick(winnerIndex);

    // Reset for next trick
    this.currentTrick = [];
    this.leadSuit = null;
    this.trickNumber++;

    // Check if round is complete
    if (this.trickNumber >= CARDS_PER_PLAYER) {
      await this.completeRound();
    } else {
      // Winner leads next trick
      this.currentTurn = winnerIndex;
      this.setPhase(PHASE.PLAYING);
      this.emit(EVENTS.TURN_CHANGED, this.currentTurn);
      this.updatePlayableCards();

      // If bot's turn, play automatically
      if (!this.players[this.currentTurn].isHuman) {
        await this.playBotTurn();
      }
    }
  }

  async completeRound() {
    this.setPhase(PHASE.ROUND_END);

    // Calculate scores
    this.players.forEach((player) => {
      const score = calculateScore(player.bid, player.tricksWon);
      player.setRoundScore(score);
    });

    this.emit(EVENTS.ROUND_COMPLETE, {
      round: this.currentRound,
      players: this.players.map((p) => ({
        name: p.name,
        bid: p.bid,
        tricksWon: p.tricksWon,
        roundScore: p.roundScore,
        totalScore: p.score,
      })),
    });
  }

  async continueToNextRound() {
    if (this.currentRound >= TOTAL_ROUNDS) {
      this.completeGame();
    } else {
      this.currentRound++;
      await this.startRound();
    }
  }

  completeGame() {
    this.setPhase(PHASE.GAME_OVER);

    // Find winner
    const sortedPlayers = [...this.players].sort((a, b) => b.score - a.score);

    this.emit(EVENTS.GAME_COMPLETE, {
      winner: sortedPlayers[0],
      players: sortedPlayers.map((p) => ({
        name: p.name,
        emoji: p.emoji,
        score: p.score,
      })),
    });
  }

  async restartGame() {
    this.trickArea?.clear();
    await this.startGame();
  }

  delay(ms: number) {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  // Getters for UI
  getCurrentRound() {
    return this.currentRound;
  }

  getTotalRounds() {
    return TOTAL_ROUNDS;
  }

  getCurrentTurn() {
    return this.currentTurn;
  }

  getPhase() {
    return this.phase;
  }

  getPlayers() {
    return this.players;
  }
}
