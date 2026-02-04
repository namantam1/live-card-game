import Phaser from 'phaser';
import { COLORS } from '../../utils/constants';
import Button from '../Button';

/**
 * WaitingView - Displays the waiting room with player list and ready status
 */
export class WaitingView {
  private scene: Phaser.Scene;
  public container: Phaser.GameObjects.Container;
  private roomCodeDisplay!: Phaser.GameObjects.Text;
  private playersListContainer!: Phaser.GameObjects.Container;
  private waitingText!: Phaser.GameObjects.Text;
  private readyBtn!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    this.createUI();
  }

  private createUI() {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Title
    const waitTitle = this.scene.add
      .text(centerX, centerY - 180, 'Waiting Room', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Room code display
    this.roomCodeDisplay = this.scene.add
      .text(centerX, centerY - 135, 'Room Code: ----', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '35px',
        fontStyle: 'bold',
        color: '#22c55e',
      })
      .setOrigin(0.5);

    // Copy hint
    const copyHint = this.scene.add
      .text(centerX, centerY - 85, 'Share this code with friends!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // Players list container
    this.playersListContainer = this.scene.add.container(centerX, centerY);

    // Waiting text
    this.waitingText = this.scene.add
      .text(centerX, centerY + 120, 'Waiting for players... (0/4)', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    // Ready button
    this.readyBtn = this.createButton(centerX, centerY + 180, 'Ready', () => {
      this.emit('ready');
    });

    // Leave button
    const leaveBtn = this.createButton(
      centerX,
      centerY + 280,
      'Leave Room',
      () => {
        this.emit('leave');
      },
      0xef4444
    );

    // Status text at bottom (for messages like "Sending ready status...")
    this.statusText = this.scene.add
      .text(centerX, height - 30, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#f59e0b',
      })
      .setOrigin(0.5);

    this.container.add([
      waitTitle,
      this.roomCodeDisplay,
      copyHint,
      this.playersListContainer,
      this.waitingText,
      this.readyBtn,
      leaveBtn,
      this.statusText,
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

  private emit(event: string, data?: unknown) {
    this.scene.events.emit(`waitingView:${event}`, data);
  }

  // Public API
  show() {
    this.container.setVisible(true);
  }

  hide() {
    this.container.setVisible(false);
  }

  setRoomCode(code: string) {
    this.roomCodeDisplay.setText(`Room Code: ${code}`);
  }

  updatePlayersList(
    players: Array<{
      id: string;
      name: string;
      emoji: string;
      isReady: boolean;
    }>,
    localPlayerId: string
  ) {
    // Clear existing list
    this.playersListContainer.removeAll(true);

    players.forEach((player, index) => {
      const y = -50 + index * 35;
      const isLocal = player.id === localPlayerId;

      // Player emoji and name
      const nameText = this.scene.add
        .text(
          -100,
          y,
          `${player.emoji} ${player.name}${isLocal ? ' (You)' : ''}`,
          {
            fontFamily: 'Arial, sans-serif',
            fontSize: '22px',
            color: isLocal ? '#22c55e' : '#ffffff',
          }
        )
        .setOrigin(0, 0.5);

      // Ready status
      const status = this.scene.add
        .text(150, y, player.isReady ? 'Ready' : 'Waiting...', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          color: player.isReady ? '#22c55e' : '#94a3b8',
        })
        .setOrigin(1, 0.5);

      this.playersListContainer.add([nameText, status]);
    });

    // Update waiting text
    const readyCount = players.filter((p) => p.isReady).length;
    this.waitingText.setText(
      `Waiting for players... (${players.length}/4) - ${readyCount} ready`
    );

    // Show/hide ready button based on local player status
    const localPlayer = players.find((p) => p.id === localPlayerId);
    if (localPlayer && !localPlayer.isReady) {
      this.readyBtn.setVisible(true);
    } else {
      this.readyBtn.setVisible(false);
    }
  }

  setWaitingMessage(message: string) {
    this.statusText.setText(message);
  }

  clearStatus() {
    this.statusText.setText('');
  }

  destroy() {
    this.container.destroy();
  }
}
