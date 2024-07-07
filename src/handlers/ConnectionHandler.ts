import { Client } from '../client/Client';
import { Constants } from '../utils/Constants';

export class ConnectionHandler {
  private client: Client;
  private checkInterval: number;
  private maxAttempts: number;
  private logger: ReturnType<typeof import('../logger/Logger').default>;

  constructor(client: Client, checkInterval: number, maxAttempts: number) {
    this.client = client;
    this.checkInterval = checkInterval;
    this.maxAttempts = maxAttempts;
    this.logger = client.getLogger(); // Pega o logger do client
  }

  /**
   * Wait for the user to scan the QR code and the #pane-side to appear.
   */
  public async waitForConnection(): Promise<void> {
    const page = this.client.page;
    if (!page) throw new Error('Page is not initialized');

    const readySelector = Constants.READY_SELECTOR;
    let attempts = 0;

    while (attempts < this.maxAttempts) {
      attempts++;
      try {
        if (await this.client.isPageActive()) {
          await page.waitForSelector(readySelector, { timeout: this.checkInterval });
          this.client.isReady = true;
          this.client.emit('authenticated');
          this.logger.info('User is authenticated and WhatsApp Web is ready.');
          return;
        }
      } catch (error: any) {
        this.logger.info(`Attempt ${attempts} failed. Retrying...`);
      }
    }
    this.logger.error('Timeout while waiting for user to authenticate.');
    this.client.emit('auth_failed');
    await this.client.cleanup(); // Clean up resources if authentication fails
  }

  /**
   * Monitor the disconnection event.
   */
  public async monitorDisconnection(): Promise<void> {
    const page = this.client.page;
    if (!page) throw new Error('Page is not initialized');

    const qrSelector = Constants.QR_CODE_SELECTOR;

    if (await this.client.isPageActive() && !(await page.evaluate(() => window.hasOwnProperty('onDisconnectionMutation')))) {
      await page.exposeFunction('onDisconnectionMutation', async (mutations: { type: string, addedNodes: string[], removedNodes: string[], targetDatasetRef: string | null, target: string }[]) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.target.includes('Desconectando')) {
            this.client.isReady = false;
            this.client.emit('disconnected');
            this.logger.info('User has been disconnected.');
            await this.client.disconnect();
            await this.client.initialize(); // Reinitialize to show QR code again
            break;
          }
        }
      });
    }

    if (await this.client.isPageActive()) {
      await page.evaluate(() => {
        const observer = new MutationObserver((mutations) => {
          (window as any).onDisconnectionMutation(mutations.map(mutation => {
            return {
              type: mutation.type,
              addedNodes: [...mutation.addedNodes].map(node => node instanceof Element ? node.outerHTML : ''),
              removedNodes: [...mutation.removedNodes].map(node => node instanceof Element ? node.outerHTML : ''),
              targetDatasetRef: (mutation.target as HTMLElement).dataset.ref || null,
              target: (mutation.target as HTMLElement).outerHTML
            };
          }));
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        console.log('Disconnection MutationObserver set up');
      });
    }
  }
}
