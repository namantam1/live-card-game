import { Scene } from 'phaser';
import { COLORS } from '../../utils/constants';
import { getFontSize } from '../../config/uiConfig';
import Button from '../../utils/Button';
import AudioManager from '../../managers/AudioManager';

export default abstract class BaseModal {
  protected scene: Scene;
  protected modal: Phaser.GameObjects.Container;
  protected overlay: Phaser.GameObjects.Graphics;
  protected bg: Phaser.GameObjects.Graphics;
  protected titleText: Phaser.GameObjects.Text;
  protected content: Phaser.GameObjects.Container;
  protected audioManager: AudioManager;

  constructor(scene: Scene, title: string, audioManager: AudioManager) {
    this.audioManager = audioManager;
    this.scene = scene;
    const { width, height } = scene.cameras.main;

    this.modal = scene.add.container(width / 2, height / 2);
    this.modal.setVisible(false);
    this.modal.setDepth(100);

    // Overlay
    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.7);
    this.overlay.fillRect(-width / 2, -height / 2, width, height);

    // Modal background
    this.bg = scene.add.graphics();
    this.bg.fillStyle(COLORS.PANEL_BG, 1);
    this.bg.fillRoundedRect(-200, -150, 400, 300, 20);
    this.bg.lineStyle(2, COLORS.PRIMARY, 0.5);
    this.bg.strokeRoundedRect(-200, -150, 400, 300, 20);

    // Title with responsive font size
    this.titleText = scene.add.text(0, -120, title, {
      fontFamily: 'Arial, sans-serif',
      fontSize: getFontSize('modalTitle', width, height),
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Content container
    this.content = scene.add.container(0, 0);

    this.modal.add([this.overlay, this.bg, this.titleText, this.content]);
  }

  protected show() {
    this.modal.setVisible(true);
    this.modal.alpha = 0;
    this.scene.tweens.add({
      targets: this.modal,
      alpha: 1,
      duration: 300,
    });
  }

  protected hide() {
    this.scene.tweens.add({
      targets: this.modal,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.modal.setVisible(false);
      },
    });
  }

  protected clearContent() {
    this.content.removeAll(true);
  }

  protected createModalButton(x: number, y: number, text: string, callback: () => void) {
    return Button.createGradient(this.scene, x, y, {
      width: 120,
      height: 36,
      text,
      onClick: callback,
      primaryColor: COLORS.PRIMARY,
      secondaryColor: COLORS.SECONDARY,
      borderRadius: 8,
      fontSize: '14px',
      hoverScale: 1.05,
      pressScale: 0.95,
      playSound: true,
      audioManager: this.audioManager
    });
  }

  destroy() {
    this.modal.destroy();
  }
}
