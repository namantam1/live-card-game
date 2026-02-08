import { Room, type Client } from 'colyseus';
import {
  GameState,
  Player,
  Card,
  TrickEntry,
  createDeck,
  getValidCards,
  calculateScore,
  getDealtCards,
} from './GameState.js';
import { calculateBid, type Suit, chooseBotCard } from '@call-break/shared';
import {
  ChatHandler,
  ReactionHandler,
  ConnectionHandler,
} from './handlers/index.js';
import { EMOJIS } from './handlers/ConnectionHandler.js';

const BOT_NAMES = ['Bot Alice', 'Bot Bob', 'Bot Charlie'];
const CARDS_PER_PLAYER = 13;
const NUM_PLAYERS = 4;
const BOT_DELAY = 1000; // Delay for bot actions in ms

interface JoinOptions {
  name?: string;
  roomCode?: string;
}

interface BidData {
  bid: number;
}

interface PlayCardData {
  cardId: string;
}

export class CallBreakRoom extends Room {
  maxClients = 4;
  state = new GameState();

  // Handlers for organizing domain-specific logic
  private chatHandler!: ChatHandler;
  private reactionHandler!: ReactionHandler;
  private connectionHandler!: ConnectionHandler;

  onCreate(_options: JoinOptions): void {
    // Generate room code (with low collision probability)
    this.state.roomCode = this.generateRoomCode();

    // Set metadata for room filtering
    this.setMetadata({ roomCode: this.state.roomCode });

    console.log(`Room created: ${this.state.roomCode}`);

    // Initialize handlers
    this.chatHandler = new ChatHandler(this);
    this.reactionHandler = new ReactionHandler(this);
    this.connectionHandler = new ConnectionHandler(this);

    // Register handler messages
    this.chatHandler.registerMessages();
    this.reactionHandler.registerMessages();
    this.connectionHandler.registerMessages();

    // Handle game messages
    this.onMessage('ready', (client) => this.handleReady(client));
    this.onMessage('bid', (client, data: BidData) =>
      this.handleBid(client, data)
    );
    this.onMessage('playCard', (client, data: PlayCardData) =>
      this.handlePlayCard(client, data)
    );
    this.onMessage('nextRound', (client) => this.handleNextRound(client));
    // TODO: This restart doesn;t make any sense in multiplayer, Do cleanup
    this.onMessage('restart', (client) => this.handleRestart(client));
  }

  generateRoomCode(): string {
    // Using 32 characters ^ 4 positions = 1,048,576 possible codes
    // Collision probability is very low for typical concurrent room counts
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  onJoin(client: Client, options: JoinOptions): void {
    this.connectionHandler.handleJoin(client, options);
  }

  async onLeave(client: Client, code: number): Promise<void> {
    await this.connectionHandler.handleLeave(client, code);
  }

  handleReady(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.isReady = true;

    // Check if all human players are ready
    const humanPlayers = Array.from(this.state.players.values()).filter(
      (p) => !p.isBot
    );
    const allHumansReady = humanPlayers.every((p) => p.isReady);

    if (allHumansReady && humanPlayers.length >= 1) {
      // Add bots to fill remaining spots
      this.addBots();

      // Now start the game
      this.startGame();
    }
  }

  addBots(): void {
    const currentPlayerCount = this.state.players.size;
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

      this.state.players.set(botId, bot);
      this.state.playerOrder.push(botId);

      console.log(`Added ${bot.name} at seat ${seatIndex}`);
    }
  }

  startGame(): void {
    console.log('Starting game!');
    this.state.currentRound = 1;

    // Reset all players
    this.state.players.forEach((player) => {
      player.score = 0;
      player.roundScore = 0;
    });

    this.startRound();
  }

  startRound(): void {
    this.state.phase = 'dealing';
    this.state.trickNumber = 0;
    this.state.leadSuit = '';
    // Rotate the starting bidder each round (round 1 -> player 0, round 2 -> player 1, etc.)
    this.state.biddingPlayerIndex = (this.state.currentRound - 1) % NUM_PLAYERS;
    this.state.currentTrick.clear();

    // Reset player round state
    this.state.players.forEach((player) => {
      player.bid = 0;
      player.tricksWon = 0;
      player.roundScore = 0;
      player.hand.clear();
    });

    // Deal cards
    this.dealCards();

    // Notify all clients that dealing is done
    this.broadcast('dealt');

    // Start bidding after a short delay
    this.clock.setTimeout(() => {
      this.state.phase = 'bidding';
      this.state.currentTurn =
        this.state.playerOrder[this.state.biddingPlayerIndex] || '';

      // Check if first player is a bot
      this.checkBotTurn();
    }, 1000);
  }

  dealCards(): void {
    const playerIds = Array.from(this.state.playerOrder);
    getDealtCards(createDeck(), playerIds.length).forEach((cards, index) => {
      const playerId = playerIds[index];
      if (!playerId) return;
      const player = this.state.players.get(playerId);
      if (!player) return;
      cards.forEach((cardData) => {
        const card = new Card();
        card.id = cardData.id;
        card.suit = cardData.suit;
        card.rank = cardData.rank;
        card.value = cardData.value;
        player.hand.push(card);
      });
    });
  }

