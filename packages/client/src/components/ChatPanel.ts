import { Scene } from 'phaser';
import type { ChatMessage } from '@call-break/shared';
import Button from './Button';

interface ChatConfig {
  position: { x: number; y: number };
  onSendMessage: (message: string) => void;
}

/**
 * A compact chat panel for multiplayer gameplay
 * Toggle-able with recent messages and color-coded by player
 */
export default class ChatPanel {
  private scene: Scene;
  private container: Phaser.GameObjects.Container;
  private messagesContainer: Phaser.GameObjects.Container;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private inputField: any = null; // RexUI CanvasInput
  private sendButton: Phaser.GameObjects.Container | null = null;
  private isVisible: boolean = false;
  private messages: ChatMessage[] = [];
  private messageDisplays: Phaser.GameObjects.Container[] = [];
  private onSendMessage: (message: string) => void;
  private containerX: number = 0;
  private containerY: number = 0;

  private readonly MAX_MESSAGES = 50;
  private readonly VISIBLE_MESSAGES = 5;
  private readonly PANEL_WIDTH = 320;
  private readonly PANEL_HEIGHT = 280;
  private readonly MESSAGE_HEIGHT = 40;

  // Seat colors for player identification
  private readonly SEAT_COLORS = [
    '#ef4444', // red
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
  ];

  constructor(scene: Scene, config: ChatConfig) {
    const {
      position: { x, y },
      onSendMessage,
    } = config;

    this.scene = scene;
    this.onSendMessage = onSendMessage;

    // Store position for DOM elements
    this.containerX = x;
    this.containerY = y;

    // Main container
    this.container = scene.add.container(x, y);
    this.container.setDepth(1000);

    // Background panel
    const bg = scene.add.graphics();
    bg.fillStyle(0x1e293b, 0.95);
    bg.fillRoundedRect(0, 0, this.PANEL_WIDTH, this.PANEL_HEIGHT, 12);
    bg.lineStyle(2, 0x475569, 1);
    bg.strokeRoundedRect(0, 0, this.PANEL_WIDTH, this.PANEL_HEIGHT, 12);

    // Title
    const title = scene.add
      .text(this.PANEL_WIDTH / 2, 16, 'Chat', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#f1f5f9',
      })
      .setOrigin(0.5, 0);

    // Messages container
    const messagesY = 45;
    this.messagesContainer = scene.add.container(10, messagesY);

    this.container.add([bg, title, this.messagesContainer]);

    // Input field (create after container for absolute positioning)
    this.createInputField();

    // Initially hidden
    this.container.setVisible(false);
    this.container.setAlpha(0);
    if (this.inputField) {
      this.inputField.setVisible(false);
      this.inputField.setAlpha(0);
    }
    if (this.sendButton) {
      this.sendButton.setVisible(false);
      this.sendButton.setAlpha(0);
    }
  }

  private createInputField(): void {
    const inputY = this.PANEL_HEIGHT - 45;
    const inputWidth = this.PANEL_WIDTH - 100;

    // Use Rex UI CanvasInput (canvas-based input)
    this.inputField = this.scene.add
      .rexCanvasInput({
        x: this.containerX + 10 + inputWidth / 2,
        y: this.containerY + inputY + 16,
        width: inputWidth,
        height: 32,
        background: {
          color: 0x334155,
          stroke: 0x475569,
          strokeThickness: 1,
          cornerRadius: 6,
          'focus.stroke': 0x6366f1,
        },
        style: {
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          color: '#f1f5f9',
        },
        text: '',
        maxLength: 200,
      })
      .setOrigin(0.5)
      .setDepth(1001);

    // Send button
    this.sendButton = Button.create(
      this.scene,
      this.containerX + this.PANEL_WIDTH - 45,
      this.containerY + inputY + 16,
      {
        width: 60,
        height: 32,
        text: 'Send',
        onClick: () => this.sendMessage(),
        fontSize: '13px',
        bgColor: 0x6366f1,
      }
    );
    this.sendButton.setDepth(1001);

    // Handle enter key
    this.inputField.on('keydown-ENTER', () => {
      this.sendMessage();
    });
  }

  private sendMessage(): void {
    if (!this.inputField) return;

    const message = (this.inputField.text || '').trim();
    if (message.length === 0) return;

    this.onSendMessage(message);
    this.inputField.setText('');
  }

  /**
   * Add a chat message to the panel
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);

    // Keep only recent messages
    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages.shift();
    }

    this.updateMessagesDisplay();
  }

  private updateMessagesDisplay(): void {
    // Clear existing displays
    this.messageDisplays.forEach((display) => display.destroy());
    this.messageDisplays = [];

    // Show last N messages
    const visibleMessages = this.messages.slice(-this.VISIBLE_MESSAGES);
    const startY = 0;

    visibleMessages.forEach((msg, index) => {
      const display = this.createMessageDisplay(
        msg,
        startY + index * this.MESSAGE_HEIGHT
      );
      this.messagesContainer.add(display);
      this.messageDisplays.push(display);
    });
  }

  private createMessageDisplay(
    message: ChatMessage,
    y: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, y);

    // Player name with color
    const seatColor =
      message.playerId === 'system'
        ? '#94a3b8'
        : this.SEAT_COLORS[message.seatIndex] || '#94a3b8';

    const playerName = this.scene.add
      .text(0, 0, `${message.playerName}:`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: seatColor,
      })
      .setOrigin(0, 0);

    // Message text
    const messageText = this.scene.add
      .text(0, 16, message.message, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#e2e8f0',
        wordWrap: { width: this.PANEL_WIDTH - 30 },
      })
      .setOrigin(0, 0);

    container.add([playerName, messageText]);

    return container;
  }

  show(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    this.container.setVisible(true);
    if (this.inputField) this.inputField.setVisible(true);
    if (this.sendButton) this.sendButton.setVisible(true);

    this.scene.tweens.add({
      targets: [this.container, this.inputField, this.sendButton],
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });

    // Focus input field
    if (this.inputField) {
      this.scene.time.delayedCall(250, () => this.inputField.open());
    }
  }

  hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.scene.tweens.add({
      targets: [this.container, this.inputField, this.sendButton],
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.container.setVisible(false);
        if (this.inputField) this.inputField.setVisible(false);
        if (this.sendButton) this.sendButton.setVisible(false);
      },
    });

    // Close input field
    if (this.inputField) {
      this.inputField.close();
    }
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  destroy(): void {
    this.messageDisplays.forEach((display) => display.destroy());
    if (this.inputField) this.inputField.destroy();
    if (this.sendButton) this.sendButton.destroy();
    this.container.destroy();
  }
}
