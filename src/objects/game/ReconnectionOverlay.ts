import Phaser from 'phaser';

export class ReconnectionOverlay {
  private scene: Phaser.Scene;
  private overlay: Phaser.GameObjects.Container;
  private spinner: Phaser.GameObjects.Graphics;
  private reconnectingText: Phaser.GameObjects.Text;
  private attemptText: Phaser.GameObjects.Text;
  private spinnerTween: Phaser.Tweens.Tween | null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.spinnerTween = null;

    const { width, height } = scene.cameras.main;

    this.overlay = scene.add.container(width / 2, height / 2);
    this.overlay.setVisible(false);
    this.overlay.setDepth(500);

    // Semi-transparent background
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(-width / 2, -height / 2, width, height);

    // Message panel
    const panelWidth = 300;
    const panelHeight = 150;

    const panel = scene.add.graphics();
    panel.fillStyle(0x1e293b, 0.95);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 12);
    panel.lineStyle(2, 0xf59e0b, 0.6);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 12);

    // Reconnection icon (spinning circle)
    this.spinner = scene.add.graphics();
    this.spinner.lineStyle(4, 0xf59e0b, 1);
    this.spinner.beginPath();
    this.spinner.arc(0, -20, 20, 0, Math.PI * 1.5, false);
    this.spinner.strokePath();

    // Reconnection text
    this.reconnectingText = scene.add.text(0, 30, 'Connection lost\nReconnecting...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#f59e0b',
      align: 'center'
    }).setOrigin(0.5);

    // Attempt counter
    this.attemptText = scene.add.text(0, 65, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color: '#94a3b8',
      align: 'center'
    }).setOrigin(0.5);

    this.overlay.add([bg, panel, this.spinner, this.reconnectingText, this.attemptText]);
  }

  show(attempt: number = 1): void {
    this.overlay.setVisible(true);
    this.attemptText.setText(`Attempt ${attempt} of 3`);

    // Start spinner animation
    if (!this.spinnerTween) {
      this.spinnerTween = this.scene.tweens.add({
        targets: this.spinner,
        angle: 360,
        duration: 1000,
        repeat: -1
      });
    }
  }

  hide(): void {
    this.overlay.setVisible(false);

    if (this.spinnerTween) {
      this.spinnerTween.stop();
      this.spinnerTween = null;
      this.spinner.angle = 0;
    }
  }

  destroy(): void {
    if (this.spinnerTween) {
      this.spinnerTween.stop();
      this.spinnerTween = null;
    }
    this.overlay.destroy();
  }
}