  handleBid(client: Client, data: BidData): void {
    if (this.state.phase !== 'bidding') return;
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const bid = Math.max(1, Math.min(this.state.maxBid, data.bid));
    player.bid = bid;

    console.log(`${player.name} bid ${bid}`);

    // Count how many players have bid
    const bidsPlaced = Array.from(this.state.players.values()).filter(
      (p) => p.bid > 0
    ).length;

    if (bidsPlaced >= NUM_PLAYERS) {
      // All bids placed, start playing - first bidder starts
      const firstBidderIndex = (this.state.currentRound - 1) % NUM_PLAYERS;
      this.state.phase = 'playing';
      this.state.currentTurn = this.state.playerOrder[firstBidderIndex] || '';

      // Check if first player in playing phase is a bot
      this.checkBotTurn();
    } else {
      // Move to next bidder with wrap-around
      this.state.biddingPlayerIndex =
        (this.state.biddingPlayerIndex + 1) % NUM_PLAYERS;
      this.state.currentTurn =
        this.state.playerOrder[this.state.biddingPlayerIndex] || '';

      // Check if next bidder is a bot
      this.checkBotTurn();
    }
  }

  handlePlayCard(client: Client, data: PlayCardData): void {
    if (this.state.phase !== 'playing') return;
    if (this.state.currentTurn !== client.sessionId) return;

    this.playCard(client.sessionId, data.cardId);
  }

  // Internal method to play a card - used by both humans and bots
  playCard(playerId: string, cardId: string): void {
    const player = this.state.players.get(playerId);
    if (!player) return;

    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const card = player.hand[cardIndex];
    if (!card) return;

    // Validate the card can be played
    const validCards = getValidCards(
      player.hand.map((c) => c.toCardData()),
      this.state.leadSuit as Suit,
      Array.from(this.state.currentTrick).map((e, index) => ({
        playerIndex: index,
        card: e.card.toCardData(),
      }))
    );
    if (!validCards.find((c) => c.id === cardId)) return;

    // Set lead suit if first card
    if (this.state.currentTrick.length === 0) {
      this.state.leadSuit = card.suit;
    }

    // Add to current trick
    const trickEntry = new TrickEntry();
    trickEntry.playerId = playerId;

    // Create a new Card instance for proper schema serialization in Colyseus 0.17.x
    const cardInstance = new Card();
    cardInstance.id = card.id;
    cardInstance.suit = card.suit;
    cardInstance.rank = card.rank;
    cardInstance.value = card.value;
    trickEntry.card = cardInstance;

    this.state.currentTrick.push(trickEntry);

    // Remove card from hand
    player.hand.splice(cardIndex, 1);

    console.log(`${player.name} played ${card.rank} of ${card.suit}`);

    // Check if trick is complete
    if (this.state.currentTrick.length === NUM_PLAYERS) {
      this.completeTrick();
    } else {
      // Next player's turn
      const currentIndex = this.state.playerOrder.indexOf(playerId);
      const nextIndex = (currentIndex + 1) % NUM_PLAYERS;
      this.state.currentTurn = this.state.playerOrder[nextIndex] || '';

      // Check if next player is a bot
      this.checkBotTurn();
    }
  }

  completeTrick(): void {
    this.state.phase = 'trickEnd';

    // Find winner
    const winnerId = this.findTrickWinner();

    // Validate winner exists
    if (!winnerId) {
      console.error('No trick winner found! Trick cannot be completed.');
      // Fallback: use first player in order
      this.state.currentTurn = this.state.playerOrder[0] || '';
      this.state.phase = 'playing';
      return;
    }

    const winner = this.state.players.get(winnerId);
    if (!winner) {
      console.error(
        `Winner ${winnerId} not found in players! Player may have disconnected.`
      );
      // Fallback: use first available player
      this.state.currentTurn = this.state.playerOrder[0] || '';
      this.state.phase = 'playing';
      return;
    }

    winner.tricksWon++;
    this.state.trickWinner = winnerId;

    console.log(`${winner.name} won the trick!`);

    // Trigger bot reactions after trick
    this.clock.setTimeout(() => {
      this.reactionHandler.triggerBotTrickReactions(winnerId);
    }, 300);

    // Wait, then clear trick and continue
    this.clock.setTimeout(() => {
      this.state.currentTrick.clear();
      this.state.leadSuit = '';
      this.state.trickNumber++;
      this.state.trickWinner = '';

      if (this.state.trickNumber >= CARDS_PER_PLAYER) {
        this.completeRound();
      } else {
        this.state.phase = 'playing';
        this.state.currentTurn = winnerId; // Winner leads next trick

        // Check if winner is a bot
        this.checkBotTurn();
      }
    }, 1500);
  }

