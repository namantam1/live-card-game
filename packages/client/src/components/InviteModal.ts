import Phaser from 'phaser';
import Button from './Button';

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

/**
 * InviteModal - An instance-based modal for showing game invites
 * Each scene should have its own instance to avoid lifecycle issues
 */
export class InviteModal {
  private scene: Phaser.Scene;
  private callbacks?: InviteModalCallbacks;
  private container?: Phaser.GameObjects.Container;
  private modalBg?: Phaser.GameObjects.Graphics;
  private glowEffect?: Phaser.GameObjects.Graphics;
  private timerText?: Phaser.GameObjects.Text;
  private dynamicContent: Phaser.GameObjects.GameObject[] = [];
  private countdownEvent?: Phaser.Time.TimerEvent;
  private remainingSeconds = 0;
  private totalSeconds = 0;
  private isShowing = false;
  private isDestroyed = false;

  // Modern design dimensions
  private readonly modalWidth = 380;
  private readonly modalHeight = 120;
  private readonly padding = 20;

  // Colors
  private readonly colors = {
    bg: 0x0f172a,
    accent: 0x6366f1,
    success: 0x10b981,
    danger: 0xef4444,
    text: '#ffffff',
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
    this.positionOffScreen();
  }

  /**
   * Check if the scene has the basic properties needed for UI creation
   */
  private canCreateUI(): boolean {
    return (
      !!this.scene &&
      !!this.scene.add &&
      !!this.scene.cameras &&
      !!this.scene.cameras.main
    );
  }

  /**
   * Check if the scene is still valid and active (for runtime operations)
   */
  private isSceneValid(): boolean {
    return (
      !!this.scene &&
      !!this.scene.sys &&
      this.scene.sys.isActive() &&
      !!this.scene.cameras &&
      !!this.scene.cameras.main
    );
  }

  /**
   * Show the invite modal with the given options
   */
  public show(options: InviteModalOptions): void {
    if (!this.isSceneValid()) {
      console.warn('InviteModal: Cannot show modal - scene is not valid');
      return;
    }

    const { inviterName, roomCode, timeoutSeconds, callbacks } = options;

    // If already showing, hide first then show
    if (this.isShowing) {
      this.forceHide();
    }

    this.callbacks = callbacks;
    this.showInternal(inviterName, roomCode, timeoutSeconds);
  }

  private createUI() {
    if (!this.canCreateUI()) {
      console.warn('InviteModal: Cannot create UI - scene is not valid');
      return;
    }

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(10000); // Ensure it's on top

    // Glow effect
    this.glowEffect = this.scene.add.graphics();

    // Main background
    this.modalBg = this.scene.add.graphics();

    // Timer text (positioned in bottom area)
    this.timerText = this.scene.add
      .text(0, this.modalHeight / 2 - 50, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: this.colors.text,
      })
      .setOrigin(0.5);

