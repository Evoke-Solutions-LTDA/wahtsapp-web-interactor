
import { Client } from '../client/Client';
import { Constants } from '../utils/Constants';

export class QRHandler {
  private client: Client;
  private logger: ReturnType<typeof import('../logger/Logger').default>;

  constructor(client: Client) {
    this.client = client;
    this.logger = client.getLogger(); // Pega o logger do client
  }

  /**
   * Check for QR code updates.
   */
  public async checkQRAndInitialize(): Promise<void> {
    const page = this.client.page;
    if (!page) throw new Error('Page is not initialized');

    const qrSelector = Constants.QR_CODE_SELECTOR;

    const captureQRCode = async () => {
      try {
        if (await this.client.isPageActive() && !this.client.isReady) {
          const qrCodeElement = await page.$(qrSelector);
          if (qrCodeElement) {
            const qrCodeData = await qrCodeElement.evaluate(el => el.getAttribute('data-ref'));
            if (qrCodeData) {
              this.client.emit('qr', qrCodeData);
            }
          }
        }
      } catch (error: any) {
        this.logger.error(`Error capturing QR code: ${error.message}`);
      }
    };

    await page.waitForSelector(qrSelector, { timeout: 60000 }).catch(() => {
      this.logger.error('QR code element not found in time');
    });
    await captureQRCode();

    if (await this.client.isPageActive() && !(await page.evaluate(() => window.hasOwnProperty('onMutation')))) {
      await page.exposeFunction('onMutation', (mutations: MutationRecord[]) => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'data-ref' && !this.client.isReady) {
            captureQRCode();
          }
        }
      });
    }

    if (await this.client.isPageActive()) {
      await page.evaluate(() => {
        const observer = new MutationObserver((mutations) => {
          (window as any).onMutation(mutations.map(mutation => {
            return {
              type: mutation.type,
              attributeName: mutation.attributeName,
              addedNodes: [...mutation.addedNodes].map(node => node instanceof Element ? node.outerHTML : ''),
              removedNodes: [...mutation.removedNodes].map(node => node instanceof Element ? node.outerHTML : ''),
              targetDatasetRef: (mutation.target as HTMLElement).dataset.ref || null
            };
          }));
        });
        const querySelector = document.querySelector('div[data-ref]');
        if (querySelector) {
          observer.observe(querySelector as HTMLElement, {
            attributes: true,
            subtree: true,
            attributeFilter: ['data-ref']
          });
        }
        return observer;
      });
    }
  }
}
