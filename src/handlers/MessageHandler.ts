import { Client } from '../client/Client';
import { Constants } from '../utils/Constants';
import { ContactHandler } from './ContactHandler';
import { Util } from '../utils/Util';
import path from 'path';

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
   * Send an image.
   * @param to - The recipient ID.
   * @param imageUrl - The URL of the image to send.
   */
  public async sendImage(to: string, imageUrl: string): Promise<void> {
    const imagePath = path.join(__dirname, '..', 'downloads', path.basename(imageUrl));
    await Util.downloadImage(imageUrl, imagePath);

    // Click on the attachment button
    const attachmentButtonSelector = 'div[title="Anexar"]';
    await this.client.page!.waitForSelector(attachmentButtonSelector, { timeout: 30000 });
    await this.client.page!.click(attachmentButtonSelector);

    // Click on the photo/video button
    const photoVideoButtonSelector = 'input[type="file"][accept="image/*,video/mp4,video/3gpp,video/quicktime"]';
    await this.client.page!.waitForSelector(photoVideoButtonSelector, { timeout: 30000 });
    const input = await this.client.page!.$(photoVideoButtonSelector);
    await input?.uploadFile(imagePath);

    // Wait for the image to be loaded
    await this.client.page!.waitForSelector('span[data-icon="send"]', { timeout: 30000 });
    await this.delay(1000);

    // Click on the send button
    await this.client.page!.click('span[data-icon="send"]');
  }

  /**
   * Send a message with an image.
   * @param to - The recipient ID.
   * @param message - The message to send.
   * @param imageUrl - The URL of the image to send.
   */
  public async sendMessageWithImage(to: string, message: string, imageUrl: string): Promise<void> {
    const imagePath = path.join(__dirname, '..', 'downloads', path.basename(imageUrl));
    await Util.downloadImage(imageUrl, imagePath);

    // Click on the attachment button
    const attachmentButtonSelector = 'div[title="Anexar"]';
    await this.client.page!.waitForSelector(attachmentButtonSelector, { timeout: 30000 });
    await this.client.page!.click(attachmentButtonSelector);

    // Click on the photo/video button
    const photoVideoButtonSelector = 'input[type="file"][accept="image/*,video/mp4,video/3gpp,video/quicktime"]';
    await this.client.page!.waitForSelector(photoVideoButtonSelector, { timeout: 30000 });
    const input = await this.client.page!.$(photoVideoButtonSelector);
    await input?.uploadFile(imagePath);

    // Wait for the image to be loaded and the caption input to appear
    await this.client.page!.waitForSelector('div[contenteditable="true"]', { timeout: 30000 });
    await this.delay(1000);

    // Type the message in the caption box
    await this.client.page!.type('div[contenteditable="true"]', message, { delay: 50 });

    // Click on the send button
    await this.client.page!.click('span[data-icon="send"]');
  }

  /**
   * Send an image followed by a message.
   * @param to - The recipient ID.
   * @param imageUrl - The URL of the image to send.
   * @param message - The message to send.
   */
  public async sendImageThenMessage(to: string, imageUrl: string, message: string): Promise<void> {
    await this.sendImage(to, imageUrl);
    await this.sendMessage(to, message);
  }

  /**
   * Send a message followed by an image.
   * @param to - The recipient ID.
   * @param message - The message to send.
   * @param imageUrl - The URL of the image to send.
   */
  public async sendMessageThenImage(to: string, message: string, imageUrl: string): Promise<void> {
    await this.sendMessage(to, message);
    await this.sendImage(to, imageUrl);
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
   * Send bulk messages to multiple contacts with options.
   * @param contactsWithMessages - Array of objects containing contact, message, imageUrl, and option.
   * @param delay - Delay in milliseconds between each message (default: 3000ms).
   */
  public async sendBulkMessagesToContacts(contactsWithMessages: { contact: string, message: string, imageUrl?: string, option?: string }[], delay: number = 3000): Promise<void> {
    for (const { contact, message, imageUrl, option } of contactsWithMessages) {
      try {
        await this.searchAndSendMessage(contact, message);

        if (imageUrl) {
          switch (option) {
            case 'textWithImage':
              await this.sendMessageWithImage(contact, message, imageUrl);
              break;
            case 'textThenImage':
              await this.sendMessageThenImage(contact, message, imageUrl);
              break;
            case 'imageThenText':
              await this.sendImageThenMessage(contact, imageUrl, message);
              break;
            default:
              await this.sendMessageWithImage(contact, message, imageUrl);
              break;
          }
        } else {
          await this.sendMessageToContact(message);
        }

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
      // await this.sendMessageToContact(message);
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
      await this.client.page!.waitForSelector(Constants.MESSAGE_BOX, { timeout: 30000 });
      await this.client.page!.click(Constants.MESSAGE_BOX);
      await this.client.page!.type(Constants.MESSAGE_BOX, message, { delay: 50 });
      await this.client.page!.keyboard.press('Enter');
    } catch (error: any) {
      this.client.getLogger().error(`Error sending message: ${error.message}`);
      throw error;
    }
  }
}
