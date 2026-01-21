import { Scene } from "phaser";
import { getFontSize } from "../../config/uiConfig";
import { Position } from "../../type";

function createTrumpIndicator(scene: Scene, position?: Position) {
  const { width, height } = scene.cameras.main;
  const x = position?.x ?? width / 2;
  const y = position?.y ?? height / 2;

  // Container for trump indicator
  const container = scene.add.container(x, y - 80);
  const indicatorHeight = 60;
  const indicatorWidth = 150;
  const indicatorHeightBg = indicatorHeight * 0.95;
  const indicatorWidthBg = indicatorWidth * 0.95;

  // Glow effect behind
  const glow = scene.add.graphics();
  glow.fillStyle(0x6366f1, 0.15);
  glow.fillRoundedRect(- indicatorWidth / 2, - indicatorHeight / 2, indicatorWidth, indicatorHeight, 22);

  // Background with glass effect
  const bg = scene.add.graphics();
  bg.fillStyle(0x1e293b, 0.95);
  bg.fillRoundedRect(- indicatorWidthBg / 2, - indicatorHeightBg / 2, indicatorWidthBg, indicatorHeightBg, 18);
  bg.lineStyle(1, 0x6366f1, 0.6);
  bg.strokeRoundedRect(- indicatorWidthBg / 2, - indicatorHeightBg / 2, indicatorWidthBg, indicatorHeightBg, 18);

  // Trump text with responsive font size (width, height already declared above)
  const trumpText = scene.add
    .text(-10, 0, "Trump", {
      fontFamily: "Arial, sans-serif",
      fontSize: getFontSize("trumpIndicator", width, height),
      fontStyle: "bold",
      color: "#94a3b8",
    })
    .setOrigin(.5, 0.5);

  // Spade symbol with glow and responsive font size
  const spadeSymbol = scene.add
    .text(40, 0, "\u2660", {
      fontFamily: "Arial, sans-serif",
      fontSize: getFontSize("trumpSymbol", width, height),
      color: "#ffffff",
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: "#6366f1",
        blur: 8,
        fill: true,
      },
    })
    .setOrigin(0.5, 0.5);

  container.add([glow, bg, trumpText, spadeSymbol]);
}

export const gameCommon = { createTrumpIndicator };
