import { Scene } from 'phaser';
import { COLORS } from '../../../utils/constants';
import Button from '../../shared/Button';

const defaultConfig = {
  width: 400,
  height: 300,
  titleFontSize: '28px',
  closeOnOverlayClick: false,
  clearContentOnHide: true,
};

type ModalConfig = Partial<typeof defaultConfig> & {
  title: string;
  positionX?: number;
  positionY?: number;
};

type ModalButtonParams = {
  x: number;
  y: number;
  text: string;
  callback: () => void;
  height?: number;
  width?: number;
  bgColor?: number;
};

export default abstract class BaseModal {
  protected scene: Scene;
  protected modal: Phaser.GameObjects.Container;
  protected overlay: Phaser.GameObjects.Graphics;
  protected bg: Phaser.GameObjects.Graphics;
  protected titleText: Phaser.GameObjects.Text;
  protected content: Phaser.GameObjects.Container;
  protected config: Pick<ModalConfig, 'clearContentOnHide'>;

  constructor(scene: Scene, modalConfig: ModalConfig) {
    const { centerX, centerY, width, height } = scene.cameras.main;
    const {
      title,
      positionX = centerX,
      positionY = centerY,
      closeOnOverlayClick,
      ...config
    } = {
      ...defaultConfig,
      ...modalConfig,
    };
    this.scene = scene;
    this.config = config;

    const halfWidth = config.width / 2;
    const halfHeight = config.height / 2;

    this.modal = scene.add.container(positionX, positionY);
    this.modal.setVisible(false);
    this.modal.setDepth(100);

    // Overlay - make it interactive to block clicks
    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.7);
    this.overlay.fillRect(-centerX, -centerY, width, height);
    this.overlay.setInteractive(
      new Phaser.Geom.Rectangle(-centerX, -centerY, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    // Add overlay click handler if closeOnOverlayClick is enabled
    if (closeOnOverlayClick) {
      this.overlay.on('pointerdown', () => {
        this.hide();
      });
    }

    // Modal background - make it interactive to prevent click-through
    this.bg = scene.add.graphics();
    this.bg.fillStyle(COLORS.PANEL_BG, 1);
    this.bg.fillRoundedRect(
      -halfWidth,
      -halfHeight,
      config.width,
      config.height,
      20
    );
    this.bg.lineStyle(2, COLORS.PRIMARY, 0.5);
    this.bg.strokeRoundedRect(
      -halfWidth,
      -halfHeight,
      config.width,
      config.height,
      20
    );
    this.bg.setInteractive(
      new Phaser.Geom.Rectangle(
        -halfWidth,
        -halfHeight,
        config.width,
        config.height
      ),
      Phaser.Geom.Rectangle.Contains
    );
    this.bg.on(
      'pointerdown',
      (_pointer: unknown, _localX: number, _localY: number, event: Event) => {
        // Stop event propagation to prevent clicks from going through
        event.stopPropagation();
      }
    );

    // Title with responsive font size
    this.titleText = scene.add
      .text(0, -halfHeight + 30, title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: config.titleFontSize,
        fontStyle: 'bold',
        color: '#ffffff',
        padding: { bottom: 5 },
      })
      .setOrigin(0.5);

    // Content container
    this.content = scene.add.container(0, this.titleText.height);

    this.modal.add([this.overlay, this.bg, this.titleText, this.content]);
    this.modal.scale = 2;
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

        if (this.config.clearContentOnHide) this.clearContent();
      },
    });
  }

  protected clearContent() {
    this.content.removeAll(true);
  }

  protected createModalButton({
    x,
    y,
    text,
    callback,
    height = 44,
    width = 180,
    bgColor,
  }: ModalButtonParams) {
    return Button.create(this.scene, x, y, {
      width,
      height,
      text,
      onClick: callback,
      borderRadius: 8,
      bgColor,
      fontSize: '20px',
      hoverScale: 1.05,
      pressScale: 0.95,
    });
  }

  destroy() {
    this.clearContent();
    this.modal.destroy();
  }
}
