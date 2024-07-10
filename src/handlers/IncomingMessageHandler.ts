// src/handlers/IncomingMessageHandler.ts
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
  private messageQueue: { messageText: string, phoneNumber: string, dataId: string }[] = [];
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
              await page.evaluate((ariaLabel) => {
                const element = document.querySelector(`[aria-label="${ariaLabel}"]`);
                if (element) {
                  (window as any).elementSelector = `[aria-label="${ariaLabel}"]`;
                }
              }, ariaLabel);

              await page.click(`[aria-label="${ariaLabel}"]`);
            }
          }

        } else if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            const element = node as HTMLElement;

            if (element.outerHTML) {
              const ariaLabelMatch = element.outerHTML.match(/aria-label="([^"]*)"/);
              const ariaLabel = ariaLabelMatch ? ariaLabelMatch[1] : null;

              if (ariaLabel) {
                await page.evaluate((ariaLabel) => {
                  const element = document.querySelector(`[aria-label="${ariaLabel}"]`);
                  if (element) {
                    (window as any).elementSelector = `[aria-label="${ariaLabel}"]`;
                  }

                }, ariaLabel);

                await page.click(`[aria-label="${ariaLabel}"]`);
                await this.extractMessage(page);
                this.logger.debug('Element:', element);
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

  private async extractMessage(page: any): Promise<Message | null> {
    await page.waitForSelector(Constants.MESSAGE_SELECTOR, { timeout: 60000 });
    try {
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
          this.addToQueue(messageData); // Adicionar à fila de mensagens
          this.processedMessages.add(messageData.dataId); // Marcar a mensagem como processada
        }
      }

    } catch (error: any) {
      this.logger.error(`Failed to extract message: ${error.message}`);
    }
    return null;
  }

  private addToQueue(messageData: { messageText: string, phoneNumber: string, dataId: string }) {
    this.logger.info(`Adding message to queue: ${messageData.messageText}`);
    this.messageQueue.push(messageData);
    this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const messageData = this.messageQueue.shift();
      if (messageData) {
        await this.processMessage(messageData);
      }
    }

    this.isProcessing = false;
  }

  private async processMessage(messageData: { messageText: string, dataId: string }) {
    try {
      this.logger.info(`Processing message: ${messageData.messageText}`);
      await this.client.emit('incomingMessage', messageData);

      // Processar os handlers de resposta
      for (const handler of this.responseHandlers) {
        this.logger.info(`Handling with: ${handler.constructor.name}`);
        await handler.handle(messageData);
      }
    } catch (error: any) {
      this.logger.error(`Error processing message ${messageData.dataId}: ${error.message}`);
    } finally {
      // Adicione um pequeno delay entre o processamento das mensagens para evitar problemas de duplicação ou envio rápido demais
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
