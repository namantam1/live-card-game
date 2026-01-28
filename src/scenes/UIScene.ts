import Phaser from "phaser";
import ScoreBoard from "../objects/game/ScoreBoard";
import BiddingUI from "../objects/game/BiddingUI";
import RoundModal from "../objects/game/RoundModal";
import GameOverModal from "../objects/game/GameOverModal";
import SettingsModal from "../objects/game/SettingsModal";
import AudioManager from "../managers/AudioManager";
import GameScene from "./GameScene";
import Common from "../objects/game/Common";
import type { IGameMode } from "../modes/IGameMode";

export default class UIScene extends Phaser.Scene {
  private gameMode!: IGameMode;
  private audioManager!: AudioManager;
  private gameScene!: GameScene;
  scoreBoard!: ScoreBoard;
  roundModal!: RoundModal;
  gameOverModal!: GameOverModal;
  settingsModal!: SettingsModal;
  biddingUI!: BiddingUI;

  constructor() {
    super({ key: "UIScene" });
  }

  init(data: any) {
    this.gameMode = data.gameMode;
    this.audioManager = data.audioManager;
  }

  create() {
    // Get reference to game scene
    this.gameScene = this.scene.get("GameScene") as GameScene;

    // Create scoreboard - unified for both modes!
    this.scoreBoard = new ScoreBoard(
      this,
      false, // We'll update this based on game mode later if needed
      this.gameMode.getPlayers(),
      this.gameMode.getCurrentRound(),
    );

    // Create modals
    this.roundModal = new RoundModal(
      this,
      () => this.gameScene.continueToNextRound(),
      this.audioManager,
    );

    this.gameOverModal = new GameOverModal(
      this,
      () => this.gameScene.restartGame(),
      () => this.gameScene.returnToMenu(),
      this.audioManager,
    );

    // Get responsive sizing from centralized config
    Common.createSettingIcon(this, {
      audioManager: this.audioManager,
      onClick: () => this.settingsModal.showSettings(),
    });

    this.settingsModal = new SettingsModal(this, {
      audioManager: this.audioManager,
      onQuit: () => this.gameScene.returnToMenu(),
      onNewGame: this.isMultiplayer() ? null : () => this.gameScene.restartGame(),
    });

    // Create bidding UI
    this.biddingUI = new BiddingUI(
      this,
      (bid) => this.gameMode.onBidSelected(bid),
      this.audioManager,
    );

    // Setup unified event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Unified event listeners - no mode conditionals!

    // Phase changed
    this.gameMode.on("phaseChanged", (phase: string) => {
      // Update scoreboard
      this.scoreBoard.updateScoreboard(
        this.gameMode.getPlayers(),
        this.gameMode.getCurrentRound(),
      );

      // Note: Don't show bidding UI here!
      // It will be shown by the turnChanged event when it's actually the player's turn
    });

    // Turn changed
    this.gameMode.on("turnChanged", ({ isMyTurn }: any) => {
      const phase = this.gameMode.getPhase();
      if (phase === "bidding" && isMyTurn) {
        this.time.delayedCall(300, () => this.biddingUI.show());
      }
    });

    // Bid placed
    this.gameMode.on("bidPlaced", ({ playerIndex }: any) => {
      // Update scoreboard
      this.scoreBoard.updateScoreboard(
        this.gameMode.getPlayers(),
        this.gameMode.getCurrentRound(),
      );

      // Hide bidding UI if it was the local player
      const players = this.gameMode.getPlayers();
      const localPlayer = players.find((p) => p.isLocal);
      if (localPlayer && (playerIndex === 0 || players[playerIndex]?.isLocal)) {
        this.biddingUI.hide();
      }
    });

    // Score updates (from multiplayer events)
    if (this.isMultiplayer()) {
      this.gameMode.on("playerScoreChange", () => {
        this.scoreBoard.updateScoreboard(
          this.gameMode.getPlayers(),
          this.gameMode.getCurrentRound(),
        );
      });

      this.gameMode.on("playerTricksWon", () => {
        this.scoreBoard.updateScoreboard(
          this.gameMode.getPlayers(),
          this.gameMode.getCurrentRound(),
        );
      });
    }

    // Round complete
    this.gameScene.events.on("roundComplete", (data: any) => {
      this.scoreBoard.updateScoreboard(
        this.gameMode.getPlayers(),
        this.gameMode.getCurrentRound(),
      );
      this.time.delayedCall(500, () => this.roundModal.showRoundResults(data));
    });

    // Game complete
    this.gameScene.events.on("gameComplete", (data: any) => {
      this.scoreBoard.updateScoreboard(
        this.gameMode.getPlayers(),
        this.gameMode.getCurrentRound(),
      );
      this.time.delayedCall(500, () =>
        this.gameOverModal.showGameResults(data),
      );
    });
  }

  private isMultiplayer(): boolean {
    // Check if any player has an id (multiplayer players have network IDs)
    const players = this.gameMode.getPlayers();
    return players.some((p) => p.id !== undefined);
  }
}
