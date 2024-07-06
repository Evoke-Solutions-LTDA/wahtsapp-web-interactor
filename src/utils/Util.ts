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

  /**
   * Calculate the Levenshtein distance between two strings.
   * @param a - The first string.
   * @param b - The second string.
   * @returns The Levenshtein distance between the two strings.
   */
  public static calculateLevenshteinDistance(a: string, b: string): number {
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= bn; i++) {
      matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= an; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= bn; i++) {
      for (let j = 1; j <= an; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
            Math.min(matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1)); // deletion
        }
      }
    }

    return matrix[bn][an];
  }
}
