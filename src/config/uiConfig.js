/**
 * Centralized UI Configuration
 *
 * This file contains all UI element sizes, fonts, and spacing configurations
 * for both mobile and desktop views. Adjust values here to change sizes globally.
 */

// Responsive breakpoint
export const BREAKPOINT = {
  WIDTH: 600,
  HEIGHT: 500,
};

/**
 * Check if current viewport is mobile size
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @returns {boolean} - True if mobile size
 */
export const isMobile = (width, height) => {
  return width < BREAKPOINT.WIDTH || height < BREAKPOINT.HEIGHT;
};

// Card sizes
const CARD_HEIGHT = 240;
const CARD_WIDTH = (CARD_HEIGHT * 3) / 4;
export const CARD_CONFIG = {
  // Base card dimensions
  HEIGHT: CARD_HEIGHT,
  WIDTH: CARD_WIDTH,

  // Desktop scale
  DESKTOP_SCALE: 0.7,

  // Mobile scale (adjust this to make cards bigger/smaller on mobile)
  MOBILE_SCALE: 0.9,

  // Card overlap in hand (desktop)
  HAND_OVERLAP: 35,

  // Mobile hand overlap multiplier
  MOBILE_OVERLAP_MULTIPLIER: 0.7,

  // Hover lift when card is playable
  HOVER_LIFT: 25,
};

// Bidding buttons
export const BIDDING_CONFIG = {
  DESKTOP: {
    buttonWidth: 36,
    buttonHeight: 30,
    buttonSpacing: 4,
    borderRadius: 5,
    fontSize: '14px',
    titleFontSize: '16px',
  },
  MOBILE: {
    buttonWidth: 44,        // Larger for easier tapping
    buttonHeight: 36,
    buttonSpacing: 6,
    borderRadius: 6,
    fontSize: '16px',
    titleFontSize: '18px',
  },
};

// Scoreboard configuration
export const SCOREBOARD_CONFIG = {
  DESKTOP: {
    margin: 20,
    marginTop: 30,
    height: 50,
    padding: 20,
    spacing: 10,
    roundFontSize: '22px',
    emojiFontSize: '22px',
    scoreFontSize: '22px',
  },
  MOBILE: {
    margin: 15,
    marginTop: 30,
    height: 50,
    padding: 20,
    spacing: 10,
    roundFontSize: '22px',
    emojiFontSize: '22px',
    scoreFontSize: '22px',
  },
};

// Settings icon configuration
export const SETTINGS_ICON_CONFIG = {
  DESKTOP: {
    iconSize: 20,
    fontSize: '30px',
    margin: 30,
  },
  MOBILE: {
    iconSize: 20,
    fontSize: '30px',
    margin: 40,
  },
};

// General font sizes
export const FONT_CONFIG = {
  DESKTOP: {
    // Game UI
    trumpIndicator: '12px',
    trumpSymbol: '22px',
    roundIndicator: '11px',

    // Player labels
    playerName: '18px',
    playerStats: '16px',

    // Menu
    menuTitle: '48px',
    menuSpadeIcon: '64px',
    menuSubtitle: '18px',
    menuButton: '18px',

    // Modals
    modalTitle: '24px',
    modalContent: '14px',

    // Settings
    settingsLabel: '15px',

    // Action buttons
    actionButton: '14px',
  },
  MOBILE: {
    // Game UI
    trumpIndicator: '14px',      // Slightly larger for mobile
    trumpSymbol: '26px',
    roundIndicator: '13px',

    // Player labels
    playerName: '18px',
    playerStats: '16px',

    // Menu
    menuTitle: '56px',
    menuSpadeIcon: '72px',
    menuSubtitle: '20px',
    menuButton: '20px',

    // Modals
    modalTitle: '28px',
    modalContent: '16px',

    // Settings
    settingsLabel: '22px',

    // Action buttons
    actionButton: '16px',
  },
};

// General spacing and margins
export const SPACING_CONFIG = {
  DESKTOP: {
    small: 4,
    medium: 8,
    large: 16,
    xlarge: 24,
  },
  MOBILE: {
    small: 6,
    medium: 10,
    large: 20,
    xlarge: 30,
  },
};

// Turn indicator
export const TURN_INDICATOR_CONFIG = {
  DESKTOP: {
    radius: 80,
    lineWidth: 3,
  },
  MOBILE: {
    radius: 90,
    lineWidth: 4,
  },
};

/**
 * Helper function to get responsive config
 * @param {object} config - Config object with DESKTOP and MOBILE keys
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @returns {object} - Responsive config based on screen size
 */
export const getResponsiveConfig = (config, width, height) => {
  return isMobile(width, height) ? config.MOBILE : config.DESKTOP;
};

/**
 * Helper function to get responsive font size
 * @param {string} key - Font config key
 * @param {number} width - Screen width
 * @param {number} height - Screen height
 * @returns {string} - Font size string (e.g., '16px')
 */
export const getFontSize = (key, width, height) => {
  const config = getResponsiveConfig(FONT_CONFIG, width, height);
  return config[key] || '14px';
};
