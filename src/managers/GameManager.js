import Phaser from 'phaser';
import {
  PHASE, EVENTS, TOTAL_ROUNDS, CARDS_PER_PLAYER, NUM_PLAYERS,
  ANIMATION, TRUMP_SUIT, MAX_BID
} from '../utils/constants.js';
import {
  createDeck, shuffleDeck, sortHand, findTrickWinner,
  getValidCards, calculateScore
} from '../utils/cards.js';

export default class GameManager extends Phaser.Events.EventEmitter {
  constructor(scene) {
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

  setPlayers(players) {
    this.players = players;
  }

  setTrickArea(trickArea) {
    this.trickArea = trickArea;
  }

  setPhase(phase) {
    this.phase = phase;
    this.emit(EVENTS.PHASE_CHANGED, phase);
  }

  // Start a new game
  async startGame() {
    this.currentRound = 1;
    this.players.forEach(p => p.fullReset());
    await this.startRound();
  }

  // Start a new round
  async startRound() {
    this.setPhase(PHASE.DEALING);

    // Reset round state
    this.trickNumber = 0;
    this.leadSuit = null;
    this.currentTrick = [];
    this.biddingPlayer = 0;

    // Reset players for new round
    this.players.forEach(p => p.reset());

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
      const cards = deck.slice(index * CARDS_PER_PLAYER, (index + 1) * CARDS_PER_PLAYER);
      return player.setCards(sortHand(cards), true);
    });

    await Promise.all(dealPromises);
  }

  async runBidding() {
    for (let i = 0; i < NUM_PLAYERS; i++) {
      this.biddingPlayer = i;
      this.emit(EVENTS.TURN_CHANGED, i);

      const player = this.players[i];

      if (player.isHuman) {
        // Wait for human bid (handled by UI)
        await this.waitForHumanBid();
      } else {
        // Bot bidding
        await this.delay(ANIMATION.BOT_THINK);
        const bid = this.calculateBotBid(player);
        player.setBid(bid);
        this.emit(EVENTS.BID_PLACED, { playerIndex: i, bid });
      }
    }

    // Start playing phase
    this.currentTurn = 0;
    this.setPhase(PHASE.PLAYING);
    this.emit(EVENTS.TURN_CHANGED, 0);
    this.updatePlayableCards();
  }

  waitForHumanBid() {
    return new Promise((resolve) => {
      this.once('humanBidPlaced', resolve);
    });
  }

  placeHumanBid(bid) {
    const player = this.players[0];
    player.setBid(bid);
    this.emit(EVENTS.BID_PLACED, { playerIndex: 0, bid });
    this.emit('humanBidPlaced');
  }

  calculateBotBid(player) {
    const hand = player.getCardData();
    const highCards = hand.filter(c => c.value >= 11).length;
    const spades = hand.filter(c => c.suit === TRUMP_SUIT).length;
    return Math.max(1, Math.min(MAX_BID, Math.floor((highCards + spades) / 2) + 1));
  }

  updatePlayableCards() {
    this.players.forEach((player, index) => {
      if (index === this.currentTurn && player.isHuman) {
        player.updatePlayableCards(this.leadSuit);
      } else {
        player.disableAllCards();
      }
    });
  }

  async playCard(cardData, playerIndex) {
    if (this.phase !== PHASE.PLAYING) return;
    if (playerIndex !== this.currentTurn) return;

    const player = this.players[playerIndex];

    // Validate move
    const hand = player.getCardData();
    const validCards = getValidCards(hand, this.leadSuit);
    if (!validCards.find(c => c.id === cardData.id)) return;

    // Set lead suit if first card
    if (this.currentTrick.length === 0) {
      this.leadSuit = cardData.suit;
    }

    // Remove card from hand and get the card object
    const cardObject = player.removeCard(cardData);

    // Play card to center
    await this.trickArea.playCard(cardData, playerIndex, cardObject);

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
    const validCards = getValidCards(hand, this.leadSuit);

    // Simple bot strategy: play lowest valid card
    validCards.sort((a, b) => a.value - b.value);
    const cardToPlay = validCards[0];

    await this.playCard(cardToPlay, this.currentTurn);
  }

  async completeTrick() {
    this.setPhase(PHASE.TRICK_END);

    // Find winner
    const winnerIndex = findTrickWinner(this.currentTrick, this.leadSuit);
    this.players[winnerIndex].addTrick();

    this.emit(EVENTS.TRICK_COMPLETE, { winnerIndex });

    // Collect cards animation
    await this.delay(500);
    await this.trickArea.collectTrick(winnerIndex);

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
    this.players.forEach(player => {
      const score = calculateScore(player.bid, player.tricksWon);
      player.setRoundScore(score);
    });

    this.emit(EVENTS.ROUND_COMPLETE, {
      round: this.currentRound,
      players: this.players.map(p => ({
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
      players: sortedPlayers.map(p => ({
        name: p.name,
        emoji: p.emoji,
        score: p.score,
      })),
    });
  }

  async restartGame() {
    this.trickArea.clear();
    await this.startGame();
  }

  delay(ms) {
    return new Promise(resolve => this.scene.time.delayedCall(ms, resolve));
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
