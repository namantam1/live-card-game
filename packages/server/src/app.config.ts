import config from '@colyseus/tools';
import { monitor, playground } from 'colyseus';
import type { Application, Request, Response } from 'express';
import cors from 'cors';
import { CallBreakRoom } from './rooms/callbreak/CallBreakRoom.js';
import { PresenceRoom } from './rooms/presence/PresenceRoom.js';

export default config({
  initializeGameServer: (gameServer) => {
    /**
     * Define your room handlers:
     */
    gameServer.define('call_break', CallBreakRoom).filterBy(['roomCode']);
    gameServer.define('presence', PresenceRoom);
  },

  initializeExpress: (app: Application) => {
    /**
     * Enable CORS for all routes
     * This must come before other middleware
     */
    app.use(cors({ origin: true }));

    /**
     * Health check endpoint for Render
     */
    app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    /**
     * Use @colyseus/monitor
     * It is recommended to protect this route with a password
     * Read more: https://docs.colyseus.io/tools/monitoring/#restrict-access-to-the-panel-using-a-password
     */
    app.use('/monitor', monitor());

    /**
     * Use @colyseus/playground
     * (It is not recommended to expose this route in a production environment)
     */
    if (process.env.NODE_ENV !== 'production') {
      app.use('/', playground());
    }
  },
});
