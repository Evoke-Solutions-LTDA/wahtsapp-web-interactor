import { exec } from 'child_process';
import { Page } from 'puppeteer';
import { Logger } from 'winston';


/**
 * Utility functions used throughout the application.
 */
export class Util {
  /**
   * Execute a shell command.
   * @param command - The command to execute.
   * @returns A promise that resolves with the command output.
   */
  public static execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout || stderr);
        }
      });
    });
  }

  public static async isPageActive(page?: Page, logger?: Logger): Promise<boolean> {
    try {
      if (page && !page.isClosed()) {
        await page.title(); // Simple operation to check if the page context is still valid
        return true;
      }
    } catch (error: any) {
      logger?.error('Page is not active: ' + error.message);
    }
    return false;
  }


}
