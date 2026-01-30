import Phaser from "phaser";
import { EVENTS, PHASE } from "../utils/constants";
import ScoreBoard from "../objects/game/ScoreBoard";
import BiddingUI from "../objects/game/BiddingUI";
import RoundModal from "../objects/game/RoundModal";
import GameOverModal from "../objects/game/GameOverModal";
import SettingsModal from "../objects/game/SettingsModal";
import NetworkManager from "../managers/NetworkManager";
import GameManager from "../managers/GameManager";
import AudioManager from "../managers/AudioManager";
import GameScene from "./GameScene";
import Common from "../objects/game/Common";

export default class UIScene extends Phaser.Scene {
  isMultiplayer: boolean;
  networkManager: NetworkManager | null;
  gameManager!: GameManager;
  audioManager!: AudioManager;
  gameScene!: GameScene;
  scoreBoard!: ScoreBoard;
  roundModal!: RoundModal;
  gameOverModal!: GameOverModal;
  settingsModal!: SettingsModal;
  biddingUI!: BiddingUI;

  constructor() {
    super({ key: "UIScene" });
    this.isMultiplayer = false;
    this.networkManager = null;
  }

  init(data: any) {
    this.gameManager = data.gameManager;
    this.audioManager = data.audioManager;
    this.isMultiplayer = data.isMultiplayer || false;
    this.networkManager = data.networkManager || null;
  }

  create() {
    // Get reference to game scene
    this.gameScene = this.scene.get("GameScene") as GameScene;

    this.scoreBoard = new ScoreBoard(
      this,
      this.isMultiplayer,
      this.getPlayersData(),
      this.getCurrentRound(),
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
      onNewGame: !this.isMultiplayer
        ? () => this.gameScene.restartGame()
        : null,
    });

    // Create bidding UI
    this.biddingUI = new BiddingUI(
      this,
      (bid) => this.onBidSelected(bid),
      this.audioManager,
    );

    // Listen for game events
    this.setupEventListeners();
  }

  getPlayersData() {
    if (this.isMultiplayer && this.networkManager) {
      return this.networkManager.getPlayers();
    } else if (this.gameManager) {
      return this.gameManager.getPlayers();
    }
    return [];
  }

  getCurrentRound() {
    if (this.isMultiplayer && this.networkManager) {
      const state = this.networkManager.getState();
      return state?.currentRound || 1;
    } else if (this.gameManager) {
      return this.gameManager.getCurrentRound();
    }
    return 1;
  }

  getPhase() {
    if (this.isMultiplayer && this.networkManager) {
      return this.networkManager.getPhase();
    } else if (this.gameManager) {
      return this.gameManager.getPhase();
    }
    return "waiting";
  }

  onBidSelected(bid: number) {
    if (this.isMultiplayer) {
      this.gameScene.onMultiplayerBid(bid);
    } else {
      this.gameScene.onHumanBid(bid);
    }
  }

  setupEventListeners() {
    if (this.isMultiplayer) {
      this.setupMultiplayerEventListeners();
    } else {
      this.setupSoloEventListeners();
    }

    // Common event listeners
    // Round complete
    this.gameScene.events.on("roundComplete", (data: any) => {
      this.scoreBoard.updateScoreboard(
        this.getPlayersData(),
        this.getCurrentRound(),
      );
      this.time.delayedCall(500, () => this.roundModal.showRoundResults(data));
    });

    // Game complete
    this.gameScene.events.on("gameComplete", (data: any) => {
      this.scoreBoard.updateScoreboard(
        this.getPlayersData(),
        this.getCurrentRound(),
      );
      this.time.delayedCall(500, () =>
        this.gameOverModal.showGameResults(data),
      );
    });
  }

  setupSoloEventListeners() {
    // Listen for turn changes during bidding
    this.gameManager?.on(EVENTS.TURN_CHANGED, (playerIndex: number) => {
      const phase = this.gameManager?.phase;
      if (phase === PHASE.BIDDING && playerIndex === 0) {
        // It's the human's turn to bid
        this.time.delayedCall(300, () => this.biddingUI.show());
      }
    });

    // Bid placed - no need to manually check for next bidder anymore
    // The TURN_CHANGED event will handle showing the UI
    this.gameScene.events.on("bidPlaced", ({ playerIndex }: any) => {
      // Just hide if it was the human who bid
      if (playerIndex === 0) {
        this.biddingUI.hide();
      }
    });
  }

  setupMultiplayerEventListeners() {
    // Listen for phase changes - show bidding UI when it's our turn
    this.gameScene.events.on("phaseChanged", (phase: any) => {
      this.scoreBoard.updateScoreboard(
        this.getPlayersData(),
        this.getCurrentRound(),
      );
      if (phase === "bidding") {
        // Add slight delay to ensure currentTurn state is updated
        this.time.delayedCall(100, () => {
          if (this.networkManager!.isMyTurn()) {
            this.biddingUI.show();
          }
        });
      }
    });

    // Turn change - show bidding UI if it's bidding phase and our turn
    this.networkManager!.on("turnChange", ({ isMyTurn }: any) => {
      const phase = this.networkManager!.getPhase();
      if (phase === "bidding" && isMyTurn) {
        this.time.delayedCall(300, () => this.biddingUI.show());
      }
    });

    // Score updates
    this.networkManager!.on("playerScoreChange", () => {
      this.scoreBoard.updateScoreboard(
        this.getPlayersData(),
        this.getCurrentRound(),
      );
    });

    // Bid placed
    this.networkManager!.on("playerBid", () => {
      this.scoreBoard.updateScoreboard(
        this.getPlayersData(),
        this.getCurrentRound(),
      );
    });

    // Tricks won update
    this.networkManager!.on("playerTricksWon", () => {
      this.scoreBoard.updateScoreboard(
        this.getPlayersData(),
        this.getCurrentRound(),
      );
    });
  }
}
