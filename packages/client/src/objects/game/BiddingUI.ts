import { Scene } from "phaser";
import { COLORS, MAX_BID } from "../../utils/constants";
import { BIDDING_CONFIG, getResponsiveConfig } from "../../utils/uiConfig";
import Button from "../../components/Button";
import AudioManager from "../../managers/AudioManager";

export default class BiddingUI {
  private scene: Scene;
  private container: Phaser.GameObjects.Container;
  private bidButtons: Phaser.GameObjects.Container[];

  constructor(
    scene: Scene,
    onBidSelected: (bid: number) => void,
    audioManager: AudioManager,
  ) {
    this.scene = scene;
    const { width, height } = scene.cameras.main;

    // Get responsive bidding config
    const config = getResponsiveConfig(BIDDING_CONFIG, width, height);

    // Bidding container (hidden by default) - positioned higher to avoid cards
    this.container = scene.add.container(width / 2, height * 0.55);
    this.container.setVisible(false);
    this.container.setDepth(50);

    // Calculate dimensions based on button config
    const totalButtonWidth =
      MAX_BID * config.buttonWidth + (MAX_BID - 1) * config.buttonSpacing;
    const padding = 20; // Horizontal padding
    const bgWidth = totalButtonWidth + padding * 2;
    const bgHeight = 220;

    // Background - centered
    const bg = scene.add.graphics();
    bg.fillStyle(COLORS.PANEL_BG, 0.95);
    bg.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 15);
    bg.lineStyle(2, COLORS.PRIMARY, 0.5);
    bg.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 15);

    // Title - centered horizontally
    const title = scene.add
      .text(0, -100, "Place Your Bid", {
        fontFamily: "Arial, sans-serif",
        fontSize: config.titleFontSize,
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.container.add([bg, title]);

    // Bid buttons (1 to MAX_BID) with responsive sizing - centered horizontally
    this.bidButtons = [];
    const startX = -totalButtonWidth / 2 + config.buttonWidth / 2;

    for (let i = 1; i <= MAX_BID; i++) {
      const x = startX + (i - 1) * (config.buttonWidth + config.buttonSpacing);

      const button = Button.create(scene, x, 10, {
        width: config.buttonWidth,
        height: config.buttonHeight,
        text: `${i}`,
        onClick: () => {
          this.hide();
          onBidSelected(i);
        },
        bgColor: COLORS.PRIMARY,
        borderRadius: config.borderRadius,
        fontSize: config.fontSize,
        audioManager: audioManager,
      });

      this.container.add(button);
      this.bidButtons.push(button);
    }
  }

  /**
   * Shows the bidding UI with animation
   */
  show(): void {
    // Cancel any ongoing tweens to prevent race conditions
    this.scene.tweens.killTweensOf(this.container);

    this.container.setVisible(true);
    this.container.alpha = 0;
    this.container.y = this.scene.cameras.main.height * 0.4;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      y: this.scene.cameras.main.height * 0.5,
      duration: 300,
      ease: "Back.easeOut",
    });
  }

  /**
   * Hides the bidding UI with animation
   */
  hide(): void {
    // Cancel any ongoing tweens to prevent race conditions
    this.scene.tweens.killTweensOf(this.container);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.container.setVisible(false);
      },
    });
  }

  /**
   * Gets the container for manual manipulation if needed
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Destroys the bidding UI and cleans up resources
   */
  destroy(): void {
    this.container.destroy();
  }
}
