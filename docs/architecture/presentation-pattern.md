PlayerPresenter Pattern

```ts
// src/presentation/PlayerPresenter.ts
/**
 * Handles ALL visual presentation for a player
 * Separates game logic (Player) from presentation
 */
export class PlayerPresenter {
  private scene: Scene;
  private player: Player;

  // Visual elements
  private nameLabel: Phaser.GameObjects.Text;
  private statsLabel: Phaser.GameObjects.Text;
  private turnIndicator: Phaser.GameObjects.Graphics;
  private labelBackground: Phaser.GameObjects.Graphics;

  constructor(scene: Scene, player: Player) {
    this.scene = scene;
    this.player = player;
    this.createVisuals();
  }

  private createVisuals(): void {
    // Create all visual elements
    // (move from Player.createLabel)
  }

  // Presentation methods
  showReaction(type: string): void {
    const position = this.getPlayerPosition();
    ReactionAnimation.show(
      this.scene,
      position.x,
      position.y - 50,
      type,
      this.player.name
    );
  }

  showTurnIndicator(): void {
    // Visual logic
  }

  hideTurnIndicator(): void {
    // Visual logic
  }

  updateStats(): void {
    // Update visual stats display
  }

  private getPlayerPosition(): { x: number; y: number } {
    const { width, height } = this.scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[this.player.position];
    return {
      x: width * posConfig.x,
      y: height * posConfig.y,
    };
  }

  destroy(): void {
    // Cleanup visuals
  }
}

// src/objects/Player.ts (SIMPLIFIED - pure game entity)
export default class Player {
  scene: Scene;
  index: number;
  name: string;
  emoji: string;
  position: Position;

  // ONLY game state
  bid: number = 0;
  tricksWon: number = 0;
  score: number = 0;
  roundScore: number = 0;
  networkId: string | null = null;

  hand: Hand;

  constructor(scene: Scene, index: number, name: string, emoji: string) {
    this.scene = scene;
    this.index = index;
    this.name = name;
    this.emoji = emoji;
    this.position = ['bottom', 'left', 'top', 'right'][index];
    this.hand = new Hand(scene, { position: this.position });

    // NO visual creation here
  }

  // ONLY game logic methods
  setBid(bid: number): void {
    this.bid = bid;
  }

  addTrick(): void {
    this.tricksWon++;
  }

  setCards(cards: CardData[]): void {
    return this.hand.setCards(cards);
  }

  // NO showReaction, showTurnIndicator, etc.
}

// src/scenes/UIScene.ts
export default class UIScene extends Phaser.Scene {
  private playerPresenters: PlayerPresenter[] = [];

  create() {
    // Create presenters for each player
    const players = this.gameScene.players;
    this.playerPresenters = players.map(
      (player) => new PlayerPresenter(this, player)
    );

    this.setupReactionListener();
  }

  private setupReactionListener(): void {
    this.gameMode.on(EVENTS.REACTION, (data: ReactionData) => {
      // Find presenter for the player
      const presenter = this.findPresenterForPlayer(
        data.playerId,
        data.seatIndex
      );

      if (presenter) {
        presenter.showReaction(data.type); // ← Presenter handles visual
      }
    });

    this.gameMode.on(EVENTS.TURN_CHANGED, (data: TurnData) => {
      this.playerPresenters.forEach((presenter, i) => {
        if (i === data.playerIndex) {
          presenter.showTurnIndicator();
        } else {
          presenter.hideTurnIndicator();
        }
      });
    });
  }

  private findPresenterForPlayer(
    playerId: string,
    seatIndex: number
  ): PlayerPresenter | null {
    const players = this.gameScene.players;
    const playerIndex = players.findIndex((p) => {
      if (p.networkId) return p.networkId === playerId;
      return p.absoluteSeatIndex === seatIndex;
    });

    return playerIndex >= 0 ? this.playerPresenters[playerIndex] : null;
  }
}

// src/scenes/GameScene.ts
export default class GameScene extends Phaser.Scene {
  players: Player[]; // Still create Player objects

  setupEventListeners() {
    // GameScene only handles game logic events, NOT presentation
    this.gameMode.on(EVENTS.TRICK_COMPLETE, ({ winnerIndex }) => {
      // Game logic only (no animations)
      this.players[winnerIndex].addTrick();
    });

    // NO turn indicator logic here - that's presentation (UIScene)
  }
}
```

---

Summary

PlayerPresenter Pattern:

- Player = Pure game data + logic (bid, score, cards)
- PlayerPresenter = All visuals (labels, indicators, animations)
- UIScene = Creates presenters, handles all presentation events
- GameScene = Only game logic events

Trade-offs:

- ✅ Perfect separation of concerns
- ✅ Player is now testable without rendering
- ❌ More boilerplate
- ❌ Need to manage presenters separately
