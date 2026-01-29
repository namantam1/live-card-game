import NetworkIndicator from "../components/NetworkIndicator";
import AudioManager from "../managers/AudioManager";
import SettingsModal from "../objects/game/SettingsModal";
import type { CardData } from "../type";
import { createDeck, shuffleDeck } from "../utils/cards";
import { SUITS } from "../utils/constants";
import ScoreBoard from "../objects/game/ScoreBoard";
import Common from "../objects/game/Common";
import Player from "../objects/Player";
import TrickArea from "../objects/TrickArea";
import BootScene from "./BootScene";

const CARD: CardData = createDeck()[0];

export default class DebugScene extends Phaser.Scene {
  audioManager: AudioManager = new AudioManager(this);

  constructor() {
    super({ key: "DebugScene" });
  }

  preload() {
    BootScene.loadAssets(this);
  }

  create() {
    // set bg color to dark gray
    this.cameras.main.setBackgroundColor("#2d2d2d");
    const { width, height } = this.cameras.main;

    // set bg image if available
    // const tableBg = this.add.image(width / 2, height / 2, "table-bg");
    // const scaleFactor = Math.min(
    //   (width * 0.9) / tableBg.width,
    //   (height * 0.9) / tableBg.height,
    // );
    // tableBg.setScale(scaleFactor);

    // const card = new Card(this, 0, 0, CARD, false);
    // card.setPlayable(true);

    // Common.createTable(this);

    // new BiddingUI(
    //   this,
    //   (bid: number) => {
    //     console.log("Player bid:", bid);
    //   },
    //   this.audioManager,
    // ).show();

    // new Player(this, 0, "Alice", "😀", true, (data: CardData) =>
    //   console.log(data),
    // );

    const players = [
      { id: "player1", name: "Alice", emoji: "😀", score: 10 },
      { id: "player2", name: "Bob", emoji: "😎", score: 20 },
      { id: "player3", name: "Charlie", emoji: "🤠", score: 15 },
      { id: "player4", name: "Diana", emoji: "🧐", score: 25 },
    ];
    const scoreboard = new ScoreBoard(this, false, players, 0);
    scoreboard.updateScoreboard(players, 2);

    // const roundModal = new RoundModal(
    //   this,
    //   () => {
    //     console.log("Continue to next round");
    //   },
    //   null as any,
    // );
    // this.time.delayedCall(1000, () => {
    //   roundModal.showRoundResults({
    //     players: [
    //       { name: "Alice", tricksWon: 3, bid: 2, roundScore: 10 },
    //       { name: "Bob", tricksWon: 1, bid: 2, roundScore: -5 },
    //       { name: "Charlie", tricksWon: 2, bid: 2, roundScore: 0 },
    //       { name: "Diana", tricksWon: 4, bid: 3, roundScore: 15 },
    //     ],
    //   });
    // });

    // const gameOverModal = new GameOverModal(
    //   this,
    //   () => {
    //     console.log("Play Again clicked");
    //   },
    //   () => {
    //     console.log("Menu clicked");
    //   },
    //   null as any,
    // );
    // this.time.delayedCall(1000, () => {
    //   gameOverModal.showGameResults({
    //     winner: { name: "Bob", emoji: "😎" },
    //     players: [
    //       { name: "Alice", emoji: "😀", score: 30 },
    //       { name: "Bob", emoji: "😎", score: 50 },
    //       { name: "Charlie", emoji: "🤠", score: 40 },
    //       { name: "Diana", emoji: "🧐", score: 20 },
    //     ],
    //   });
    // });

    new NetworkIndicator(this, width - 150, 50);

    const setting = new SettingsModal(this, {
      audioManager: this.audioManager,
      onNewGame: () => {
        console.log("New Game clicked");
      },
      onQuit: () => {
        console.log("Quit clicked");
      },
    });
    // setting.showSettings();
    Common.createSettingIcon(this, {
      audioManager: this.audioManager,
      onClick: () => {
        // setting.showSettings();
        this.scene.start("GameScene");
        return console.log("Settings clicked");
      },
    });

    // card
    // new Card(this, {
    //   x: width / 2,
    //   y: height / 2,
    //   cardData: CARD,
    //   faceDown: true,
    // });
    // new Card(this, {
    //   x: width / 2 + 150,
    //   y: height / 2,
    //   cardData: CARD,
    //   faceDown: false,
    // });

    new TrickArea(this);
    const player = new Player(this, 0, "Alice", "😀", true, (data: CardData) =>
      console.log(data),
    );
    const cards = shuffleDeck(createDeck());
    player.setCards(cards.slice(0, 13), false).then(() => {
      const currentTrick = cards.slice(13, 16).map((card, i) => ({
        playerIndex: i,
        card,
      }));
      player.updatePlayableCards(SUITS[2], currentTrick);
    });
    // create other players
    for (let i = 1; i < 4; i++) {
      const otherPlayer = new Player(this, i, `Player ${i + 1}`, "🤖", false);
      otherPlayer.setCards(cards.slice(0, 13), false);
    }
  }
}
