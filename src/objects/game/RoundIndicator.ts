import { getFontSize } from "../../config/uiConfig";
import GameManager from "../../managers/GameManager";
import NetworkManager from "../../managers/NetworkManager";
import { TOTAL_ROUNDS } from "../../utils/constants";

export class RoundIndicator {
  roundText: Phaser.GameObjects.Text;
  isMultiplayer: boolean;
  networkManager: NetworkManager;
  gameManager: GameManager;

  constructor(
    scene: Phaser.Scene,
    isMultiplayer: boolean,
    networkManager: NetworkManager,
    gameManager: GameManager,
  ) {
    this.isMultiplayer = isMultiplayer;
    this.networkManager = networkManager;
    this.gameManager = gameManager;

    const { width, height } = scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    const roundContainer = scene.add.container(centerX, centerY + 75);

    const roundBg = scene.add.graphics();
    roundBg.fillStyle(0x1e293b, 0.8);
    roundBg.fillRoundedRect(-45, -12, 90, 24, 12);
    roundBg.lineStyle(1, 0x475569, 0.4);
    roundBg.strokeRoundedRect(-45, -12, 90, 24, 12);

    this.roundText = scene.add
      .text(0, 0, "", {
        fontFamily: "Arial, sans-serif",
        fontSize: getFontSize("roundIndicator", width, height),
        fontStyle: "bold",
        color: "#94a3b8",
      })
      .setOrigin(0.5);

    roundContainer.add([roundBg, this.roundText]);

    this.updateRoundText();
  }

  updateRoundText() {
    let round;
    if (this.isMultiplayer && this.networkManager) {
      const state = this.networkManager.getState();
      round = state?.currentRound || 1;
    } else if (this.gameManager) {
      round = this.gameManager.getCurrentRound();
    } else {
      round = 1;
    }
    this.roundText.setText(`Round ${round}/${TOTAL_ROUNDS}`);
  }
}
