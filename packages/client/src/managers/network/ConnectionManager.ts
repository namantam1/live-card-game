import { Client } from '@colyseus/sdk';

/**
 * ConnectionManager - Handles basic server connection lifecycle
 * Single Responsibility: Manage connection to Colyseus server
 */
export default class ConnectionManager {
  private client: Client | null = null;
  private connected: boolean = false;
  private serverUrl: string | null = null;

  /**
   * Connect to the Colyseus server
   */
  async connect(serverUrl: string): Promise<boolean> {
    try {
      this.client = new Client(serverUrl);
      this.connected = true;
      this.serverUrl = serverUrl;
      return true;
    } catch (error) {
      console.error('ConnectionManager: Connection failed', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.client = null;
    this.connected = false;
    this.serverUrl = null;
  }

  /**
   * Check if connected to the server
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Get the Colyseus client instance
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Get the server URL
   */
  getServerUrl(): string | null {
    return this.serverUrl;
  }
}
