import { AuthStrategy } from './AuthStrategy';
import { SessionManager } from './SessionManager';
import { Page } from 'puppeteer';

export class RemoteAuth extends AuthStrategy {
  private sessionManager: SessionManager;
  private page: Page | null = null;
  private session: any = null;

  constructor(userId: string, workerId: string) {
    super();
    this.sessionManager = new SessionManager(userId, workerId);
  }

  public async initialize(page: Page): Promise<void> {
    this.page = page;
    this.session = await this.sessionManager.loadSession();
    if (this.session && this.session.cookies && this.session.localStorage) {
      await this.loadSession();
    }
  }

  public async cleanup(): Promise<void> {
    if (this.page) {
      await this.sessionManager.saveSession(await this.getSession(this.page));
    }
  }

  public isAuthenticated(): boolean {
    return !!(this.session && this.session.cookies && this.session.localStorage);
  }

  public async saveSession(page: Page): Promise<void> {
    await this.sessionManager.saveSession(await this.getSession(page));
  }

  private async getSession(page: Page): Promise<any> {
    const cookies = await page.cookies();
    const localStorage = await page.evaluate(() => {
      const json: { [key: string]: string | null } = {};
      const storage = window.localStorage;
      if (storage) {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) {
            const value = storage.getItem(key);
            json[key] = value !== null ? value : '';
          }
        }
      }
      return json;
    });
    return { cookies, localStorage };
  }

  private async loadSession(): Promise<void> {
    if (!this.page || !this.session) return;
    const { cookies, localStorage } = this.session;

    await this.page.setCookie(...cookies);
    await this.page.evaluate((data) => {
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          localStorage.setItem(key, data[key]);
        }
      }
    }, localStorage);
  }
}
