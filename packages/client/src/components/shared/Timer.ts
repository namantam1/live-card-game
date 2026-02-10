import Phaser from 'phaser';

const CONFIG = { safe: '#60a5fa', warning: '#fbbf24', danger: '#f87171' };

type TimerConfig = {
  x?: number;
  y?: number;
  totalSeconds: number;
  timeoutCallback?: () => void;
};

export class Timer {
  private scene: Phaser.Scene;
  private timerContainer!: Phaser.GameObjects.Container;
  private totalSeconds: number;
  private remainingSeconds: number = 0;
  private countdownEvent?: Phaser.Time.TimerEvent;
  private timeoutCallback?: () => void;

  constructor(
    scene: Phaser.Scene,
    { x = 0, y = 0, totalSeconds, timeoutCallback }: TimerConfig
  ) {
    this.scene = scene;
    this.totalSeconds = this.remainingSeconds = totalSeconds;
    this.timeoutCallback = timeoutCallback;

    this.create(x, y);
    this.updateTimerDisplay(); // Initial render
  }

  private create(x: number, y: number) {
    const timerContainer = this.scene.add.container(x, y);
    const circle = this.scene.add.graphics();
    const text = this.scene.add
      .text(0, 0, '', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: CONFIG.safe,
      })
      .setOrigin(0.5);

    timerContainer.add([circle, text]);
    timerContainer.setData('circle', circle);
    timerContainer.setData('text', text);

    this.timerContainer = timerContainer;
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.timerContainer;
  }

  private updateTimerDisplay() {
    const circle = this.timerContainer.getData(
      'circle'
    ) as Phaser.GameObjects.Graphics;
    const text = this.timerContainer.getData('text') as Phaser.GameObjects.Text;
    if (!this.isValid() || !circle || !text) return;

    const progress = this.remainingSeconds / this.totalSeconds;
    const seconds = Math.ceil(this.remainingSeconds);

    // Update color based on time
    let color: string = CONFIG.safe;
    if (progress < 0.25) color = CONFIG.danger;
    else if (progress < 0.5) color = CONFIG.warning;

    text.setText(`${seconds}s`).setColor(color);

    // Draw circular progress
    circle.clear();
    circle.lineStyle(
      4,
      Phaser.Display.Color.HexStringToColor(color).color,
      0.3
    );
    circle.strokeCircle(0, 0, 22);
    circle.lineStyle(4, Phaser.Display.Color.HexStringToColor(color).color);
    circle.beginPath();
    circle.arc(
      0,
      0,
      22,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * progress,
      false
    );
    circle.strokePath();
  }

  start(): void {
    if (!this.isValid()) return;
    this.stop();

    // Ensure initial display
    this.updateTimerDisplay();

    this.countdownEvent = this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        this.remainingSeconds -= 0.1;
        if (this.remainingSeconds <= 0) {
          this.stop();
          this.timeoutCallback?.();
          return;
        }
        this.updateTimerDisplay();
      },
    });
  }

  stop(): void {
    this.countdownEvent?.remove(false);
    this.countdownEvent = undefined;
  }

  private isValid(): boolean {
    return this.scene?.sys?.isActive() && !!this.scene.cameras?.main;
  }

  destroy(): void {
    this.stop();
    this.timerContainer?.destroy();
  }
}
