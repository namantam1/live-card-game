import { Scene } from 'phaser';

/**
 * Creates a modern dark gradient background with grid pattern and ambient glow orbs
 * Used in menu and lobby scenes
 */
export function createBackground(scene: Scene): void {
  const { width, height } = scene.cameras.main;

  // Modern dark gradient background
  const graphics = scene.add.graphics();
  graphics.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a2e, 0x1a1a2e);
  graphics.fillRect(0, 0, width, height);

  // Subtle grid pattern
  graphics.lineStyle(1, 0x2a2a4a, 0.1);
  const gridSize = 40;
  for (let x = 0; x < width; x += gridSize) {
    graphics.lineBetween(x, 0, x, height);
  }
  for (let y = 0; y < height; y += gridSize) {
    graphics.lineBetween(0, y, width, y);
  }

  // Ambient glow orbs
  graphics.fillStyle(0x6366f1, 0.08);
  graphics.fillCircle(width * 0.15, height * 0.2, 180);
  graphics.fillStyle(0x8b5cf6, 0.06);
  graphics.fillCircle(width * 0.85, height * 0.8, 220);
  graphics.fillStyle(0x06b6d4, 0.05);
  graphics.fillCircle(width * 0.5, height * 0.5, 300);

  // Create a few floating card backs
  const positions = [
    { x: width * 0.15, y: height * 0.3, delay: 0 },
    { x: width * 0.85, y: height * 0.4, delay: 500 },
    { x: width * 0.1, y: height * 0.7, delay: 1000 },
    { x: width * 0.9, y: height * 0.8, delay: 1500 },
  ];

  positions.forEach(({ x, y, delay }) => {
    const card = scene.add.image(x, y, 'card-back').setScale(0.5).setAlpha(0.3);

    scene.tweens.add({
      targets: card,
      y: y - 20,
      rotation: Phaser.Math.DegToRad(Phaser.Math.Between(-15, 15)),
      duration: 2000,
      delay,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  });
}

/**
 * Creates game background using a full-screen image
 * Used in active game scenes
 */
export function createGameBackground(scene: Scene): void {
  const { width, height } = scene.cameras.main;
  const bg = scene.add.image(width / 2, height / 2, 'bg');
  const scaleFactor = Math.max(width / bg.width, height / bg.height);
  bg.setScale(scaleFactor);
}
