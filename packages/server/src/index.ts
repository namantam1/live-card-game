/**
 * Call Break Game Server
 * Using Colyseus 0.17.x with the new defineServer pattern
 */
import { listen } from '@colyseus/tools';

// Import Colyseus config
import app from './app.config.js';

// Create and listen on 2567 (or PORT environment variable.)
listen(app);
