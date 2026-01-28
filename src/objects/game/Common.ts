import { Scene } from "phaser";
import {
  getResponsiveConfig,
  SETTINGS_ICON_CONFIG,
} from "../../utils/uiConfig";
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

    // use image asset for table background if available
    const tableBg = scene.add.image(centerX, centerY, "table-bg");
    const scaleFactor = Math.min(
      (width * 0.85) / tableBg.width,
      (height * 0.85) / tableBg.height,
    );
    tableBg.setScale(scaleFactor);

    // add a custom trump icon in the middle of table with custom color
    scene.add
      .text(centerX, centerY - 20, "\u2660", {
        fontFamily: "Arial, sans-serif",
        fontSize: 200,
        color: "#6c91b8",
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color: "#3d3d46",
          blur: 10,
          fill: true,
        },
      })
      .setOrigin(0.5);
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
