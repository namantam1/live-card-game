import Phaser from 'phaser';
import Button from './Button';
import { Timer } from './Timer';

export interface InviteModalCallbacks {
  onAccept: () => void;
  onDecline: () => void;
  onTimeout: () => void;
}

export interface InviteModalOptions {
  inviterName: string;
  roomCode: string;
  timeoutSeconds: number;
  callbacks: InviteModalCallbacks;
}

const CONFIG = {
  modal: { width: 350, height: 150, padding: 24, borderRadius: 20 },
  colors: {
    bg: { top: 0x1e293b, bottom: 0x0f172a },
    accent: 0x818cf8,
    success: 0x22c55e,
    danger: 0xf43f5e,
    text: '#f1f5f9',
  },
  animation: { duration: 400, backdropFade: 200 },
} as const;

export class InviteModal {
  private scene: Phaser.Scene;
  private callbacks?: InviteModalCallbacks;
  private container?: Phaser.GameObjects.Container;
  private backdrop?: Phaser.GameObjects.Rectangle;
  private dynamicContent: Phaser.GameObjects.GameObject[] = [];
  private totalSeconds = 0;
  private isActive = false;
  private timer?: Timer;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private isValid(): boolean {
    return this.scene?.sys?.isActive() && !!this.scene.cameras?.main;
  }

  public show(options: InviteModalOptions): void {
    if (!this.isValid()) return;
    if (this.isActive) this.hide();

    this.callbacks = options.callbacks;
    this.totalSeconds = options.timeoutSeconds;
    this.isActive = true;

    this.createModal(options.inviterName, options.roomCode);
    this.animateIn();
    this.timer?.start();
  }

  private createModal(inviterName: string, roomCode: string): void {
    const { width, height } = this.scene.cameras.main;
    const { modal, colors } = CONFIG;

    // Subtle backdrop (optional for notifications)
    this.backdrop = this.scene.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.3)
      .setOrigin(0.5)
      .setDepth(9998)
      .setInteractive()
      .setAlpha(0);

    // Container positioned off-screen to the right
    const startY = height - modal.height / 2 - modal.padding;

    this.container = this.scene.add
      .container(width + modal.width, startY)
      .setDepth(9999)
      .setAlpha(1);

    // Shadow layer
    const shadow = this.scene.add
      .graphics()
      .fillStyle(0x000000, 0.3)
      .fillRoundedRect(
        -modal.width / 2 + 4,
        -modal.height / 2 + 8,
        modal.width,
        modal.height,
        modal.borderRadius
      );

    // Main background with gradient
    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(
      colors.bg.top,
      colors.bg.top,
      colors.bg.bottom,
      colors.bg.bottom,
      1,
      1,
      0.98,
      0.98
    );
    bg.fillRoundedRect(
      -modal.width / 2,
      -modal.height / 2,
      modal.width,
      modal.height,
      modal.borderRadius
    );

    // Border glow
    bg.lineStyle(3, colors.accent, 0.4);
    bg.strokeRoundedRect(
      -modal.width / 2,
      -modal.height / 2,
      modal.width,
      modal.height,
      modal.borderRadius
    );

    // Message
    const message = this.scene.add
      .text(0, -30, `${inviterName} invited you to \nroom: ${roomCode}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: colors.text,
        align: 'center',
      })
      .setOrigin(0.5);

    // Timer with circular progress
    this.timer = new Timer(this.scene, {
      y: 40,
      totalSeconds: this.totalSeconds,
      timeoutCallback: () => this.handleResponse('timeout'),
    });

    // Buttons
    const acceptBtn = Button.create(this.scene, -100, modal.height / 2 - 36, {
      width: 120,
      height: 60,
      text: 'Accept',
      onClick: () => this.handleResponse('accept'),
      bgColor: colors.success,
      fontSize: '20px',
    });

    const declineBtn = Button.create(this.scene, 100, modal.height / 2 - 36, {
      width: 120,
      height: 60,
      text: 'Decline',
      onClick: () => this.handleResponse('decline'),
      bgColor: colors.danger,
      fontSize: '20px',
    });

    this.container.add([
      shadow,
      bg,
      message,
      this.timer.getContainer(),
      acceptBtn,
      declineBtn,
    ]);

    this.dynamicContent = [
      this.backdrop,
      this.container,
      shadow,
      bg,
      message,
      acceptBtn,
      declineBtn,
    ];
  }

  private handleResponse(type: 'accept' | 'decline' | 'timeout'): void {
    if (!this.isActive || !this.callbacks) return;

    this.timer?.stop();
    this.animateOut(() => {
      if (type === 'accept') this.callbacks!.onAccept();
      else if (type === 'decline') this.callbacks!.onDecline();
      else this.callbacks!.onTimeout();
    });
  }

  private animateIn(): void {
    if (!this.isValid() || !this.container || !this.backdrop) return;

    const { width } = this.scene.cameras.main;
    const { modal } = CONFIG;
    const targetX = width - modal.width / 2 - modal.padding;

    // Subtle backdrop fade
    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 1,
      duration: CONFIG.animation.backdropFade,
      ease: 'Sine.easeOut',
    });

    // Slide in from right
    this.scene.tweens.add({
      targets: this.container,
      x: targetX,
      duration: CONFIG.animation.duration,
      ease: 'Back.easeOut',
    });
  }

  private animateOut(callback: () => void): void {
    if (!this.isValid() || !this.container || !this.backdrop) return;

    this.isActive = false;
    const { width } = this.scene.cameras.main;
    const { modal } = CONFIG;

    this.scene.tweens.add({
      targets: this.backdrop,
      alpha: 0,
      duration: CONFIG.animation.backdropFade,
      ease: 'Sine.easeIn',
    });

    // Slide out to the right
    this.scene.tweens.add({
      targets: this.container,
      x: width + modal.width,
      alpha: 0,
      duration: CONFIG.animation.duration - 100,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.cleanup();
        callback();
      },
    });
  }

  private hide(): void {
    this.timer?.stop();
    this.isActive = false;
    this.cleanup();
  }

  private cleanup(): void {
    this.dynamicContent.forEach((obj) => obj?.scene && obj.destroy());
    this.dynamicContent = [];
    this.timer?.destroy();
    this.container = undefined;
    this.backdrop = undefined;
  }

  public destroy(): void {
    this.timer?.stop();
    this.cleanup();
    this.callbacks = undefined;
  }
}
