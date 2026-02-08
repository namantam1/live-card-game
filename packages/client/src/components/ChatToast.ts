import { Scene } from 'phaser';
import type { ChatMessage } from '@call-break/shared';
import { PLAYER_POSITIONS, type Position } from '../utils/constants';
import type Player from '../objects/Player';

/**
 * Displays chat messages as floating speech bubbles near the player who sent them
 */
export default class ChatToast {
  private scene: Scene;
  private players: Player[];
  private readonly TOAST_DURATION = 5000;
  private readonly MAX_WIDTH = 280;
  private readonly VERTICAL_SPACING = 10; // Increased spacing to prevent overlap
  private readonly MAX_MESSAGES_PER_PLAYER = 3; // Maximum messages to show per player

  // Track active toasts per player position
  private activeToasts: Map<Position, Phaser.GameObjects.Container[]> =
    new Map();

  // Seat colors for player identification
  private readonly SEAT_COLORS = [
    '#ef4444', // red
    '#3b82f6', // blue
    '#22c55e', // green
    '#f59e0b', // amber
  ];

  constructor(scene: Scene, players: Player[]) {
    this.scene = scene;
    this.players = players;
  }

  /**
   * Show a chat message as a toast near the player
   */
  showMessage(message: ChatMessage): void {
    this.createToast(message);
  }

  private createToast(message: ChatMessage): void {
    const { width, height } = this.scene.cameras.main;

    // Find the player who sent the message
    // TODO: Check if this is correct plance to find player
    const player = this.players.find((p) => {
      if (p.networkId) {
        return p.networkId === message.playerId;
      }
      return p.absoluteSeatIndex === message.seatIndex;
    });

    if (!player) {
      console.warn('Player not found for chat message:', message);
      return;
    }

    const position = player.position;

    // Get player position
    const posConfig = PLAYER_POSITIONS[position];
    const playerX = width * posConfig.x;
    const playerY = height * posConfig.y;

    // Player color based on seat
    const seatColor =
      message.playerId === 'system'
        ? '#94a3b8'
        : this.SEAT_COLORS[message.seatIndex] || '#94a3b8';

    // Create temporary text to measure message height
    const tempText = this.scene.add.text(0, 0, message.message, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      wordWrap: { width: this.MAX_WIDTH - 24 },
    });
    const messageHeight = tempText.height;
    tempText.destroy();

    const bubbleHeight = messageHeight + 50;

    // Get existing toasts for this player position
    const existingToasts = this.activeToasts.get(position) || [];

    // If we've reached the limit, remove the oldest message first
    if (existingToasts.length >= this.MAX_MESSAGES_PER_PLAYER) {
      const oldestToast = existingToasts[0]; // First message is the oldest
      this.removeToast(oldestToast, true); // Remove immediately without waiting
    }

    // Calculate bubble position based on player location and existing toasts
    let bubbleX = playerX;
    let bubbleY = playerY - 80; // Default: above player

    // Calculate offset for stacking
    let stackOffset = 0;
    if (existingToasts.length > 0) {
      existingToasts.forEach((toast) => {
        // Get the stored height from the container data
        const toastHeight =
          toast.getData('bubbleHeight') || toast.getBounds().height;
        stackOffset += toastHeight + this.VERTICAL_SPACING;
      });
    }

    // Adjust position based on player's location
    switch (position) {
      case 'bottom':
        bubbleY = playerY - bubbleHeight - 40 - stackOffset; // Stack upward
        break;
      case 'top':
        bubbleY = playerY + 80 + stackOffset; // Stack downward
        break;
      case 'left':
        bubbleX = playerX + 120; // To the right
        bubbleY = playerY - bubbleHeight / 2 - stackOffset; // Stack upward
        break;
      case 'right':
        bubbleX = playerX - 120 - this.MAX_WIDTH; // To the left
        bubbleY = playerY - bubbleHeight / 2 - stackOffset; // Stack upward
        break;
    }

    // Create container
    const container = this.scene.add.container(bubbleX, bubbleY);
    container.setDepth(2000);
    container.setAlpha(0);
    container.setData('position', position); // Store position for cleanup
    container.setData('bubbleHeight', bubbleHeight); // Store height for accurate stacking

