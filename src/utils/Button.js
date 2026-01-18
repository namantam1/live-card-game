/**
 * Reusable Button utility for Phaser 3
 * Handles all button interaction logic with proper mobile/desktop support
 */
export default class Button {
  /**
   * Create a button container with proper interaction handling
   * @param {Phaser.Scene} scene - The scene to add the button to
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} config - Button configuration
   * @param {number} config.width - Button width
   * @param {number} config.height - Button height
   * @param {string} config.text - Button text
   * @param {Function} config.onClick - Click callback
   * @param {number} [config.bgColor=0x6366f1] - Background color
   * @param {number} [config.borderRadius=10] - Border radius
   * @param {string} [config.fontSize='18px'] - Font size
   * @param {string} [config.fontFamily='Arial, sans-serif'] - Font family
   * @param {number} [config.hoverScale=1.05] - Scale on hover (desktop only)
   * @param {number} [config.pressScale=0.95] - Scale on press
   * @param {boolean} [config.playSound=false] - Play sound on click
   * @param {Object} [config.audioManager] - Audio manager for sound
   */
  static create(scene, x, y, config) {
    const {
      width,
      height,
      text,
      onClick,
      bgColor = 0x6366f1,
      borderRadius = 10,
      fontSize = '18px',
      fontFamily = 'Arial, sans-serif',
      hoverScale = 1.05,
      pressScale = 0.95,
      playSound = false,
      audioManager = null
    } = config;

    // Create container
    const container = scene.add.container(x, y);

    // Background
    const bg = scene.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, borderRadius);

    // Text
    const btnText = scene.add.text(0, 0, text, {
      fontFamily,
      fontSize,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, btnText]);

    // Make interactive
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });

    // State tracking
    let isPressed = false;

    // Hover (desktop only)
    container.on('pointerover', () => {
      if (!isPressed && !scene.sys.game.device.input.touch) {
        container.setScale(hoverScale);
      }
    });

    container.on('pointerout', () => {
      if (!isPressed) {
        container.setScale(1);
      }
    });

    // Press
    container.on('pointerdown', () => {
      isPressed = true;
      container.setScale(pressScale);
      if (playSound && audioManager) {
        audioManager.playButtonSound();
      }
    });

    // Release and execute callback
    container.on('pointerup', () => {
      if (isPressed) {
        isPressed = false;
        container.setScale(1);
        onClick();
      }
    });

    return container;
  }

  /**
   * Create a gradient button with custom styling
   * @param {Phaser.Scene} scene - The scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} config - Button configuration (same as create + gradient options)
   */
  static createGradient(scene, x, y, config) {
    const {
      width = 120,
      height = 36,
      text,
      onClick,
      primaryColor = 0x6366f1,
      secondaryColor = 0x8b5cf6,
      borderRadius = 8,
      fontSize = '14px',
      fontFamily = 'Arial, sans-serif',
      hoverScale = 1.05,
      pressScale = 0.95,
      playSound = false,
      audioManager = null,
      withShadow = false
    } = config;

    const container = scene.add.container(x, y);

    // Shadow (optional)
    if (withShadow) {
      const shadow = scene.add.graphics();
      shadow.fillStyle(0x000000, 0.3);
      shadow.fillRoundedRect(-width / 2 + 3, -height / 2 + 4, width, height, borderRadius);
      container.add(shadow);
    }

    // Background with gradient
    const bg = scene.add.graphics();
    bg.fillGradientStyle(primaryColor, secondaryColor, primaryColor, secondaryColor);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, borderRadius);

    // Text
    const btnText = scene.add.text(0, 0, text, {
      fontFamily,
      fontSize,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, btnText]);

    // Make interactive
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });

    let isPressed = false;

    container.on('pointerover', () => {
      if (!isPressed && !scene.sys.game.device.input.touch) {
        container.setScale(hoverScale);
      }
    });

    container.on('pointerout', () => {
      if (!isPressed) {
        container.setScale(1);
      }
    });

    container.on('pointerdown', () => {
      isPressed = true;
      container.setScale(pressScale);
      if (playSound && audioManager) {
        audioManager.playButtonSound();
      }
    });

    container.on('pointerup', () => {
      if (isPressed) {
        isPressed = false;
        container.setScale(1);
        onClick();
      }
    });

    return container;
  }

  /**
   * Create a pill-shaped action button (used in settings)
   * @param {Phaser.Scene} scene - The scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} config - Button configuration
   */
  static createActionButton(scene, x, y, config) {
    const {
      width = 180,
      height = 44,
      text,
      onClick,
      isDanger = false,
      fontSize,
      audioManager
    } = config;

    const container = scene.add.container(x, y);
    const radius = height / 2;

    // Shadow
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(-width / 2 + 3, -height / 2 + 4, width, height, radius);

    const bg = scene.add.graphics();
    const drawBg = (hover = false) => {
      bg.clear();
      if (isDanger) {
        bg.fillStyle(hover ? 0xb91c1c : 0x991b1b, 1);
      } else {
        bg.fillStyle(hover ? 0x7c3aed : 0x6366f1, 1);
      }
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    };
    drawBg();

    const btnText = scene.add.text(0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([shadow, bg, btnText]);

    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });

    let isPressed = false;

    container.on('pointerover', () => {
      if (!isPressed && !scene.sys.game.device.input.touch) {
        drawBg(true);
        container.setScale(1.03);
      }
    });

    container.on('pointerout', () => {
      if (!isPressed) {
        drawBg(false);
        container.setScale(1);
      }
    });

    container.on('pointerdown', () => {
      isPressed = true;
      if (audioManager) audioManager.playButtonSound();
      container.setScale(0.97);
    });

    container.on('pointerup', () => {
      if (isPressed) {
        isPressed = false;
        drawBg(false);
        container.setScale(1);
        onClick();
      }
    });

    return container;
  }

  /**
   * Create a bidding button (vertical scaling only)
   * @param {Phaser.Scene} scene - The scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} config - Button configuration
   */
  static createBidButton(scene, x, y, config) {
    const {
      width,
      height,
      text,
      onClick,
      bgColor = 0x6366f1,
      borderRadius = 6,
      fontSize = '16px',
      audioManager
    } = config;

    const container = scene.add.container(x, y);

    // Background
    const bg = scene.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, borderRadius);

    // Text
    const btnText = scene.add.text(0, 0, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, btnText]);

    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    });

    let isPressed = false;

    container.on('pointerover', () => {
      if (!isPressed && !scene.sys.game.device.input.touch) {
        container.setScale(1, 1.2);
      }
    });

    container.on('pointerout', () => {
      if (!isPressed) {
        container.setScale(1, 1);
      }
    });

    container.on('pointerdown', () => {
      isPressed = true;
      if (audioManager) audioManager.playButtonSound();
      container.setScale(1, 0.9);
    });

    container.on('pointerup', () => {
      if (isPressed) {
        isPressed = false;
        container.setScale(1, 1);
        onClick();
      }
    });

    return container;
  }
}
