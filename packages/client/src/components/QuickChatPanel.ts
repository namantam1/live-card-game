import { Scene } from 'phaser';
import Button from './Button';

interface QuickChatConfig {
  position: { x: number; y: number };
  onSendMessage: (message: string) => void;
}

const CONFIG = {
  TITLE_FONT_SIZE: '22px',
  FONT_SIZE: '20px',
};

/**
 * Quick chat panel with predefined messages and custom input option
 */
export default class QuickChatPanel {
  private scene: Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private onSendMessage: (message: string) => void;

  // Predefined quick messages
  private readonly QUICK_MESSAGES = [
    'Nice move! 👍',
    'Well played! 👏',
    'Thinking... 🤔',
    'Close one! 😅',
    "Let's go! 🔥",
    'Oops! 😬',
  ];

  private readonly PANEL_WIDTH = 300;
  private readonly BUTTON_HEIGHT = 50;
  private readonly BUTTON_SPACING = 10;

  constructor(scene: Scene, config: QuickChatConfig) {
    const {
      position: { x, y },
      onSendMessage,
    } = config;

    this.scene = scene;
    this.onSendMessage = onSendMessage;

    // Main container
    this.container = scene.add.container(x, y);
    this.container.setDepth(1500);

    this.createPanel();

    // Initially hidden
    this.container.setVisible(false);
    this.container.setAlpha(0);
  }

  private createPanel(): void {
    const buttonCount = this.QUICK_MESSAGES.length + 1; // +1 for custom button
    const panelHeight =
      buttonCount * this.BUTTON_HEIGHT +
      (buttonCount + 1) * this.BUTTON_SPACING +
      40;

    // Background panel
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1e293b, 0.98);
    bg.fillRoundedRect(0, 0, this.PANEL_WIDTH, panelHeight, 12);
    bg.lineStyle(2, 0x6366f1, 0.8);
    bg.strokeRoundedRect(0, 0, this.PANEL_WIDTH, panelHeight, 12);

    // Title
    const title = this.scene.add
      .text(this.PANEL_WIDTH / 2, 16, 'Quick Chat', {
        fontFamily: 'Arial, sans-serif',
        fontSize: CONFIG.TITLE_FONT_SIZE,
        fontStyle: 'bold',
        color: '#f1f5f9',
      })
      .setOrigin(0.5, 0);

    this.container.add([bg, title]);

    // Create quick message buttons
    let yOffset = 70;
    this.QUICK_MESSAGES.forEach((message) => {
      const button = this.createMessageButton(message, yOffset);
      this.container.add(button);
      yOffset += this.BUTTON_HEIGHT + this.BUTTON_SPACING;
    });

    // Custom message button
    const customButton = this.createCustomButton(yOffset);
    this.container.add(customButton);
  }

  private createMessageButton(
    message: string,
    y: number
  ): Phaser.GameObjects.Container {
    const button = Button.create(this.scene, this.PANEL_WIDTH / 2, y, {
      width: this.PANEL_WIDTH - 20,
      height: this.BUTTON_HEIGHT,
      text: message,
      onClick: () => {
        this.onSendMessage(message);
        this.hide();
      },
      fontSize: CONFIG.FONT_SIZE,
      bgColor: 0x334155,
    });

    return button;
  }

  private createCustomButton(y: number): Phaser.GameObjects.Container {
    const button = Button.create(this.scene, this.PANEL_WIDTH / 2, y, {
      width: this.PANEL_WIDTH - 20,
      height: this.BUTTON_HEIGHT,
      text: 'Custom Message... ✏️',
      onClick: () => {
        this.hide();
        this.showCustomInput();
      },
      fontSize: CONFIG.FONT_SIZE,
      bgColor: 0x6366f1,
    });

    return button;
  }

  private showCustomInput(): void {
    const { width, height } = this.scene.cameras.main;

    // Create overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1800);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    // Create input panel
    const panelWidth = 400;
    const panelHeight = 180;
    const panelX = width / 2 - panelWidth / 2;
    const panelY = height / 2 - panelHeight / 2;

    const inputPanel = this.scene.add.graphics();
    inputPanel.fillStyle(0x1e293b, 1);
    inputPanel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
    inputPanel.lineStyle(2, 0x6366f1, 1);
    inputPanel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
    inputPanel.setDepth(1801);

    // Title
    const title = this.scene.add
      .text(width / 2, panelY + 20, 'Send Custom Message', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f1f5f9',
      })
      .setOrigin(0.5, 0)
      .setDepth(1801);

    // Input field
    const inputField = this.scene.add
      .rexCanvasInput({
        x: width / 2,
        y: panelY + 70,
        width: panelWidth - 40,
        height: 40,
        background: {
          color: 0x334155,
          stroke: 0x475569,
          strokeThickness: 2,
          cornerRadius: 6,
          'focus.stroke': 0x6366f1,
        },
        style: {
          fontSize: CONFIG.FONT_SIZE,
          fontFamily: 'Arial, sans-serif',
          color: '#f1f5f9',
        },
        text: '',
        maxLength: 100,
      })
      .setOrigin(0.5)
      .setDepth(1801);

    // Buttons
    const sendBtn = Button.create(this.scene, width / 2 - 60, panelY + 130, {
      width: 100,
      height: 36,
      text: 'Send',
      onClick: () => {
        const message = (inputField.text || '').trim();
        if (message.length > 0) {
          this.onSendMessage(message);
          cleanup();
        }
      },
      fontSize: CONFIG.FONT_SIZE,
      bgColor: 0x22c55e,
    });
    sendBtn.setDepth(1801);

    const cancelBtn = Button.create(this.scene, width / 2 + 60, panelY + 130, {
      width: 100,
      height: 36,
      text: 'Cancel',
      onClick: () => cleanup(),
      fontSize: CONFIG.FONT_SIZE,
      bgColor: 0x475569,
    });
    cancelBtn.setDepth(1801);

    // Cleanup function
    const cleanup = () => {
      overlay.destroy();
      inputPanel.destroy();
      title.destroy();
      inputField.destroy();
      sendBtn.destroy();
      cancelBtn.destroy();
    };

    // Click overlay to close
    overlay.on('pointerdown', cleanup);

    // Focus input
    this.scene.time.delayedCall(100, () => inputField.open());

    // Enter key to send
    inputField.on('keydown-ENTER', () => {
      const message = (inputField.text || '').trim();
      if (message.length > 0) {
        this.onSendMessage(message);
        cleanup();
      }
    });
  }

  show(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    this.container.setVisible(true);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });
  }

  hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
      },
    });
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}
