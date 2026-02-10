import Phaser from 'phaser';
import { COLORS } from '../../utils/constants';
import Button from '../shared/Button';
import { getFontSize } from '../../utils/uiConfig';
import { createInputField } from '../../helpers/ui/input';

export interface MenuViewCallbacks {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onBackToMenu: () => void;
}

/**
 * MenuView - Main lobby menu where players enter their name and choose to create or join a room
 */
export class MenuView {
  private scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  private nameInput: any; // RexUI InputText
  private connectionStatus!: Phaser.GameObjects.Text;
  private createRoomBtn!: Phaser.GameObjects.Container;
  private joinRoomBtn!: Phaser.GameObjects.Container;
  private isProcessing: boolean = false;
  private callbacks: MenuViewCallbacks;

  constructor(scene: Phaser.Scene, callbacks: MenuViewCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.container = this.scene.add.container(0, 0);
    this.createUI();
  }

  private createUI() {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Title
    const title = this.scene.add
      .text(centerX, centerY - 200, 'Call Break', {
        fontFamily: 'Arial, sans-serif',
        fontSize: getFontSize('lobbyTitle', width, height),
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const subtitle = this.scene.add
      .text(centerX, centerY - 130, 'Multiplayer', {
        fontFamily: 'Arial, sans-serif',
        fontSize: getFontSize('lobbySubtitle', width, height),
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // Name input label
    const nameLabel = this.scene.add
      .text(centerX, centerY - 70, 'Enter your name:', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    // Name input field
    this.nameInput = createInputField(this.scene, {
      x: centerX,
      y: centerY - 30,
      width: 350,
    });

    // Create Room button
    this.createRoomBtn = this.createButton(
      centerX,
      centerY + 50,
      'Create Room',
      () => {
        if (!this.isProcessing) {
          this.callbacks.onCreateRoom();
        }
      }
    );

    // Join Room button
    this.joinRoomBtn = this.createButton(
      centerX,
      centerY + 150,
      'Join Room',
      () => {
        if (!this.isProcessing) {
          this.callbacks.onJoinRoom();
        }
      }
    );

    // Back to Menu button
    const backBtn = this.createButton(
      centerX,
      centerY + 250,
      'Back to Menu',
      this.callbacks.onBackToMenu,
      0x475569
    );

    // Connection status
    this.connectionStatus = this.scene.add
      .text(centerX, height - 30, 'Connecting...', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#f59e0b',
      })
      .setOrigin(0.5);

    this.container.add([
      title,
      subtitle,
      nameLabel,
      this.createRoomBtn,
      this.joinRoomBtn,
      backBtn,
      this.connectionStatus,
    ]);
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    bgColor: number = COLORS.PRIMARY
  ) {
    return Button.create(this.scene, x, y, {
      width: 350,
      height: 80,
      text,
      onClick: callback,
      bgColor,
      borderRadius: 10,
      fontSize: '30px',
      hoverScale: 1.05,
      pressScale: 0.95,
    });
  }

  // Public API
  show() {
    this.setVisible(true);
  }

  hide() {
    this.setVisible(false);
  }

  setVisible(visible: boolean) {
    this.container.setVisible(visible);
    this.nameInput.setVisible(visible);
  }

  getPlayerName(): string {
    return this.nameInput.text.trim();
  }

  setPlayerName(name: string) {
    this.nameInput.setText(name);
  }

  setConnectionStatus(message: string, color: string = '#f59e0b') {
    this.connectionStatus.setText(message).setColor(color);
  }

  setButtonsEnabled(enabled: boolean) {
    this.isProcessing = !enabled;
    // Change opacity to indicate disabled state
    const alpha = enabled ? 1 : 0.5;
    this.createRoomBtn.setAlpha(alpha);
    this.joinRoomBtn.setAlpha(alpha);
    // Disable/enable button interactions
    this.createRoomBtn.setInteractive(enabled);
    this.joinRoomBtn.setInteractive(enabled);
  }

  destroy() {
    if (this.nameInput) {
      this.nameInput.destroy();
    }
    this.container.destroy();
  }
}
