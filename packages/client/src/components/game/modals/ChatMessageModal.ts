import Button from '../../shared/Button';
import BaseModal from './BaseModal';

const CONFIG = {
  WIDTH: 400,
  HEIGHT: 160,
  FONT_SIZE: '18px',
};

export class ChatMessageModalData extends BaseModal {
  onSendMessage: (msg: string) => void;
  constructor(
    scene: Phaser.Scene,
    { onSendMessage }: { onSendMessage: (msg: string) => void }
  ) {
    const { centerY } = scene.cameras.main;
    super(scene, {
      title: 'Custom message',
      closeOnOverlayClick: true,
      width: CONFIG.WIDTH,
      height: CONFIG.HEIGHT,
      positionY: centerY - 150,
    });
    this.onSendMessage = onSendMessage;
  }

  override show(): void {
    this.createContent();
    super.show();
  }

  private createContent(): void {
    const startY = -CONFIG.HEIGHT / 2 - 10;
    // Input field
    const inputField = this.scene.add
      .rexCanvasInput({
        x: 0,
        y: startY + 50,
        width: CONFIG.WIDTH - 40,
        height: 40,
        padding: { left: 10, right: 10 },
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
      .setOrigin(0.5);

    // Buttons
    const buttonWidth = CONFIG.WIDTH / 2 - 30;
    const buttonHeight = 40;

    const sendBtn = Button.create(
      this.scene,
      -buttonWidth / 2 - 10,
      startY + 100,
      {
        width: buttonWidth,
        height: buttonHeight,
        text: 'Send',
        onClick: () => {
          const message = (inputField.text || '').trim();
          if (message.length > 0) {
            this.onSendMessage(message);
            this.hide();
          }
        },
        fontSize: CONFIG.FONT_SIZE,
        bgColor: 0x22c55e,
      }
    );

    const cancelBtn = Button.create(
      this.scene,
      buttonWidth / 2 + 10,
      startY + 100,
      {
        width: buttonWidth,
        height: buttonHeight,
        text: 'Cancel',
        onClick: () => this.hide(),
        fontSize: CONFIG.FONT_SIZE,
        bgColor: 0x475569,
      }
    );

    // Focus input
    this.scene.time.delayedCall(100, () => inputField.open());

    // Enter key to send
    inputField.on('keydown-ENTER', () => {
      const message = (inputField.text || '').trim();
      if (message.length > 0) {
        this.onSendMessage(message);
        this.hide();
      }
    });

    this.content.add([inputField, sendBtn, cancelBtn]);
  }
}
