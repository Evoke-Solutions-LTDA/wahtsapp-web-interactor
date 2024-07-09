import { Client } from '../client/Client';
import { Constants } from '../utils/Constants';
import { ContactHandler } from './ContactHandler';

/**
 * Handles incoming and outgoing messages.
 */
export class MessageHandler {
  private client: Client;
  private contactHandler: ContactHandler;

  constructor(client: Client) {
    this.client = client;
    this.contactHandler = new ContactHandler(client!);
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
   * Send bulk messages to multiple contacts.
   * @param contacts - The list of contacts to send messages to.
   * @param message - The message to send.
   * @param delay - Delay in milliseconds between each message (default: 3000ms).
   */
  public async sendBulkMessages(contacts: string[], message: string, delay: number = 3000): Promise<void> {
    console.log('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    for (const contact of contacts) {
      try {
        await this.searchAndSendMessage(contact, message);
        await this.delay(delay);
      } catch (error: any) {
        this.client.getLogger().error(`Failed to send message to ${contact}: ${error.message}`);
      }
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

  /**
   * Search for a contact and send a message.
   * @param phoneNumber - The phone number to search for.
   * @param message - The message to send.
   */
  public async searchAndSendMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      if (!this.client.page) throw new Error('Page is not initialized');
      await this.contactHandler.searchContact(phoneNumber);

      // Add delay to ensure message box is available
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send the message
      await this.sendMessageToContact(message);
    } catch (error: any) {
      console.error(`Failed to search and send message: ${error.message}`);
    }
  }

  /**
   * Send a message to the contact that has been searched.
   * @param message - The message to send.
   */
  public async sendMessageToContact(message: string, delay: number = 3000): Promise<void> {
    try {
      // Wait for the message box to be available and send the message
      await this.delay(delay);
      await this.client.page!.waitForSelector(Constants.MESSAGE_BOX);
      await this.client.page!.click(Constants.MESSAGE_BOX);
      await this.client.page!.type(Constants.MESSAGE_BOX, message, {delay: 50});
      await this.client.page!.keyboard.press('Enter');
    } catch (error: any) {
      this.client.getLogger().error(`Error sending message: ${error.message}`);
      throw error;
    }
  }
}
