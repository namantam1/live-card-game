import { Scene } from "phaser";
import { COLORS } from "../../utils/constants";
import { getFontSize } from "../../utils/uiConfig";
import Button from "../../components/Button";
import AudioManager from "../../managers/AudioManager";

const HEIGHT = 300;
const WIDTH = 300;

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
  protected audioManager: AudioManager;
  protected closeOnOverlayClick: boolean;

  constructor(
    scene: Scene,
    title: string,
    audioManager: AudioManager,
    closeOnOverlayClick: boolean = false,
    modalWidth: number = WIDTH,
    modalHeight: number = HEIGHT,
  ) {
    this.audioManager = audioManager;
    this.scene = scene;
    this.closeOnOverlayClick = closeOnOverlayClick;
    const { width, height } = scene.cameras.main;

    const halfWidth = modalWidth / 2;
    const halfHeight = modalHeight / 2;

    this.modal = scene.add.container(width / 2, height / 2);
    this.modal.setVisible(false);
    this.modal.setDepth(100);

    // Overlay - make it interactive to block clicks
    this.overlay = scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.7);
    this.overlay.fillRect(-width / 2, -height / 2, width, height);
    this.overlay.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains,
    );

    // Add overlay click handler if closeOnOverlayClick is enabled
    if (this.closeOnOverlayClick) {
      this.overlay.on("pointerdown", () => {
        this.hide();
      });
    }

    // Modal background - make it interactive to prevent click-through
    this.bg = scene.add.graphics();
    this.bg.fillStyle(COLORS.PANEL_BG, 1);
    this.bg.fillRoundedRect(
      -halfWidth,
      -halfHeight,
      modalWidth,
      modalHeight,
      20,
    );
    this.bg.lineStyle(2, COLORS.PRIMARY, 0.5);
    this.bg.strokeRoundedRect(
      -halfWidth,
      -halfHeight,
      modalWidth,
      modalHeight,
      20,
    );
    this.bg.setInteractive(
      new Phaser.Geom.Rectangle(
        -halfWidth,
        -halfHeight,
        modalWidth,
        modalHeight,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    this.bg.on(
      "pointerdown",
      (pointer: any, localX: number, localY: number, event: any) => {
        // Stop event propagation to prevent clicks from going through
        event.stopPropagation();
      },
    );

    // Title with responsive font size
    this.titleText = scene.add
      .text(0, -halfHeight + 30, title, {
        fontFamily: "Arial, sans-serif",
        fontSize: getFontSize("modalTitle", width, height),
        fontStyle: "bold",
        color: "#ffffff",
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
      fontSize: "20px",
      hoverScale: 1.05,
      pressScale: 0.95,
      playSound: true,
      audioManager: this.audioManager,
    });
  }

  destroy() {
    this.modal.destroy();
  }
}
