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
  const isMobile = width < BREAKPOINT.WIDTH || height < BREAKPOINT.HEIGHT;
  // console.log(`isMobile check: width=${width}, height=${height} => isMobile=${isMobile}`);
  return isMobile;
};

// Card sizes
const CARD_HEIGHT = 250;
const CARD_WIDTH = (CARD_HEIGHT * 5) / 7;
export const CARD_CONFIG = {
  // Base card dimensions
  HEIGHT: CARD_HEIGHT,
  WIDTH: CARD_WIDTH,

  // Desktop scale
  DESKTOP_SCALE: 0.9,

  // Mobile scale (adjust this to make cards bigger/smaller on mobile)
  MOBILE_SCALE: 0.9,

  // Card overlap in hand (desktop)
  HAND_OVERLAP: 50,

  // Mobile hand overlap multiplier
  MOBILE_OVERLAP_MULTIPLIER: 0.7,

  // Hover lift when card is playable
  HOVER_LIFT: 25,
};

// Bidding buttons
export const BIDDING_CONFIG = {
  DESKTOP: {
    buttonWidth: 80,
    buttonHeight: 80,
    buttonSpacing: 10,
    borderRadius: 20,
    fontSize: '30px',
    titleFontSize: '20px',
  },
  MOBILE: {
    buttonWidth: 60,        // Larger for easier tapping
    buttonHeight: 50,
    buttonSpacing: 10,
    borderRadius: 10,
    fontSize: '20px',
    titleFontSize: '22px',
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
    trumpIndicator: '20px',
    trumpSymbol: '30px',
    roundIndicator: '11px',

    // Player labels
    playerName: '20px',
    playerStats: '20px',

    // Menu
    menuTitle: '100px',
    menuSpadeIcon: '180px',
    menuSubtitle: '25px',
    menuButton: '30px',

    // Lobby
    lobbyTitle: '100px',
    lobbySubtitle: '25px',
    lobbyButton: '30px',

    // Modals
    modalTitle: '28px',
    modalContent: '16px',

    // Settings
    settingsLabel: '22px',

    // Action buttons
    actionButton: '20px',
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
    actionButton: '20px',
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
    radius: 150,
    lineWidth: 4,
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
  // console.log(`getFontSize: key=${key}, width=${width}, height=${height} => fontSize=${config[key] || '14px'}`);
  return config[key] || '14px';
};
