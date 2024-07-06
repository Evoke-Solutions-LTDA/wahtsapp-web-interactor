import { Constants } from '../utils/Constants';
import { Logger } from 'winston';
import createWinstonLogger from '../logger/Logger';
import { Client } from '../client/Client';
import { Util } from '../utils/Util';

/**
 * Handles searching for a contact in WhatsApp Web.
 */
export class ContactHandler {
  private client: Client;
  private logger: Logger;

  constructor(client: Client) {
    this.client = client;
    this.logger = createWinstonLogger(true);
  }

  /**
   * Search for a contact by phone number.
   * @param phoneNumber - The phone number to search for.
   */
  public async searchContact(phoneNumber: string): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 5000));
      this.logger.info(`Searching for contact: ${phoneNumber}`);

      // Ensure page is initialized
      if (!this.client.page) throw new Error('Page is not initialized');

      // Click on "New Chat" button
      await this.client.page.waitForSelector(Constants.NEW_CHAT_BUTTON);
      await this.client.page.click(Constants.NEW_CHAT_BUTTON);

      // Wait for and type in the search box
      await this.client.page.waitForSelector(Constants.SEARCH_BOX);
      await this.client.page.type(Constants.SEARCH_BOX, phoneNumber);

      // Add delay to ensure search results appear
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get all contact elements in the search results
      const contacts = await this.client.page.$$('div[role="button"] span[title]');
      if (contacts.length === 0) {
        throw new Error('No contacts found');
      }

      let bestMatch = null;
      let bestMatchScore = Infinity;

      // Iterate over contacts to find the best match
      for (const contact of contacts) {
        const contactTitle = await contact.evaluate(el => el.getAttribute('title'));
        if (contactTitle) {
          const score = Util.calculateLevenshteinDistance(phoneNumber, contactTitle);
          if (score < bestMatchScore) {
            bestMatch = contact;
            bestMatchScore = score;
          }
        }
      }

      if (bestMatch) {
        await bestMatch.click();
      } else {
        throw new Error('No matching contact found');
      }

    } catch (error: any) {
      this.logger.error(`Error searching for contact: ${error.message}`);
      throw error;
    }
  }
}
