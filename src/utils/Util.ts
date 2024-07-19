import { exec } from 'child_process';
import { Page } from 'puppeteer';
import { Logger } from 'winston';
import stringComparison from 'string-comparison';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

let customSynonyms: { [key: string]: string[] } = {};

/**
 * Utility functions used throughout the application.
 */
export class Util {
  /**
   * Set custom synonyms for normalization.
   * @param synonyms - The custom synonyms to set.
   */
  public static setSynonyms(synonyms: { [key: string]: string[] }) {
    customSynonyms = synonyms;
  }

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
        await page.title();
        return true;
      }
    } catch (error: any) {
      logger?.error('Page is not active: ' + error.message);
    }
    return false;
  }

  /**
   * Normalize a string by removing accents and converting to lowercase.
   * @param str - The string to normalize.
   * @returns The normalized string.
   */
  public static normalizeString(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  /**
   * Replace words in a string with their corresponding synonyms using the custom synonyms dictionary.
   * @param str - The string to process.
   * @returns The string with synonyms replaced.
   */
  public static replaceWithSynonyms(str: string): string {
    const normalizedStr = this.normalizeString(str);
    const words = normalizedStr.split(' ');

    const replacedWords = words.map(word => {
      for (const [key, group] of Object.entries(customSynonyms)) {
        if (group.includes(word)) {
          return key; // Replace with the key representing the synonym group
        }
      }
      return word;
    });

    return replacedWords.join(' ');
  }

  /**
   * Check if two strings are synonyms.
   * @param a - The first string.
   * @param b - The second string.
   * @returns True if the strings are synonyms, false otherwise.
   */
  public static areSynonyms(a: string, b: string): boolean {
    for (const [key, group] of Object.entries(customSynonyms)) {
      if (group.includes(a) && group.includes(b)) {
        return true;
      }
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

  /**
   * Calculate the similarity percentage between two strings using the string-comparison library.
   * If a synonym is found, return 100% similarity.
   * @param a - The first string.
   * @param b - The second string.
   * @returns The similarity percentage between the two strings.
   */
  public static calculateSimilarity(a: string, b: string): number {
    const normalizedA = this.normalizeString(a);
    const normalizedB = this.normalizeString(b);
    if (this.areSynonyms(normalizedA, normalizedB)) {
      return 100; // 100% similarity if any synonym matches
    }

    const replacedA = this.replaceWithSynonyms(normalizedA);
    const replacedB = this.replaceWithSynonyms(normalizedB);

    const levenshtein = stringComparison.levenshtein;
    return levenshtein.similarity(replacedA, replacedB) * 100;
  }

  /**
   * Ensure the directory exists.
   * @param dirPath - The path of the directory.
   */
  public static ensureDirectoryExistence(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Download an image from a URL.
   * @param url - The URL of the image.
   * @param filePath - The path to save the downloaded image.
   * @returns A promise that resolves when the image is downloaded.
   */
  public static async downloadImage(url: string, filePath: string): Promise<void> {
    this.ensureDirectoryExistence(path.dirname(filePath));
    const writer = fs.createWriteStream(filePath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}