    // Add to container
    this.container.add([this.glowEffect, this.modalBg, this.timerText]);
  }

  private positionOffScreen() {
    if (!this.canCreateUI() || !this.container) {
      return;
    }

    const { width, height } = this.scene.cameras.main;
    // Position off-screen to the right
    this.container.setPosition(
      width + this.modalWidth,
      height - this.modalHeight - this.padding
    );
  }

  private showInternal(
    inviterName: string,
    roomCode: string,
    timeoutSeconds: number
  ) {
    if (!this.isSceneValid() || !this.container) {
      console.warn('InviteModal: Cannot show - scene or container invalid');
      return;
    }

    // Reset flags to allow showing again
    if (this.isDestroyed) {
      this.isDestroyed = false;
      this.container.setAlpha(1);
      this.container.setScale(1);
    }

    this.isShowing = true;
    this.totalSeconds = timeoutSeconds;
    this.remainingSeconds = timeoutSeconds;

    // Clear any previous dynamic content
    this.clearDynamicContent();

    // Render modal content
    this.renderModalContent(inviterName, roomCode);

    // Animate slide in from bottom-right
    const { width, height } = this.scene.cameras.main;
    const targetX = width - this.modalWidth / 2 - this.padding;
    const targetY = height - this.modalHeight / 2 - this.padding;

    this.scene.tweens.add({
      targets: this.container,
      x: targetX,
      y: targetY,
      duration: 500,
      ease: 'Back.easeOut',
    });

    // Start countdown
    this.startCountdown();
  }

  private forceHide() {
    this.stopCountdown();
    this.isShowing = false;
    this.clearDynamicContent();

    // Only reposition if scene is valid
    if (this.isSceneValid()) {
      this.positionOffScreen();
    }
  }

  private clearDynamicContent() {
    // Destroy only dynamic content, keep the persistent graphics
    this.dynamicContent.forEach((obj) => {
      if (obj && obj.scene) {
        obj.destroy();
      }
    });
    this.dynamicContent = [];
  }

  private renderModalContent(inviterName: string, roomCode: string) {
    if (!this.isSceneValid() || !this.glowEffect || !this.modalBg) {
      return;
    }

    // Draw glow effect
    this.glowEffect.clear();
    this.glowEffect.fillStyle(this.colors.accent, 0.2);
    this.glowEffect.fillRoundedRect(
      -this.modalWidth / 2 - 6,
      -this.modalHeight / 2 - 6,
      this.modalWidth + 12,
      this.modalHeight + 12,
      20
    );

    // Draw main background with glassmorphism
    this.modalBg.clear();
    this.modalBg.fillGradientStyle(
      this.colors.bg,
      this.colors.bg,
      0x1e293b,
      0x1e293b,
      0.98,
      0.98,
      0.95,
      0.95
    );
    this.modalBg.fillRoundedRect(
      -this.modalWidth / 2,
      -this.modalHeight / 2,
      this.modalWidth,
      this.modalHeight,
      16
    );

    // Border with gradient
    this.modalBg.lineStyle(2, this.colors.accent, 0.6);
    this.modalBg.strokeRoundedRect(
      -this.modalWidth / 2,
      -this.modalHeight / 2,
      this.modalWidth,
      this.modalHeight,
      16
    );

    // Message
    const message = this.scene.add
      .text(
        0,
        -this.modalHeight / 2 + 35,
        `📨 ${inviterName} invites you to join to \nroom: ${roomCode}`,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          color: '#e2e8f0',
          align: 'center',
        }
      )
      .setOrigin(0.5);

    // Action buttons
    const acceptBtn = this.createActionButton(
      -90,
      this.modalHeight / 2 - 35,
      '✓ Accept',
      this.colors.success,
      () => this.handleAccept()
    );

    const declineBtn = this.createActionButton(
      90,
      this.modalHeight / 2 - 35,
      '✕ Decline',
      this.colors.danger,
      () => this.handleDecline()
    );

    // Initial timer display
    this.updateTimerDisplay();

    // Add all elements to container
    if (this.container) {
      this.container.add([message, acceptBtn, declineBtn]);
    }

    // Track dynamic content for cleanup
    this.dynamicContent = [message, acceptBtn, declineBtn];
  }

  private createActionButton(
    x: number,
    y: number,
    text: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    return Button.create(this.scene, x, y, {
      width: 100,
      height: 35,
      text,
      onClick,
      bgColor: color,
      fontSize: '16px',
    });
  }

  private updateTimerDisplay() {
    if (!this.timerText) return;

    const progress = this.remainingSeconds / this.totalSeconds;
    const secondsLeft = Math.ceil(this.remainingSeconds);

    // Color changes based on time remaining
    let textColor = '#60a5fa'; // Blue
    if (progress < 0.3) {
      textColor = '#ef4444'; // Red
    } else if (progress < 0.6) {
      textColor = '#fbbf24'; // Yellow
    }

    this.timerText.setText(`${secondsLeft}s`);
    this.timerText.setColor(textColor);
  }

  private handleAccept() {
    if (this.isDestroyed || !this.callbacks) return;

    this.stopCountdown();
    this.animateDestroy(() => {
      this.callbacks!.onAccept();
    });
  }

  private handleDecline() {
    if (this.isDestroyed || !this.callbacks) return;

    this.stopCountdown();
    this.animateDestroy(() => {
      this.callbacks!.onDecline();
    });
  }

  private handleTimeout() {
    if (this.isDestroyed || !this.callbacks) return;

    this.animateDestroy(() => {
      this.callbacks!.onTimeout();
    });
  }

  private startCountdown() {
    if (!this.isSceneValid()) return;

    this.stopCountdown();

    // Initial timer display
    this.updateTimerDisplay();

    this.countdownEvent = this.scene.time.addEvent({
      delay: 100, // Update frequently for smooth timer
      loop: true,
      callback: () => {
        this.remainingSeconds -= 0.1;
        if (this.remainingSeconds <= 0) {
          this.handleTimeout();
          return;
        }
        this.updateTimerDisplay();
      },
    });
  }

  private stopCountdown() {
    if (this.countdownEvent) {
      this.countdownEvent.remove(false);
      this.countdownEvent = undefined;
    }
  }

  private animateDestroy(callback: () => void) {
    if (this.isDestroyed || !this.isSceneValid() || !this.container) {
      return;
    }

    this.isDestroyed = true;
    this.isShowing = false;

    const { width } = this.scene.cameras.main;

    // Slide out and fade
    this.scene.tweens.add({
      targets: this.container,
      x: width + this.modalWidth,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 300,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.clearDynamicContent();
        callback();
        // Reset for potential reuse
        if (this.container) {
          this.isDestroyed = false;
          this.container.setAlpha(1);
          this.container.setScale(1);
        }
      },
    });
  }

  /**
   * Destroy the modal and clean up all resources
   * Call this when the scene is shutting down
   */
  public destroy() {
    this.stopCountdown();
    this.clearDynamicContent();

    if (this.container && this.container.scene) {
      this.container.destroy();
    }

    this.container = undefined;
    this.modalBg = undefined;
    this.glowEffect = undefined;
    this.timerText = undefined;
    this.callbacks = undefined;
  }
}
