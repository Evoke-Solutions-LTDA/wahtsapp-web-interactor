import { Client } from '../client/Client';
import { Constants } from '../utils/Constants';
import { Message } from '../structures/Message';

export class IncomingMessageHandler {
  private client: Client;
  private logger: ReturnType<typeof import('../logger/Logger').default>;

  constructor(client: Client) {
    this.client = client;
    this.logger = client.getLogger();
  }

  public async initialize(): Promise<void> {
    const page = this.client.page;
    if (!page) throw new Error('Page is not initialized');

    const readySelector = Constants.READY_SELECTOR;

    await page.waitForSelector(readySelector, { timeout: 60000 });

    this.logger.info('Setting up IncomingMessageHandler...');

    await page.exposeFunction('onIncomingMessageMutation', async (mutations: any[]) => {
      this.logger.debug(`Mutation records received: ${mutations.length}`);

      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target && (mutation.target as CharacterData).data) {
          const target = mutation.target as CharacterData;
          const parentElement = target.parentElement;

          if (parentElement && parentElement.outerHTML) {
            const outerHTML = parentElement.outerHTML;
            this.logger.debug(`Character data changed in element: ${outerHTML}`);

            const ariaLabelMatch = outerHTML.match(/aria-label="([^"]+)"/);
            const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : null;

            console.log('ariaLabel', ariaLabel)

            if (ariaLabel) {
              await page.evaluate((ariaLabel) => {
                const element = document.querySelector(`[aria-label="${ariaLabel}"]`);
                if (element) {
                  (window as any).elementSelector = `[aria-label="${ariaLabel}"]`;
                }
              }, ariaLabel);

              await page.click(`[aria-label="${ariaLabel}"]`);
            }
          }

          
        }

        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              const element = node as HTMLElement;
              this.logger.debug(`Child node added: ${element.outerHTML}`);

              const message = this.extractMessage(element);
              if (message) {
                this.client.emit('message_received', message);
                this.logger.info(`New message received from ${message.from}: ${message.content}`);
              } else {
                const ariaLabel = element.getAttribute('aria-label');
                if (ariaLabel) {
                  await page.evaluate((ariaLabel) => {
                    const element = document.querySelector(`[aria-label="${ariaLabel}"]`);
                    if (element) {
                      (window as any).elementSelector = `[aria-label="${ariaLabel}"]`;
                    }
                  }, ariaLabel);

                  await page.click(`[aria-label="${ariaLabel}"]`);
                }
              }
            }
          }
        }
      }
    });

    await page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        (window as any).onIncomingMessageMutation(mutations.map(mutation => {
          console.log('mutation', mutation)
          const target = mutation.target && mutation.target.nodeType === 3 ? mutation.target as CharacterData : null;
          return {
            type: mutation.type,
            addedNodes: [...mutation.addedNodes].map(node => node instanceof Element ? node.outerHTML : ''),
            target: target ? {
              data: target.data,
              parentElement: target.parentElement && target.parentElement.outerHTML ? {
                outerHTML: target.parentElement.outerHTML
              } : null
            } : null
          };
        }));
      });

      const paneSide = document.querySelector('div[aria-label="Lista de conversas"]');
      if (paneSide) {
        observer.observe(paneSide, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      } else {
        console.error('Element with aria-label "Lista de conversas" not found.');
      }

      console.log('IncomingMessageHandler MutationObserver set up');
    });

    this.logger.info('IncomingMessageHandler setup complete.');
  }

  private extractMessage(element: HTMLElement): Message | null {
    this.logger.debug('Extracting message from element.');
    try {
      const messageId = element.getAttribute('data-id');
      const from = element.querySelector(Constants.MESSAGE_FROM_SELECTOR)?.textContent;
      const content = element.querySelector(Constants.MESSAGE_CONTENT_SELECTOR)?.textContent;
      if (messageId && from && content) {
        this.logger.debug(`Message extracted successfully: id=${messageId}, from=${from}`);
        return new Message(messageId, from, '', content);
      } else {
        this.logger.debug('Message extraction failed: Missing id, from, or content.');
      }
    } catch (error: any) {
      this.logger.error(`Failed to extract message: ${error.message}`);
    }
    return null;
  }
}