    // Background with speech bubble style
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1e293b, 0.95);
    bg.fillRoundedRect(0, 0, this.MAX_WIDTH, bubbleHeight, 12);

    // Border with player color
    const borderColor = parseInt(seatColor.replace('#', ''), 16);
    bg.lineStyle(3, borderColor, 1);
    bg.strokeRoundedRect(0, 0, this.MAX_WIDTH, bubbleHeight, 12);

    // Add small triangle pointer towards player
    this.addSpeechBubblePointer(bg, player.position, borderColor);

    // Player name
    const playerText = this.scene.add
      .text(12, 12, `${message.playerName}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: seatColor,
      })
      .setOrigin(0, 0);

    // Message text
    const messageText = this.scene.add
      .text(12, 32, message.message, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
        color: '#e2e8f0',
        wordWrap: { width: this.MAX_WIDTH - 24 },
      })
      .setOrigin(0, 0);

    container.add([bg, playerText, messageText]);

    // Add to active toasts tracking
    if (!this.activeToasts.has(position)) {
      this.activeToasts.set(position, []);
    }
    this.activeToasts.get(position)!.push(container);

    // Fade in animation
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scale: { from: 0.8, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Auto-dismiss after duration
    this.scene.time.delayedCall(this.TOAST_DURATION, () => {
      this.removeToast(container);
    });
  }

  private removeToast(
    container: Phaser.GameObjects.Container,
    immediate: boolean = false
  ): void {
    const position = container.getData('position') as Position;

    // Remove from tracking immediately
    const toasts = this.activeToasts.get(position);
    if (toasts) {
      const index = toasts.indexOf(container);
      if (index > -1) {
        toasts.splice(index, 1);
      }
      if (toasts.length === 0) {
        this.activeToasts.delete(position);
      }
    }

    // Fade out and destroy
    const duration = immediate ? 200 : 400; // Faster animation when making room
    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      scale: 0.8,
      duration: duration,
      ease: 'Power2',
      onComplete: () => {
        container.destroy();
        // Reposition remaining toasts after one is removed (only if not immediate)
        if (!immediate) {
          this.repositionToasts(position);
        }
      },
    });

    // If immediate removal, reposition right away so new message can take its place
    if (immediate) {
      this.repositionToasts(position);
    }
  }

  private repositionToasts(position: Position): void {
    const toasts = this.activeToasts.get(position);
    if (!toasts || toasts.length === 0) return;

    const { width, height } = this.scene.cameras.main;
    const posConfig = PLAYER_POSITIONS[position];
    const playerX = width * posConfig.x;
    const playerY = height * posConfig.y;

    let stackOffset = 0;

    toasts.forEach((toast) => {
      // Get the stored height from the container data
      const bubbleHeight =
        toast.getData('bubbleHeight') || toast.getBounds().height;

      let targetX = playerX;
      let targetY = playerY - 80;

      // Calculate new position based on player location
      switch (position) {
        case 'bottom':
          targetY = playerY - bubbleHeight - 40 - stackOffset;
          break;
        case 'top':
          targetY = playerY + 80 + stackOffset;
          break;
        case 'left':
          targetX = playerX + 120;
          targetY = playerY - bubbleHeight / 2 - stackOffset;
          break;
        case 'right':
          targetX = playerX - 120 - this.MAX_WIDTH;
          targetY = playerY - bubbleHeight / 2 - stackOffset;
          break;
      }

      // Animate to new position
      this.scene.tweens.add({
        targets: toast,
        x: targetX,
        y: targetY,
        duration: 300,
        ease: 'Power2',
      });

      stackOffset += bubbleHeight + this.VERTICAL_SPACING;
    });
  }

  private addSpeechBubblePointer(
    graphics: Phaser.GameObjects.Graphics,
    position: string,
    borderColor: number
  ): void {
    const pointerSize = 12;

    graphics.fillStyle(0x1e293b, 0.95);
    graphics.lineStyle(3, borderColor, 1);

    switch (position) {
      case 'bottom':
        // Pointer at bottom center
        graphics.fillTriangle(
          this.MAX_WIDTH / 2 - pointerSize,
          this.MAX_WIDTH,
          this.MAX_WIDTH / 2 + pointerSize,
          this.MAX_WIDTH,
          this.MAX_WIDTH / 2,
          this.MAX_WIDTH + pointerSize
        );
        graphics.strokeTriangle(
          this.MAX_WIDTH / 2 - pointerSize,
          this.MAX_WIDTH,
          this.MAX_WIDTH / 2 + pointerSize,
          this.MAX_WIDTH,
          this.MAX_WIDTH / 2,
          this.MAX_WIDTH + pointerSize
        );
        break;
      case 'top':
        // Pointer at top center
        graphics.fillTriangle(
          this.MAX_WIDTH / 2 - pointerSize,
          0,
          this.MAX_WIDTH / 2 + pointerSize,
          0,
          this.MAX_WIDTH / 2,
          -pointerSize
        );
        graphics.strokeTriangle(
          this.MAX_WIDTH / 2 - pointerSize,
          0,
          this.MAX_WIDTH / 2 + pointerSize,
          0,
          this.MAX_WIDTH / 2,
          -pointerSize
        );
        break;
      case 'left':
        // Pointer at left center (pointing left)
        graphics.fillTriangle(
          0,
          30 - pointerSize,
          0,
          30 + pointerSize,
          -pointerSize,
          30
        );
        graphics.strokeTriangle(
          0,
          30 - pointerSize,
          0,
          30 + pointerSize,
          -pointerSize,
          30
        );
        break;
      case 'right':
        // Pointer at right center (pointing right)
        graphics.fillTriangle(
          this.MAX_WIDTH,
          30 - pointerSize,
          this.MAX_WIDTH,
          30 + pointerSize,
          this.MAX_WIDTH + pointerSize,
          30
        );
        graphics.strokeTriangle(
          this.MAX_WIDTH,
          30 - pointerSize,
          this.MAX_WIDTH,
          30 + pointerSize,
          this.MAX_WIDTH + pointerSize,
          30
        );
        break;
    }
  }

  /**
   * Update players reference (if needed)
   */
  setPlayers(players: Player[]): void {
    this.players = players;
  }

  destroy(): void {
    // Destroy all active toasts
    this.activeToasts.forEach((toasts) => {
      toasts.forEach((toast) => toast.destroy());
    });
    this.activeToasts.clear();
  }
}
