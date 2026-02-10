import { Scene } from 'phaser';

export interface InputFieldConfig {
  x: number;
  y: number;
  width: number;
  uppercase?: boolean;
}

/**
 * Creates a canvas-based input field using rexUI CanvasInput plugin
 *
 * @param scene - Phaser scene
 * @param config - Input field configuration
 * @returns Canvas input instance
 */
export function createInputField(scene: Scene, config: InputFieldConfig): any {
  const { x, y, width, uppercase = false } = config;

  // Create rexUI CanvasInput (truly canvas-based)
  const canvasInput = scene.add
    .rexCanvasInput(x, y, width, 50, {
      background: {
        color: 0x1e293b,
        stroke: 0x475569,
        strokeThickness: 2,
        cornerRadius: 8,
        'focus.stroke': 0x6366f1,
      },
      style: {
        fontSize: '18px',
        fontFamily: 'Arial, sans-serif',
        color: '#ffffff',
      },
      wrap: {
        hAlign: 'center',
        vAlign: 'center',
      },
      text: '',
      maxLength: uppercase ? 4 : 20,
    })
    .setOrigin(0.5)
    .setDepth(100);

  // Transform to uppercase hack if needed
  if (uppercase) {
    let isUpdating = false;
    let lastText = '';

    const handleTextChange = () => {
      if (isUpdating) return;

      const currentText = canvasInput.text || '';

      // Only process if text actually changed (optimization)
      if (currentText === lastText) return;
      lastText = currentText;

      const upperText = currentText.toUpperCase();

      if (currentText !== upperText) {
        isUpdating = true;
        const cursorPos = canvasInput.cursorPosition;
        canvasInput.setText(upperText);
        canvasInput.setCursorPosition(cursorPos);
        lastText = upperText;
        requestAnimationFrame(() => {
          isUpdating = false;
        });
      }
    };

    // Poll for text changes while input is open
    // This is necessary because rexCanvasInput doesn't reliably fire textchange events
    canvasInput.on('open', () => {
      lastText = canvasInput.text || '';
      const updateInterval = scene.time.addEvent({
        delay: 50, // Check every 50ms
        callback: handleTextChange,
        loop: true,
      });

      canvasInput.once('close', () => {
        updateInterval.destroy();
      });
    });
  }

  return canvasInput;
}
