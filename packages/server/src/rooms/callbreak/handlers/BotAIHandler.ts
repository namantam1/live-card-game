import { BaseHandler } from './BaseHandler.js';
import { Player } from '../GameState.js';
import { calculateBid, type Suit, chooseBotCard } from '@call-break/shared';
import { EMOJIS } from './ConnectionHandler.js';

const BOT_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Charlie'];
const BOT_DELAY = 500; // Delay for bot actions in ms
const NUM_PLAYERS = 4;

/**
 * Handles bot AI logic including bot creation, bidding, and card playing
 * Manages automated bot behavior and decision making
 */
export class BotAIHandler extends BaseHandler {
  registerMessages(): void {
    // Bot AI doesn't register message handlers
    // It responds to game state changes
  }

  /**
   * Add bots to fill remaining player spots
   */
  addBots(): void {
    const currentPlayerCount = this.room.state.players.size;
    const botsNeeded = NUM_PLAYERS - currentPlayerCount;

    for (let i = 0; i < botsNeeded; i++) {
      const botId = `bot_${i}_${Date.now()}`;
      const seatIndex = currentPlayerCount + i;

      const bot = new Player();
      bot.id = botId;
      bot.name = BOT_NAMES[i] || `Bot ${i + 1}`;
      bot.emoji = EMOJIS[seatIndex];
      bot.seatIndex = seatIndex;
      bot.isReady = true;
      bot.isBot = true;

      this.room.state.players.set(botId, bot);
      this.room.state.playerOrder.push(botId);

      console.log(`Added ${bot.name} at seat ${seatIndex}`);
    }
  }

  /**
   * Check if current turn belongs to a bot and trigger appropriate action
   * Should be called after any turn change
   */
  checkBotTurn(): void {
    const currentPlayerId = this.room.state.currentTurn;
    const currentPlayer = this.getPlayer(currentPlayerId);

    if (!currentPlayer || !currentPlayer.isBot) return;

    // Add delay before bot action to make it feel natural
    this.room.clock.setTimeout(() => {
      if (this.room.state.phase === 'bidding') {
        this.botBid(currentPlayerId);
      } else if (this.room.state.phase === 'playing') {
        this.botPlayCard(currentPlayerId);
      }
    }, BOT_DELAY);
  }

  /**
   * Execute bot bidding logic
   */
  private botBid(botId: string): void {
    const bot = this.getPlayer(botId);
    if (!bot) return;

    const bid = calculateBid(
      Array.from(bot.hand).map((c) => c.toCardData()),
      this.room.state.trumpSuit,
      this.room.state.maxBid
    );

    // Set bid
    bot.bid = bid;
    console.log(`${bot.name} (bot) bid ${bid}`);

    // Count how many players have bid
    const bidsPlaced = Array.from(this.room.state.players.values()).filter(
      (p) => p.bid > 0
    ).length;

    if (bidsPlaced >= NUM_PLAYERS) {
      // All bids placed, start playing - first bidder starts
      const firstBidderIndex = (this.room.state.currentRound - 1) % NUM_PLAYERS;
      this.room.state.phase = 'playing';
      this.room.state.currentTurn =
        this.room.state.playerOrder[firstBidderIndex] || '';
      this.checkBotTurn();
    } else {
      // Move to next bidder with wrap-around
      this.room.state.biddingPlayerIndex =
        (this.room.state.biddingPlayerIndex + 1) % NUM_PLAYERS;
      this.room.state.currentTurn =
        this.room.state.playerOrder[this.room.state.biddingPlayerIndex] || '';
      this.checkBotTurn();
    }
  }

  /**
   * Execute bot card playing logic
   */
  private botPlayCard(botId: string): void {
    const bot = this.getPlayer(botId);
    if (!bot || bot.hand.length === 0) return;

    const hand = bot.hand.map((c) => c.toCardData());
    const currentTrick = Array.from(this.room.state.currentTrick).map(
      (e, index) => ({
        playerIndex: index,
        card: e.card.toCardData(),
      })
    );

    const cardToPlay = chooseBotCard(
      hand,
      this.room.state.leadSuit as Suit,
      currentTrick,
      {
        trumpSuit: this.room.state.trumpSuit as Suit,
        tricksWon: bot.tricksWon,
        bid: bot.bid,
        numPlayers: NUM_PLAYERS,
      }
    );

    console.log(
      `${bot.name} (bot) playing ${cardToPlay.rank} of ${cardToPlay.suit}`
    );

    // Use the room's playCard method to execute the move
    this.room.playCard(botId, cardToPlay.id);
  }
}
