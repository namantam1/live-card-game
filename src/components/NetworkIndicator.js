import Phaser from 'phaser';

/**
 * NetworkIndicator - Visual indicator for network connection strength
 *
 * Displays a signal strength icon with color coding:
 * - Green: Good connection
 * - Yellow: Fair connection
 * - Orange: Poor connection
 * - Red: Offline/Reconnecting
 */
export default class NetworkIndicator extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);

    this.scene = scene;
    this.currentQuality = 'good';
    this.isReconnecting = false;

    this.createIndicator();
    scene.add.existing(this);
  }

  createIndicator() {
    // Background circle
    this.bg = this.scene.add.graphics();
    this.bg.fillStyle(0x1e293b, 0.9);
    this.bg.fillCircle(0, 0, 18);
    this.bg.lineStyle(2, 0x475569, 0.5);
    this.bg.strokeCircle(0, 0, 18);
    this.add(this.bg);

    // Signal bars (3 bars)
    this.bars = [];
    const barWidth = 3;
    const barSpacing = 2;
    const startX = -6;

    for (let i = 0; i < 3; i++) {
      const height = 6 + (i * 4);
      const bar = this.scene.add.rectangle(
        startX + (i * (barWidth + barSpacing)),
        2,
        barWidth,
        height,
        0x22c55e
      );
      bar.setOrigin(0, 1);
      this.bars.push(bar);
      this.add(bar);
    }

    // Status text (hidden by default)
    this.statusText = this.scene.add.text(0, 28, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#94a3b8',
      align: 'center'
    }).setOrigin(0.5, 0);
    this.statusText.setVisible(false);
    this.add(this.statusText);

    // Pulsing animation for reconnecting state
    this.pulseAnimation = null;

    // Make it interactive to show tooltip
    this.setSize(36, 36);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains);

    this.on('pointerover', () => this.showTooltip());
    this.on('pointerout', () => this.hideTooltip());
  }

  /**
   * Update connection quality display
   * @param {string} quality - 'good', 'fair', 'poor', or 'offline'
   */
  updateQuality(quality) {
    this.currentQuality = quality;
    this.isReconnecting = false;

    // Stop any pulse animation
    if (this.pulseAnimation) {
      this.pulseAnimation.stop();
      this.pulseAnimation = null;
      this.setAlpha(1);
    }

    // Update bar colors and visibility
    const colors = {
      good: 0x22c55e,    // Green
      fair: 0xeab308,    // Yellow
      poor: 0xf97316,    // Orange
      offline: 0xef4444  // Red
    };

    const visibleBars = {
      good: 3,
      fair: 2,
      poor: 1,
      offline: 0
    };

    const color = colors[quality] || colors.good;
    const visible = visibleBars[quality] ?? 3;

    this.bars.forEach((bar, index) => {
      bar.setFillStyle(color);
      bar.setVisible(index < visible);
    });

    // Update border color
    this.bg.clear();
    this.bg.fillStyle(0x1e293b, 0.9);
    this.bg.fillCircle(0, 0, 18);
    this.bg.lineStyle(2, color, 0.6);
    this.bg.strokeCircle(0, 0, 18);
  }

  /**
   * Show reconnecting state
   * @param {number} attempt - Current reconnection attempt number
   */
  showReconnecting(attempt = 1) {
    this.isReconnecting = true;
    this.updateQuality('offline');

    // Add pulsing animation
    if (!this.pulseAnimation) {
      this.pulseAnimation = this.scene.tweens.add({
        targets: this,
        alpha: 0.3,
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    }

    // Show attempt count
    this.statusText.setText(`Reconnecting... (${attempt})`);
    this.statusText.setVisible(true);
  }

  /**
   * Show reconnected state
   */
  showReconnected() {
    this.isReconnecting = false;
    this.updateQuality('good');

    // Flash green
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      yoyo: true,
      onComplete: () => {
        this.statusText.setVisible(false);
      }
    });
  }

  /**
   * Show tooltip with connection info
   */
  showTooltip() {
    const messages = {
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
      offline: 'Offline'
    };

    const message = this.isReconnecting
      ? 'Reconnecting...'
      : messages[this.currentQuality] || 'Unknown';

    this.statusText.setText(message);
    this.statusText.setVisible(true);

    // Slight scale effect
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 100
    });
  }

  /**
   * Hide tooltip
   */
  hideTooltip() {
    if (!this.isReconnecting) {
      this.statusText.setVisible(false);
    }

    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 100
    });
  }

  /**
   * Clean up
   */
  destroy(fromScene) {
    if (this.pulseAnimation) {
      this.pulseAnimation.stop();
    }
    super.destroy(fromScene);
  }
}
