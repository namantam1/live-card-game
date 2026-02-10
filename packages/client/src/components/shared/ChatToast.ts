import { Scene } from 'phaser';
import type { ChatMessage } from '@call-break/shared';
import { PLAYER_POSITIONS, type Position } from '../../utils/constants';
import type Player from '../../objects/Player';
import AudioManager from '../../managers/AudioManager';

const CONFIG = {
  TOAST_DURATION: 5000,
  MAX_WIDTH: 270,
  VERTICAL_SPACING: 10,
  MAX_MESSAGES_PER_PLAYER: 3,
  MESSAGE_FONT_SIZE: '22px',
  PLAYER_NAME_FONT_SIZE: '20px',
};

// Position configuration for chat bubbles relative to player
const BUBBLE_POSITION_CONFIG = {
  bottom: {
    offsetX: 80, // Flow right to the player
    offsetY: -20, // Above player
    width: 270, // CONFIG.MAX_WIDTH
  },
  top: {
    offsetX: 80, // Flow right to the player
    offsetY: -80, // Below player
    width: 270, // CONFIG.MAX_WIDTH
  },
  left: {
    offsetX: 80, // To the right
    offsetY: 0, // Center aligned (adjusted by bubbleHeight/2)
    width: 270, // CONFIG.MAX_WIDTH
  },
  right: {
    offsetX: -80, // To the left (minus width)
    offsetY: 0, // Center aligned (adjusted by bubbleHeight/2)
    width: 270, // CONFIG.MAX_WIDTH
  },
} as const;

/**
 * Displays chat messages as floating speech bubbles near the player who sent them
 */
export default class ChatToast {
  private scene: Scene;
  private players: Player[];

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

