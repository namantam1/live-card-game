import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { CallBreakRoom } from './rooms/CallBreakRoom';

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint for Render
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

const server = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server,
  }),
});

// Register the game room
gameServer.define('call_break', CallBreakRoom);

const PORT = Number(process.env.PORT) || 2567;

gameServer.listen(PORT).then(() => {
  console.log(`🎮 Call Break server running on port ${PORT}`);
});
