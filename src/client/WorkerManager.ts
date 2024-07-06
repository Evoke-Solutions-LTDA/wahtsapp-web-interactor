import { Client } from './Client';
import { ClientConfig } from './ClientConfig';
import { RemoteAuth } from '../auth/RemoteAuth';

export class WorkerManager {
  private clients: Client[] = [];
  private config: ClientConfig;
  private workerCount: number;
  private userId: string;

  constructor(config: ClientConfig, userId: string) {
    this.config = config;
    this.userId = userId;
    this.workerCount = config.workerCount || 1;

    for (let i = 0; i < this.workerCount; i++) {
      const workerConfig = { ...this.config, authStrategy: new RemoteAuth(userId, `worker${i}`) };
      const client = new Client(workerConfig, userId, `worker${i}`);
      this.clients.push(client);
    }
  }

  public async initializeAllSequentially(): Promise<void> {
    for (let i = 0; i < this.clients.length; i++) {
      await this.initializeWorker(this.clients[i], i);
    }
  }

  private async initializeWorker(client: Client, index: number): Promise<void> {
    console.log(`Initializing worker ${index + 1}`);
    await client.initialize();
  }

  public getClients(): Client[] {
    return this.clients;
  }
}
