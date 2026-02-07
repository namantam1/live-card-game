import Phaser from 'phaser';
import { COLORS } from '../../utils/constants';
import Button from '../Button';
import Common from '../../objects/game/Common';

export interface JoinViewCallbacks {
  onJoin: () => void;
  onBack: () => void;
}

/**
 * JoinView - UI for entering a room code to join an existing room
 */
export class JoinView {
  private scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  private roomCodeInput: any; // RexUI InputText
  private joinError!: Phaser.GameObjects.Text;
  private joinBtn!: Phaser.GameObjects.Container;
  private isProcessing: boolean = false;
  private callbacks: JoinViewCallbacks;

  constructor(scene: Phaser.Scene, callbacks: JoinViewCallbacks) {
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
      .text(centerX, centerY - 120, 'Join Room', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Room code label
    const codeLabel = this.scene.add
      .text(centerX, centerY - 50, 'Enter Room Code:', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);

    // Room code input
    this.roomCodeInput = Common.createInputField(this.scene, {
      x: centerX,
      y: centerY - 10,
      width: 350,
      uppercase: true,
    });

    // Join button
    this.joinBtn = this.createButton(centerX, centerY + 70, 'Join', () => {
      if (!this.isProcessing) {
        this.callbacks.onJoin();
      }
    });

    // Back button
    const backBtn = this.createButton(
      centerX,
      centerY + 180,
      'Back',
      this.callbacks.onBack,
      0x475569
    );

    // Error message
    this.joinError = this.scene.add
      .text(centerX, height - 30, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#ef4444',
      })
      .setOrigin(0.5);

    this.container.add([
      title,
      codeLabel,
      this.joinBtn,
      backBtn,
      this.joinError,
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
    this.roomCodeInput.setVisible(visible);
  }

  getRoomCode(): string {
    return this.roomCodeInput.text.trim().toUpperCase();
  }

  setRoomCode(code: string) {
    this.roomCodeInput.setText(code.toUpperCase());
  }

  clearRoomCode() {
    this.roomCodeInput.setText('');
  }

  showError(message: string, color: string = '#ef4444') {
    this.joinError.setText(message).setColor(color);
  }

  clearError() {
    this.joinError.setText('');
  }

  setButtonsEnabled(enabled: boolean) {
    this.isProcessing = !enabled;
    // Change opacity to indicate disabled state
    const alpha = enabled ? 1 : 0.5;
    this.joinBtn.setAlpha(alpha);
    // Disable/enable button interactions
    this.joinBtn.setInteractive(enabled);
  }

  destroy() {
    if (this.roomCodeInput) {
      this.roomCodeInput.destroy();
    }
    this.container.destroy();
  }
}
