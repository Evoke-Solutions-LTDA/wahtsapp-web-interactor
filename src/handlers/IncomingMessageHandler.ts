import { Client } from '../client/Client';
import { Constants } from '../utils/Constants';
import { Message } from '../structures/Message';
import { EventEmitter } from 'events';
import { MessageHandler } from './MessageHandler';
import { ResponseHandler } from './ResponseHandler';

export class IncomingMessageHandler extends EventEmitter {
  private client: Client;
  private logger: ReturnType<typeof import('../logger/Logger').default>;
  private processedMessages: Set<string>;
  private messageQueue: { ariaLabel: string }[] = [];
  private isProcessing: boolean = false;
  private messageHandler: MessageHandler;
  private responseHandlers: ResponseHandler[] = [];

  constructor(client: Client) {
    super();
    this.client = client;
    this.logger = client.getLogger();
    this.processedMessages = new Set();
    this.messageHandler = new MessageHandler(client);
  }

  public addResponseHandler(handler: ResponseHandler): void {
    this.logger.info(`Adding response handler: ${handler.constructor.name}`);
    this.responseHandlers.push(handler);
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
            const ariaLabelMatch = outerHTML.match(/aria-label="([^"]*)"/);
            const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : null;
            if (ariaLabel) {
              this.addToQueue({ ariaLabel });
            }
          }
        } else if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            const element = node as HTMLElement;
            if (element.outerHTML) {
              const ariaLabelMatch = element.outerHTML.match(/aria-label="([^"]*)"/);
              const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : null;
              if (ariaLabel) {
                this.addToQueue({ ariaLabel });
              }
            }
          }
        }
      }
    });

    await page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        (window as any).onIncomingMessageMutation(mutations.map(mutation => {
          const target = mutation.target && mutation.target.nodeType === 3 ? mutation.target as CharacterData : null;
          return {
            type: mutation.type,
            addedNodes: [...mutation.addedNodes].map(node => {
              const el = node as HTMLElement;
              return {
                outerHTML: el.outerHTML,
                ariaLabel: el.getAttribute('aria-label')
              };
            }),
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

  private addToQueue(messageData: { ariaLabel: string }) {
    this.logger.info(`Adding ariaLabel to queue: ${messageData.ariaLabel}`);
    this.messageQueue.push(messageData);
    this.logger.debug(`Queue length: ${this.messageQueue.length}`);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) return;

    this.logger.info('Starting to process queue...');
    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const messageData = this.messageQueue.shift();
      if (messageData) {
        await this.processMessage(messageData);
      }
    }

    this.isProcessing = false;
    this.logger.info('Finished processing queue.');
  }

  private async processMessage(messageData: { ariaLabel: string }) {
    try {
      this.logger.info(`Processing message for ariaLabel: ${messageData.ariaLabel}`);
      
      await this.client.page?.click(`[aria-label="${messageData.ariaLabel}"]`);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const extractedMessage = await this.extractMessage(this.client.page);
      if (extractedMessage) {
        await this.client.emit('incomingMessage', extractedMessage);

        // Processar os handlers de resposta
        for (const handler of this.responseHandlers) {
          this.logger.info(`Handling with: ${handler.constructor.name}`);
          await handler.handle(extractedMessage);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error processing message for ariaLabel ${messageData.ariaLabel}: ${error.message}`);
    } finally {
      // Adicione um pequeno delay entre o processamento das mensagens para evitar problemas de duplicação ou envio rápido demais
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private async extractMessage(page: any): Promise<{ messageText: string, phoneNumber: string, dataId: string } | null> {
    this.logger.debug(`Extracting message`);
    try {
      await page.waitForSelector(Constants.MESSAGE_SELECTOR, { timeout: 60000 });
      const messageData = await page.evaluate(() => {
        const messages = document.querySelectorAll('.message-in .copyable-text');
        const lastMessageElement = messages[messages.length - 1];
        const messageText = lastMessageElement ? lastMessageElement.textContent : null;

        const focusableItem = lastMessageElement ? lastMessageElement.closest('.focusable-list-item') : null;
        const parentElement = focusableItem ? focusableItem.parentElement : null;
        const dataId = parentElement ? parentElement.getAttribute('data-id') : null;
        const phoneNumber = dataId ? dataId.split('_')[1].split('@')[0] : null;

        return { messageText, phoneNumber, dataId };
      });

      if (messageData && messageData.messageText && messageData.phoneNumber) {
        // Verificar se a mensagem já foi processada
        if (!this.processedMessages.has(messageData.dataId)) {
          this.logger.info(`Extracted message: ${messageData.messageText} from ${messageData.phoneNumber}`);
          this.processedMessages.add(messageData.dataId); // Marcar a mensagem como processada
          return messageData;
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to extract message: ${error.message}`);
    }
    return null;
  }
}
