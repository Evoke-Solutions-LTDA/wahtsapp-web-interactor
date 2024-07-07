import { promises as fs } from 'fs';
import path from 'path';

export class SessionManager {
  private sessionDir: string;
  private sessionFile: string;
  private localStorageFile: string;

  constructor(userId: string, workerId: string, sessionDir: string = 'data/sessions') {
    this.sessionDir = path.join(sessionDir, userId, workerId);
    this.sessionFile = path.join(this.sessionDir, 'session.json');
    this.localStorageFile = path.join(this.sessionDir, 'localStorage.json');
    this.ensureDirectoryExistence(this.sessionDir);
  }

  /**
   * Save session data to a file.
   * @param session - The session data to save.
   */
  public async saveSession(session: any): Promise<void> {
    try {
      await fs.writeFile(this.sessionFile, JSON.stringify(session.cookies, null, 2));
      await fs.writeFile(this.localStorageFile, JSON.stringify(session.localStorage, null, 2));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  /**
   * Load session data from a file.
   * @returns The loaded session data or null if not found.
   */
  public async loadSession(): Promise<any> {
    try {
      const cookies = await fs.readFile(this.sessionFile, 'utf-8');
      const localStorage = await fs.readFile(this.localStorageFile, 'utf-8');
      return { cookies: JSON.parse(cookies), localStorage: JSON.parse(localStorage) };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn('Session files not found, starting with a new session.');
        return null;
      }
      console.error('Error loading session:', error);
      return null;
    }
  }

  /**
   * Ensure the directory exists, create it if it doesn't.
   * @param dir - The directory path.
   */
  private async ensureDirectoryExistence(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Error creating directory ${dir}:`, error);
    }
  }

  /**
   * Remove session data.
   */
  public async removeSession(): Promise<void> {
    try {
      await fs.rm(this.sessionDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error removing session directory ${this.sessionDir}:`, error);
    }
  }
}