  findTrickWinner(): string {
    // Validate trick has entries
    if (this.state.currentTrick.length === 0) {
      console.error('findTrickWinner called with empty trick!');
      return '';
    }

    const firstEntry = this.state.currentTrick[0];
    if (!firstEntry) {
      console.error('First trick entry is undefined!');
      return '';
    }

    let winningEntry = firstEntry;

    for (let i = 1; i < this.state.currentTrick.length; i++) {
      const entry = this.state.currentTrick[i];
      if (!entry) {
        console.warn(`Trick entry at index ${i} is undefined, skipping`);
        continue;
      }
      if (this.beats(entry.card, winningEntry.card)) {
        winningEntry = entry;
      }
    }

    return winningEntry.playerId || '';
  }

  beats(card1: Card, card2: Card): boolean {
    const trumpSuit = this.state.trumpSuit;
    const leadSuit = this.state.leadSuit;

    // Trump beats non-trump
    if (card1.suit === trumpSuit && card2.suit !== trumpSuit) return true;
    if (card2.suit === trumpSuit && card1.suit !== trumpSuit) return false;

    // Same suit: higher value wins
    if (card1.suit === card2.suit) {
      return card1.value > card2.value;
    }

    // Lead suit beats non-lead non-trump
    if (card1.suit === leadSuit) return true;
    if (card2.suit === leadSuit) return false;

    return false;
  }

  completeRound(): void {
    this.state.phase = 'roundEnd';

    // Calculate scores
    this.state.players.forEach((player) => {
      const roundScore = calculateScore(player.bid, player.tricksWon);
      player.roundScore = roundScore;
      player.score += roundScore;
    });

    // Trigger bot reactions at round end
    this.clock.setTimeout(() => {
      this.reactionHandler.triggerBotRoundEndReactions();
    }, 300);

    console.log('Round complete!');
  }

  handleNextRound(_client: Client): void {
    if (this.state.phase !== 'roundEnd') return;

    if (this.state.currentRound >= this.state.totalRounds) {
      this.state.phase = 'gameOver';
    } else {
      this.state.currentRound++;
      this.startRound();
    }
  }

  handleRestart(_client: Client): void {
    // Reset everything - remove bots first
    const botIds: string[] = [];
    this.state.players.forEach((player, id) => {
      if (player.isBot) {
        botIds.push(id);
      } else {
        player.isReady = false;
      }
    });

    // Remove bots
    botIds.forEach((id) => {
      this.state.players.delete(id);
      const orderIndex = this.state.playerOrder.indexOf(id);
      if (orderIndex !== -1) {
        this.state.playerOrder.splice(orderIndex, 1);
      }
    });

    this.state.phase = 'waiting';
    this.state.currentRound = 1;
  }

  // ============ Bot AI Methods ============

  checkBotTurn(): void {
    const currentPlayerId = this.state.currentTurn;
    const currentPlayer = this.state.players.get(currentPlayerId);

    if (!currentPlayer || !currentPlayer.isBot) return;

    // Add delay before bot action to make it feel natural
    this.clock.setTimeout(() => {
      if (this.state.phase === 'bidding') {
        this.botBid(currentPlayerId);
      } else if (this.state.phase === 'playing') {
        this.botPlayCard(currentPlayerId);
      }
    }, BOT_DELAY);
  }

  botBid(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot) return;

    const bid = calculateBid(
      Array.from(bot.hand).map((c) => c.toCardData()),
      this.state.trumpSuit,
      this.state.maxBid
    );

    // Set bid
    bot.bid = bid;
    console.log(`${bot.name} (bot) bid ${bid}`);

    // Count how many players have bid
    const bidsPlaced = Array.from(this.state.players.values()).filter(
      (p) => p.bid > 0
    ).length;

    if (bidsPlaced >= NUM_PLAYERS) {
      // All bids placed, start playing - first bidder starts
      const firstBidderIndex = (this.state.currentRound - 1) % NUM_PLAYERS;
      this.state.phase = 'playing';
      this.state.currentTurn = this.state.playerOrder[firstBidderIndex] || '';
      this.checkBotTurn();
    } else {
      // Move to next bidder with wrap-around
      this.state.biddingPlayerIndex =
        (this.state.biddingPlayerIndex + 1) % NUM_PLAYERS;
      this.state.currentTurn =
        this.state.playerOrder[this.state.biddingPlayerIndex] || '';
      this.checkBotTurn();
    }
  }

  botPlayCard(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot || bot.hand.length === 0) return;

    const hand = bot.hand.map((c) => c.toCardData());
    const currentTrick = Array.from(this.state.currentTrick).map(
      (e, index) => ({
        playerIndex: index,
        card: e.card.toCardData(),
      })
    );

    const cardToPlay = chooseBotCard(
      hand,
      this.state.leadSuit as Suit,
      currentTrick,
      {
        trumpSuit: this.state.trumpSuit as Suit,
        tricksWon: bot.tricksWon,
        bid: bot.bid,
        numPlayers: NUM_PLAYERS,
      }
    );

    console.log(
      `${bot.name} (bot) playing ${cardToPlay.rank} of ${cardToPlay.suit}`
    );
    this.playCard(botId, cardToPlay.id);
  }
}