    // Optional: play a sound effect for incoming message
    const player = this.players.find((p) => p.id === message.playerId);
    if (!player?.isLocal) {
      AudioManager.getInstance().playAlertSound();
    }
  }

  private createToast(message: ChatMessage): void {
    const { width, height } = this.scene.cameras.main;

    // Find the player who sent the message
    const player = this.players.find((p) => p.id === message.playerId);

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
    const seatColor = player.isLocal
      ? '#94a3b8'
      : this.SEAT_COLORS[message.seatIndex] || '#94a3b8';

    // Create temporary text to measure message height
    const tempText = this.scene.add.text(0, 0, message.message, {
      fontFamily: 'Arial, sans-serif',
      fontSize: CONFIG.MESSAGE_FONT_SIZE,
      wordWrap: { width: CONFIG.MAX_WIDTH - 24 },
    });
    const messageHeight = tempText.height;
    tempText.destroy();

    const bubbleHeight = messageHeight + 50;

    // Get existing toasts for this player position
    const existingToasts = this.activeToasts.get(position) || [];

    // If we've reached the limit, remove the oldest message first
    if (existingToasts.length >= CONFIG.MAX_MESSAGES_PER_PLAYER) {
      const oldestToast = existingToasts[0]; // First message is the oldest
      this.removeToast(oldestToast, true); // Remove immediately without waiting
    }

    // Calculate bubble position based on player location
    // New messages always appear at base position
    let bubbleX = playerX;
    let bubbleY = playerY - 80; // Default: above player

    // Adjust position based on player's location using configuration
    const positionConfig = BUBBLE_POSITION_CONFIG[position];
    switch (position) {
      case 'bottom':
        bubbleX = playerX + positionConfig.offsetX;
        bubbleY = playerY - bubbleHeight + positionConfig.offsetY;
        break;
      case 'top':
        bubbleX = playerX + positionConfig.offsetX;
        bubbleY = playerY + positionConfig.offsetY;
        break;
      case 'left':
        bubbleX = playerX + positionConfig.offsetX;
        bubbleY = playerY - bubbleHeight / 2;
        break;
      case 'right':
        bubbleX = playerX + positionConfig.offsetX - positionConfig.width;
        bubbleY = playerY - bubbleHeight / 2;
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
    bg.fillRoundedRect(0, 0, CONFIG.MAX_WIDTH, bubbleHeight, 12);

    // Border with player color
    const borderColor = parseInt(seatColor.replace('#', ''), 16);
    bg.lineStyle(3, borderColor, 1);
    bg.strokeRoundedRect(0, 0, CONFIG.MAX_WIDTH, bubbleHeight, 12);

    // Create pointer as a separate graphics object
    const pointer = this.scene.add.graphics();
    this.addSpeechBubblePointer(
      pointer,
      player.position,
      borderColor,
      bubbleHeight
    );

    // Player name
    const playerText = this.scene.add
      .text(12, 7, `${message.playerName}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: CONFIG.MESSAGE_FONT_SIZE,
        fontStyle: 'bold',
        color: seatColor,
      })
      .setOrigin(0, 0);

    // Message text
    const messageText = this.scene.add
      .text(12, 38, message.message, {
        fontFamily: 'Arial, sans-serif',
        fontSize: CONFIG.PLAYER_NAME_FONT_SIZE,
        color: '#e2e8f0',
        wordWrap: { width: CONFIG.MAX_WIDTH - 24 },
      })
      .setOrigin(0, 0);

    container.add([bg, pointer, playerText, messageText]);
    container.setData('pointer', pointer); // Store pointer reference

    // Hide pointer from previous newest message (if exists)
    if (existingToasts.length > 0) {
      const previousNewest = existingToasts[existingToasts.length - 1];
      const previousPointer = previousNewest.getData('pointer');
      if (previousPointer) {
        previousPointer.setVisible(false);
      }
    }

    // Add to active toasts tracking
    if (!this.activeToasts.has(position)) {
      this.activeToasts.set(position, []);
    }
    this.activeToasts.get(position)!.push(container);

    // Reposition existing toasts upward to make room for new message
    if (existingToasts.length > 0) {
      this.repositionToasts(position);
    }

    // Fade in animation
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      scale: { from: 0.8, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Auto-dismiss after duration
    this.scene.time.delayedCall(CONFIG.TOAST_DURATION, () => {
      this.removeToast(container);
    });
  }

  private removeToast(
    container: Phaser.GameObjects.Container,
    immediate: boolean = false
  ): void {
    const position = container.getData('position') as Position;

    // Check if this is the newest message (has visible pointer)
    const pointer = container.getData('pointer');
    const wasNewest = pointer && pointer.visible;

    // Remove from tracking immediately
    const toasts = this.activeToasts.get(position);
    if (toasts) {
      const index = toasts.indexOf(container);
      if (index > -1) {
        toasts.splice(index, 1);
      }

      // If the removed toast was the newest, show pointer on the new newest
      if (wasNewest && toasts.length > 0) {
        const newNewest = toasts[toasts.length - 1];
        const newPointer = newNewest.getData('pointer');
        if (newPointer) {
          newPointer.setVisible(true);
        }
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

    // Iterate in reverse order (newest to oldest)
    // Newest message stays at base position, older messages get pushed away
    let cumulativeOffset = 0;

    for (let i = toasts.length - 1; i >= 0; i--) {
      const toast = toasts[i];
      const bubbleHeight =
        toast.getData('bubbleHeight') || toast.getBounds().height;

      let targetX = playerX;
      let targetY = playerY - 80;

      // Calculate new position based on player location using configuration
      const positionConfig = BUBBLE_POSITION_CONFIG[position];
      switch (position) {
        case 'bottom':
          targetX = playerX + positionConfig.offsetX;
          targetY =
            playerY - bubbleHeight + positionConfig.offsetY - cumulativeOffset; // Older messages pushed up
          break;
        case 'top':
          targetX = playerX + positionConfig.offsetX;
          targetY = playerY + positionConfig.offsetY + cumulativeOffset; // Older messages pushed down (larger Y)
          break;
        case 'left':
          targetX = playerX + positionConfig.offsetX;
          targetY = playerY - bubbleHeight / 2 - cumulativeOffset; // Older messages pushed up
          break;
        case 'right':
          targetX = playerX + positionConfig.offsetX - positionConfig.width;
          targetY = playerY - bubbleHeight / 2 - cumulativeOffset; // Older messages pushed up
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

      // Add this toast's height to cumulative offset
      cumulativeOffset += bubbleHeight + CONFIG.VERTICAL_SPACING;
    }
  }

  private addSpeechBubblePointer(
    graphics: Phaser.GameObjects.Graphics,
    position: string,
    borderColor: number,
    bubbleHeight: number
  ): void {
    const pointerWidth = 18;
    const pointerHeight = 18;

    graphics.fillStyle(0x1e293b, 0.95);
    graphics.lineStyle(3, borderColor, 1);

    switch (position) {
      case 'bottom':
        // Pointer at bottom left corner (pointing diagonally down-left)
        graphics.fillTriangle(
          8,
          bubbleHeight,
          pointerWidth,
          bubbleHeight,
          0,
          bubbleHeight + pointerHeight
        );
        graphics.strokeTriangle(
          8,
          bubbleHeight,
          pointerWidth,
          bubbleHeight,
          0,
          bubbleHeight + pointerHeight
        );
        break;
      case 'top':
        // Pointer at top left corner (pointing diagonally up-left)
        graphics.fillTriangle(8, 0, pointerWidth, 0, 0, -pointerHeight);
        graphics.strokeTriangle(8, 0, pointerWidth, 0, 0, -pointerHeight);
        break;
      case 'left':
        // Pointer at left center (pointing left)
        graphics.fillTriangle(
          0,
          20,
          0,
          20 + pointerWidth,
          -pointerHeight,
          20 + pointerWidth / 2
        );
        graphics.strokeTriangle(
          0,
          20,
          0,
          20 + pointerWidth,
          -pointerHeight,
          20 + pointerWidth / 2
        );
        break;
      case 'right':
        // Pointer at right center (pointing right)
        graphics.fillTriangle(
          CONFIG.MAX_WIDTH,
          20,
          CONFIG.MAX_WIDTH,
          20 + pointerWidth,
          CONFIG.MAX_WIDTH + pointerHeight,
          20 + pointerWidth / 2
        );
        graphics.strokeTriangle(
          CONFIG.MAX_WIDTH,
          20,
          CONFIG.MAX_WIDTH,
          20 + pointerWidth,
          CONFIG.MAX_WIDTH + pointerHeight,
          20 + pointerWidth / 2
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
