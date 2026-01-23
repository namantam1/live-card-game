import Phaser from "phaser";
import { COLORS, ANIMATION } from "../utils/constants";
import { getFontSize } from "../utils/uiConfig";
import Button from "../components/Button";
import Common from "../objects/game/Common";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
  }

  create() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background gradient effect
    Common.createBackground(this);

    // Title with spade icon
    this.createTitle(centerX, centerY - 100);

    // Subtitle with responsive font size
    this.add
      .text(centerX, centerY - 20, "A classic trick-taking card game", {
        fontFamily: "Arial, sans-serif",
        fontSize: getFontSize("menuSubtitle", width, height),
        color: "#94a3b8",
      })
      .setOrigin(0.5);

    // Solo Play button
    this.createButton(centerX, centerY + 50, "Solo Play (vs Bots)", () =>
      this.moveToScreen("GameScene"),
    );

    // Multiplayer button
    this.createButton(
      centerX,
      centerY + 150,
      "Multiplayer",
      () => this.moveToScreen("LobbyScene"),
      0x8b5cf6,
    );
  }

  moveToScreen(screenKey: string) {
    this.sound.stopAll();
    this.cameras.main.fadeOut(ANIMATION.SCENE_TRANSITION);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start(screenKey);
    });
  }

  createTitle(x: number, y: number) {
    const { width, height } = this.cameras.main;

    // Spade icon (using text emoji for simplicity) with responsive font size
    const iconSize = getFontSize("menuSpadeIcon", width, height);
    const spadeIcon = this.add
      .text(x, y - parseInt(iconSize) * 0.9, "\u2660", {
        fontFamily: "Arial, sans-serif",
        fontSize: iconSize,
        color: "#818cf8",
      })
      .setOrigin(0.5);

    // Animate spade
    this.tweens.add({
      targets: spadeIcon,
      rotation: Phaser.Math.DegToRad(10),
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Title text with responsive font size
    this.add
      .text(x, y, "Call Break", {
        fontFamily: "Arial, sans-serif",
        fontSize: getFontSize("menuTitle", width, height),
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    bgColor: number = COLORS.PRIMARY,
  ) {
    const { width, height } = this.cameras.main;

    return Button.create(this, x, y, {
      width: 350,
      height: 80,
      text,
      onClick: callback,
      bgColor,
      borderRadius: 12,
      fontSize: getFontSize("menuButton", width, height),
      hoverScale: 1.05,
      pressScale: 0.95,
    });
  }
}
