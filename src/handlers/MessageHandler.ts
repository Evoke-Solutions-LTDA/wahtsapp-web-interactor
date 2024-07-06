import { Client } from '../client/Client';

/**
 * Handles incoming and outgoing messages.
 */
export class MessageHandler {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Send a message.
   * @param to - The recipient ID.
   * @param message - The message to send.
   */
  public async sendMessage(to: string, message: string): Promise<void> {
    await this.client.sendMessage(to, message);
  }

  /**
   * Send multiple messages to a contact or group with delay.
   * @param to - The recipient ID.
   * @param messages - An array of messages to send.
   * @param delay - Delay in milliseconds between messages (default: 3000ms).
   */
  public async sendMessages(to: string, messages: string[], delay: number = 3000): Promise<void> {
    for (const message of messages) {
      await this.sendMessage(to, message);
      await this.delay(delay);
    }
  }

  /**
   * Delay utility function.
   * @param ms - Milliseconds to delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle an incoming message.
   * @param message - The incoming message.
   */
  public handleMessage(message: string): void {
    // Implement message handling logic
    console.log(`Received message: ${message}`);
  }
}
