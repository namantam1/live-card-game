import { Scene } from 'phaser';

/**
 * Creates the game table with trump icon in the center
 * Used in game scenes
 */
export function createTable(scene: Scene): void {
  const { width, height } = scene.cameras.main;
  const centerX = width / 2;
  const centerY = height / 2;

  // use image asset for table background if available
  const tableBg = scene.add.image(centerX, centerY, 'table');
  const scaleFactor = Math.min(
    (width * 0.85) / tableBg.width,
    (height * 0.85) / tableBg.height
  );
  tableBg.setScale(scaleFactor);

  // add a custom trump icon in the middle of table with custom color
  scene.add
    .text(centerX, centerY - 20, '\u2660', {
      fontFamily: 'Arial, sans-serif',
      fontSize: 200,
      color: '#6c91b8',
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#3d3d46',
        blur: 10,
        fill: true,
      },
    })
    .setOrigin(0.5);
}
