import { Scene } from "phaser";
import {
  getFontSize,
  getResponsiveConfig,
  SETTINGS_ICON_CONFIG,
} from "../../utils/uiConfig";
import { Position } from "../../type";
import Button from "../../components/Button";
import AudioManager from "../../managers/AudioManager";
import CanvasInput from "phaser3-rex-plugins/plugins/gameobjects/dynamictext/canvasinput/CanvasInput";

export default class Common {
  static createBackground(scene: Scene): void {
    const { width, height } = scene.cameras.main;

    // Modern dark gradient background
    const graphics = scene.add.graphics();
    graphics.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a2e, 0x1a1a2e);
    // graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e);
    graphics.fillRect(0, 0, width, height);

    // Subtle grid pattern
    graphics.lineStyle(1, 0x2a2a4a, 0.1);
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      graphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      graphics.lineBetween(0, y, width, y);
    }

    // Ambient glow orbs
    graphics.fillStyle(0x6366f1, 0.08);
    graphics.fillCircle(width * 0.15, height * 0.2, 180);
    graphics.fillStyle(0x8b5cf6, 0.06);
    graphics.fillCircle(width * 0.85, height * 0.8, 220);
    graphics.fillStyle(0x06b6d4, 0.05);
    graphics.fillCircle(width * 0.5, height * 0.5, 300);

    // Create a few floating card backs
    const positions = [
      { x: width * 0.15, y: height * 0.3, delay: 0 },
      { x: width * 0.85, y: height * 0.4, delay: 500 },
      { x: width * 0.1, y: height * 0.7, delay: 1000 },
      { x: width * 0.9, y: height * 0.8, delay: 1500 },
    ];

    positions.forEach(({ x, y, delay }) => {
      const card = scene.add
        .image(x, y, "card-back")
        .setScale(0.5)
        .setAlpha(0.3);

      scene.tweens.add({
        targets: card,
        y: y - 20,
        rotation: Phaser.Math.DegToRad(Phaser.Math.Between(-15, 15)),
        duration: 2000,
        delay,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  static createTable(scene: Scene): void {
    const { width, height } = scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    const tableWidth = Math.min(width, height) * 0.8;
    const tableHeight = tableWidth * 0.55;

    const graphics = scene.add.graphics();

    // Outer glow effect
    for (let i = 4; i >= 0; i--) {
      const alpha = 0.03 * (5 - i);
      graphics.fillStyle(0x6366f1, alpha);
      graphics.fillRoundedRect(
        centerX - tableWidth / 2 - i * 8,
        centerY - tableHeight / 2 - i * 8,
        tableWidth + i * 16,
        tableHeight + i * 16,
        30 + i * 2,
      );
    }

    // Table surface - dark glass effect
    graphics.fillGradientStyle(0x1e293b, 0x1e293b, 0x0f172a, 0x0f172a);
    graphics.fillRoundedRect(
      centerX - tableWidth / 2,
      centerY - tableHeight / 2,
      tableWidth,
      tableHeight,
      25,
    );

    // Inner gradient overlay for depth
    graphics.fillStyle(0x334155, 0.3);
    graphics.fillRoundedRect(
      centerX - tableWidth / 2 + 4,
      centerY - tableHeight / 2 + 4,
      tableWidth - 8,
      tableHeight / 2,
      22,
    );

    // Neon border
    graphics.lineStyle(2, 0x6366f1, 0.8);
    graphics.strokeRoundedRect(
      centerX - tableWidth / 2,
      centerY - tableHeight / 2,
      tableWidth,
      tableHeight,
      25,
    );

    // Inner subtle border
    graphics.lineStyle(1, 0x475569, 0.4);
    graphics.strokeRoundedRect(
      centerX - tableWidth / 2 + 8,
      centerY - tableHeight / 2 + 8,
      tableWidth - 16,
      tableHeight - 16,
      20,
    );

    // Corner accents
    const accentSize = 15;
    graphics.fillStyle(0x6366f1, 0.6);
    // Top-left
    graphics.fillRoundedRect(
      centerX - tableWidth / 2 + 15,
      centerY - tableHeight / 2 + 15,
      accentSize,
      3,
      1,
    );
    graphics.fillRoundedRect(
      centerX - tableWidth / 2 + 15,
      centerY - tableHeight / 2 + 15,
      3,
      accentSize,
      1,
    );
    // Top-right
    graphics.fillRoundedRect(
      centerX + tableWidth / 2 - 15 - accentSize,
      centerY - tableHeight / 2 + 15,
      accentSize,
      3,
      1,
    );
    graphics.fillRoundedRect(
      centerX + tableWidth / 2 - 18,
      centerY - tableHeight / 2 + 15,
      3,
      accentSize,
      1,
    );
    // Bottom-left
    graphics.fillRoundedRect(
      centerX - tableWidth / 2 + 15,
      centerY + tableHeight / 2 - 18,
      accentSize,
      3,
      1,
    );
    graphics.fillRoundedRect(
      centerX - tableWidth / 2 + 15,
      centerY + tableHeight / 2 - 15 - accentSize,
      3,
      accentSize,
      1,
    );
    // Bottom-right
    graphics.fillRoundedRect(
      centerX + tableWidth / 2 - 15 - accentSize,
      centerY + tableHeight / 2 - 18,
      accentSize,
      3,
      1,
    );
    graphics.fillRoundedRect(
      centerX + tableWidth / 2 - 18,
      centerY + tableHeight / 2 - 15 - accentSize,
      3,
      accentSize,
      1,
    );
  }

  static createTrumpIndicator(scene: Scene, position?: Position): void {
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
    glow.fillRoundedRect(
      -indicatorWidth / 2,
      -indicatorHeight / 2,
      indicatorWidth,
      indicatorHeight,
      22,
    );

    // Background with glass effect
    const bg = scene.add.graphics();
    bg.fillStyle(0x1e293b, 0.95);
    bg.fillRoundedRect(
      -indicatorWidthBg / 2,
      -indicatorHeightBg / 2,
      indicatorWidthBg,
      indicatorHeightBg,
      18,
    );
    bg.lineStyle(1, 0x6366f1, 0.6);
    bg.strokeRoundedRect(
      -indicatorWidthBg / 2,
      -indicatorHeightBg / 2,
      indicatorWidthBg,
      indicatorHeightBg,
      18,
    );

    // Trump text with responsive font size (width, height already declared above)
    const trumpText = scene.add
      .text(-10, 0, "Trump", {
        fontFamily: "Arial, sans-serif",
        fontSize: getFontSize("trumpIndicator", width, height),
        fontStyle: "bold",
        color: "#94a3b8",
      })
      .setOrigin(0.5, 0.5);

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

  static createSettingIcon(
    scene: Scene,
    config: { audioManager: AudioManager; onClick: () => void },
  ): void {
    const { width, height } = scene.cameras.main;
    const iconConfig = getResponsiveConfig(SETTINGS_ICON_CONFIG, width, height);
    const { iconSize, fontSize, margin } = iconConfig;
    Button.createIconButton(scene, width - margin, margin, {
      iconSize,
      fontSize,
      icon: "\u2699",
      onClick: config.onClick,
      audioManager: config.audioManager,
    });
  }

  static createInputField(
    scene: Scene,
    config: { x: number; y: number; width: number; uppercase?: boolean },
  ) {
    const { x, y, width, uppercase = false } = config;
    // Create rexUI CanvasInput (truly canvas-based)
    const canvasInput = scene.add
      .rexCanvasInput(x, y, width, 50, {
        background: {
          color: 0x1e293b,
          stroke: 0x475569,
          strokeThickness: 2,
          cornerRadius: 8,
          "focus.stroke": 0x6366f1,
        },
        style: {
          fontSize: "18px",
          fontFamily: "Arial, sans-serif",
          color: "#ffffff",
        },
        wrap: {
          hAlign: "center",
          vAlign: "center",
        },
        text: "",
        maxLength: uppercase ? 4 : 20,
      })
      .setOrigin(0.5)
      .setDepth(100);

    // Transform to uppercase if needed
    if (uppercase) {
      canvasInput.on("textchange", (canvasInput: CanvasInput) => {
        const { text, cursorPosition } = canvasInput;
        if (!text) return;
        const upper = canvasInput.text.toUpperCase();
        if (canvasInput.text !== upper) {
          canvasInput.setText(upper);
          canvasInput.setCursorPosition(cursorPosition);
        }
      });
    }

    return canvasInput;
  }
}
