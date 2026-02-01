import pkg from "colyseus";
import type { Client } from "colyseus";
const { Room } = pkg;
import {
  GameState,
  Player,
  Card,
  TrickEntry,
  CardData,
  createDeck,
  getValidCards,
  calculateScore,
  getDealtCards,
} from "./GameState.js";

const EMOJIS = ["😎", "🤖", "🦊", "🐱"];
const BOT_NAMES = ["Bot Alice", "Bot Bob", "Bot Charlie"];
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

export class CallBreakRoom extends Room<GameState> {
  maxClients = 4;

  onCreate(options: JoinOptions): void {
    this.setState(new GameState());

    // Generate room code
    this.state.roomCode = this.generateRoomCode();

    // Set metadata for room filtering
    this.setMetadata({ roomCode: this.state.roomCode });

    console.log(`Room created: ${this.state.roomCode}`);

    // Handle messages
    this.onMessage("ready", (client) => this.handleReady(client));
    this.onMessage("bid", (client, data: BidData) =>
      this.handleBid(client, data),
    );
    this.onMessage("playCard", (client, data: PlayCardData) =>
      this.handlePlayCard(client, data),
    );
    this.onMessage("nextRound", (client) => this.handleNextRound(client));
    // TODO: This restart doesn;t make any sense in multiplayer, Do cleanup
    this.onMessage("restart", (client) => this.handleRestart(client));
  }

  generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  onJoin(client: Client, options: JoinOptions): void {
    // Validate room code if provided (for join attempts, not create)
    if (options.roomCode && options.roomCode !== this.state.roomCode) {
      throw new Error(
        `Invalid room code. Room code is ${this.state.roomCode}, but got ${options.roomCode}`,
      );
    }

    const name = options.name || `Player ${this.state.players.size + 1}`;
    const seatIndex = this.state.players.size;

    const player = new Player();
    player.id = client.sessionId;
    player.name = name;
    player.emoji = EMOJIS[seatIndex];
    player.seatIndex = seatIndex;

    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.push(client.sessionId);

    console.log(
      `${name} joined room ${this.state.roomCode} (seat ${seatIndex})`,
    );

    // Notify client of their seat
    client.send("seated", { seatIndex, roomCode: this.state.roomCode });
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.isConnected = false;
      console.log(`${player.name} disconnected (consented: ${consented})`);

      // If player intentionally left (consented), remove them immediately
      if (consented) {
        console.log(`${player.name} left intentionally`);
        this.state.players.delete(client.sessionId);
        const orderIndex = this.state.playerOrder.indexOf(client.sessionId);
        if (orderIndex !== -1) {
          this.state.playerOrder.splice(orderIndex, 1);
        }
        if (this.state.phase !== "waiting") {
          this.broadcast("playerLeft", { name: player.name });
        }

        // If we're in active gameplay and all human players left, end the room
        const remainingHumans = Array.from(this.state.players.values()).filter(
          (p) => !p.isBot,
        );
        if (remainingHumans.length === 0 && this.state.phase !== "waiting") {
          console.log("All human players left, ending room");
          await this.disconnect();
        }
        return;
      }

      try {
        // Allow reconnection within 60 seconds for unintentional disconnects
        console.log(
          `${player.name} disconnected unexpectedly. Allowing 60s for reconnection...`,
        );
        await this.allowReconnection(client, 60);

        player.isConnected = true;
        console.log(`${player.name} reconnected successfully`);

        // Notify player they've reconnected
        client.send("reconnected", {
          message: "Successfully reconnected",
          roomCode: this.state.roomCode,
        });

        // Broadcast to other players
        this.broadcast(
          "playerReconnected",
          {
            playerId: client.sessionId,
            name: player.name,
          },
          { except: client },
        );
      } catch (e) {
        // Player didn't reconnect, handle game state
        console.log(`${player.name} failed to reconnect within timeout`);
        if (this.state.phase !== "waiting") {
          this.broadcast("playerLeft", { name: player.name });
        }

        // If all human players are gone, end the room
        const remainingHumans = Array.from(this.state.players.values()).filter(
          (p) => !p.isBot && p.isConnected,
        );
        if (remainingHumans.length === 0) {
          console.log("All human players disconnected, ending room");
          await this.disconnect();
        }
      }
    }
  }

  handleReady(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.isReady = true;

    // Check if all human players are ready
    const humanPlayers = Array.from(this.state.players.values()).filter(
      (p) => !p.isBot,
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
    console.log("Starting game!");
    this.state.currentRound = 1;

    // Reset all players
    this.state.players.forEach((player) => {
      player.score = 0;
      player.roundScore = 0;
    });

    this.startRound();
  }

  startRound(): void {
    this.state.phase = "dealing";
    this.state.trickNumber = 0;
    this.state.leadSuit = "";
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
    this.broadcast("dealt");

    // Start bidding after a short delay
    this.clock.setTimeout(() => {
      this.state.phase = "bidding";
      this.state.currentTurn =
        this.state.playerOrder[this.state.biddingPlayerIndex] || "";

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
    if (this.state.phase !== "bidding") return;
    if (this.state.currentTurn !== client.sessionId) return;

    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const bid = Math.max(1, Math.min(this.state.maxBid, data.bid));
    player.bid = bid;

    console.log(`${player.name} bid ${bid}`);

    // Count how many players have bid
    const bidsPlaced = Array.from(this.state.players.values()).filter(
      (p) => p.bid > 0,
    ).length;

    if (bidsPlaced >= NUM_PLAYERS) {
      // All bids placed, start playing - first bidder starts
      const firstBidderIndex = (this.state.currentRound - 1) % NUM_PLAYERS;
      this.state.phase = "playing";
      this.state.currentTurn = this.state.playerOrder[firstBidderIndex] || "";

      // Check if first player in playing phase is a bot
      this.checkBotTurn();
    } else {
      // Move to next bidder with wrap-around
      this.state.biddingPlayerIndex =
        (this.state.biddingPlayerIndex + 1) % NUM_PLAYERS;
      this.state.currentTurn =
        this.state.playerOrder[this.state.biddingPlayerIndex] || "";

      // Check if next bidder is a bot
      this.checkBotTurn();
    }
  }

  handlePlayCard(client: Client, data: PlayCardData): void {
    if (this.state.phase !== "playing") return;
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
      player.hand.map((c) => ({
        id: c.id,
        suit: c.suit as any,
        rank: c.rank as any,
        value: c.value,
      })),
      this.state.leadSuit as any,
      Array.from(this.state.currentTrick).map((e, index) => ({
        playerIndex: index,
        card: {
          id: e!.card.id,
          suit: e!.card.suit as any,
          rank: e!.card.rank as any,
          value: e!.card.value,
        },
      })),
    );
    if (!validCards.find((c) => c.id === cardId)) return;

    // Set lead suit if first card
    if (this.state.currentTrick.length === 0) {
      this.state.leadSuit = card.suit;
    }

    // Add to current trick
    const trickEntry = new TrickEntry();
    trickEntry.playerId = playerId;
    trickEntry.card.id = card.id;
    trickEntry.card.suit = card.suit;
    trickEntry.card.rank = card.rank;
    trickEntry.card.value = card.value;
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
      this.state.currentTurn = this.state.playerOrder[nextIndex] || "";

      // Check if next player is a bot
      this.checkBotTurn();
    }
  }

  completeTrick(): void {
    this.state.phase = "trickEnd";

    // Find winner
    const winnerId = this.findTrickWinner();

    // Validate winner exists
    if (!winnerId) {
      console.error("No trick winner found! Trick cannot be completed.");
      // Fallback: use first player in order
      this.state.currentTurn = this.state.playerOrder[0] || "";
      this.state.phase = "playing";
      return;
    }

    const winner = this.state.players.get(winnerId);
    if (!winner) {
      console.error(
        `Winner ${winnerId} not found in players! Player may have disconnected.`,
      );
      // Fallback: use first available player
      this.state.currentTurn = this.state.playerOrder[0] || "";
      this.state.phase = "playing";
      return;
    }

    winner.tricksWon++;
    this.state.trickWinner = winnerId;

    console.log(`${winner.name} won the trick!`);

    // Wait, then clear trick and continue
    this.clock.setTimeout(() => {
      this.state.currentTrick.clear();
      this.state.leadSuit = "";
      this.state.trickNumber++;
      this.state.trickWinner = "";

      if (this.state.trickNumber >= CARDS_PER_PLAYER) {
        this.completeRound();
      } else {
        this.state.phase = "playing";
        this.state.currentTurn = winnerId; // Winner leads next trick

        // Check if winner is a bot
        this.checkBotTurn();
      }
    }, 1500);
  }

  findTrickWinner(): string {
    // Validate trick has entries
    if (this.state.currentTrick.length === 0) {
      console.error("findTrickWinner called with empty trick!");
      return "";
    }

    const firstEntry = this.state.currentTrick[0];
    if (!firstEntry) {
      console.error("First trick entry is undefined!");
      return "";
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

    return winningEntry.playerId || "";
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
    this.state.phase = "roundEnd";

    // Calculate scores
    this.state.players.forEach((player) => {
      const roundScore = calculateScore(player.bid, player.tricksWon);
      player.roundScore = roundScore;
      player.score += roundScore;
    });

    console.log("Round complete!");
  }

  handleNextRound(client: Client): void {
    if (this.state.phase !== "roundEnd") return;

    if (this.state.currentRound >= this.state.totalRounds) {
      this.state.phase = "gameOver";
    } else {
      this.state.currentRound++;
      this.startRound();
    }
  }

  handleRestart(client: Client): void {
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

    this.state.phase = "waiting";
    this.state.currentRound = 1;
  }

  // ============ Bot AI Methods ============

  checkBotTurn(): void {
    const currentPlayerId = this.state.currentTurn;
    const currentPlayer = this.state.players.get(currentPlayerId);

    if (!currentPlayer || !currentPlayer.isBot) return;

    // Add delay before bot action to make it feel natural
    this.clock.setTimeout(() => {
      if (this.state.phase === "bidding") {
        this.botBid(currentPlayerId);
      } else if (this.state.phase === "playing") {
        this.botPlayCard(currentPlayerId);
      }
    }, BOT_DELAY);
  }

  botBid(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot) return;

    // Simple bidding strategy: count high cards and trump cards
    const hand = Array.from(bot.hand);
    let bid = 1; // Minimum bid

    // Count strong cards
    hand.forEach((card) => {
      if (!card) return;
      // Aces are likely to win
      if (card.value === 14) bid++;
      // Kings have good chances
      else if (card.value === 13) bid += 0.5;
      // Queens in trumps are strong
      else if (card.value === 12 && card.suit === this.state.trumpSuit)
        bid += 0.5;
      // Trump cards are valuable
      else if (card.suit === this.state.trumpSuit && card.value >= 10)
        bid += 0.3;
    });

    // Round and clamp bid
    bid = Math.max(1, Math.min(this.state.maxBid, Math.round(bid)));

    // Set bid
    bot.bid = bid;
    console.log(`${bot.name} (bot) bid ${bid}`);

    // Count how many players have bid
    const bidsPlaced = Array.from(this.state.players.values()).filter(
      (p) => p.bid > 0,
    ).length;

    if (bidsPlaced >= NUM_PLAYERS) {
      // All bids placed, start playing - first bidder starts
      const firstBidderIndex = (this.state.currentRound - 1) % NUM_PLAYERS;
      this.state.phase = "playing";
      this.state.currentTurn = this.state.playerOrder[firstBidderIndex] || "";
      this.checkBotTurn();
    } else {
      // Move to next bidder with wrap-around
      this.state.biddingPlayerIndex =
        (this.state.biddingPlayerIndex + 1) % NUM_PLAYERS;
      this.state.currentTurn =
        this.state.playerOrder[this.state.biddingPlayerIndex] || "";
      this.checkBotTurn();
    }
  }

  botPlayCard(botId: string): void {
    const bot = this.state.players.get(botId);
    if (!bot || bot.hand.length === 0) return;

    const hand = bot.hand.map((c) => ({
      id: c.id,
      suit: c.suit as any,
      rank: c.rank as any,
      value: c.value,
    }));

    const validCards = getValidCards(
      hand,
      this.state.leadSuit as any,
      Array.from(this.state.currentTrick).map((e, index) => ({
        playerIndex: index,
        card: {
          id: e!.card.id,
          suit: e!.card.suit as any,
          rank: e!.card.rank as any,
          value: e!.card.value,
        },
      })),
    );
    if (validCards.length === 0) return;

    // Bot strategy for playing cards
    let cardToPlay = this.selectBotCard(validCards, bot);

    console.log(
      `${bot.name} (bot) playing ${cardToPlay.rank} of ${cardToPlay.suit}`,
    );
    this.playCard(botId, cardToPlay.id);
  }

  selectBotCard(validCards: CardData[], bot: Player): CardData {
    const leadSuit = this.state.leadSuit;
    const trumpSuit = this.state.trumpSuit;
    const isLeading = this.state.currentTrick.length === 0;
    const isLastPlayer = this.state.currentTrick.length === NUM_PLAYERS - 1;

    // Find current winning card in trick
    let winningCard: CardData | null = null;
    if (!isLeading) {
      for (const entry of this.state.currentTrick) {
        const card = {
          id: entry.card.id,
          suit: entry.card.suit as any,
          rank: entry.card.rank as any,
          value: entry.card.value,
        };
        if (
          !winningCard ||
          this.beats(entry.card, {
            suit: winningCard.suit,
            rank: winningCard.rank,
            value: winningCard.value,
            id: winningCard.id,
          } as Card)
        ) {
          winningCard = card;
        }
      }
    }

    // Sort valid cards by value
    const sortedCards = [...validCards].sort((a, b) => a.value - b.value);
    const sortedCardsDesc = [...validCards].sort((a, b) => b.value - a.value);

    if (isLeading) {
      // When leading, play a strong non-trump card if possible
      const nonTrumpCards = sortedCardsDesc.filter((c) => c.suit !== trumpSuit);
      if (nonTrumpCards.length > 0) {
        return nonTrumpCards[0]; // Play highest non-trump
      }
      return sortedCardsDesc[0]; // Play highest card
    }

    // Following a lead
    const canWin = validCards.some((c) => {
      if (!winningCard) return true;
      return this.cardBeats(c, winningCard);
    });

    if (isLastPlayer && canWin) {
      // Last player and can win - play the lowest winning card
      const winningCards = validCards.filter(
        (c) => winningCard && this.cardBeats(c, winningCard),
      );
      return winningCards.sort((a, b) => a.value - b.value)[0];
    }

    if (canWin && bot.tricksWon < bot.bid) {
      // Need more tricks - try to win
      const winningCards = validCards.filter(
        (c) => winningCard && this.cardBeats(c, winningCard),
      );
      return winningCards.sort((a, b) => a.value - b.value)[0]; // Lowest winning card
    }

    // Can't win or don't need to - play lowest card
    return sortedCards[0];
  }

  cardBeats(card1: CardData, card2: CardData): boolean {
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
}
