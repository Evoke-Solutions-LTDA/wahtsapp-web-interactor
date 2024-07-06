import createWinstonLogger from '../logger/Logger';
import { EventEmitter } from 'events';
import puppeteer, { Page, Browser } from 'puppeteer';
import { Constants } from '../utils/Constants';
import { QRHandler } from '../handlers/QRHandler';
import { ConnectionHandler } from '../handlers/ConnectionHandler';
import { Util } from '../utils/Util';
import { ClientConfig } from './ClientConfig';

/**
 * Class representing a WhatsApp Web client.
 */
export class Client extends EventEmitter {
  private config: ClientConfig;
  private logger: ReturnType<typeof createWinstonLogger>;
  private browser?: Browser;
  public page?: Page;
  public isReady: boolean = false;
  public qrHandler: QRHandler;
  private connectionHandler: ConnectionHandler;

  constructor(config: ClientConfig, private userId: string, private workerId: string) {
    super();
    this.config = config;
    this.logger = createWinstonLogger(config.debug || false);
    this.qrHandler = new QRHandler(this);
    this.connectionHandler = new ConnectionHandler(this, config.checkInterval || 10000, config.maxAttempts || 12);
  }

  /**
   * Initialize the WhatsApp client.
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing WhatsApp client...');
    await this.launchBrowser();
    if (this.page) {
      this.config.authStrategy.initialize(this.page)
        .then(async () => {
          if (!this.config.authStrategy.isAuthenticated()) {
            await this.qrHandler.checkQRAndInitialize();
            await this.connectionHandler.waitForConnection();
            await this.config.authStrategy.saveSession(this.page!);
          } else {
            this.logger.info('Authenticated using saved session.');
            this.emit('ready');
          }
          await this.connectionHandler.monitorDisconnection();
        })
        .catch(error => this.logger.error(`Error during initialization: ${error.message}`));
    }
  }

  /**
   * Launch the browser and navigate to WhatsApp Web.
   */
  private async launchBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: false,
      userDataDir: `./user_data/${this.userId}/${this.workerId}`, // Diretório para armazenar dados do navegador por usuário e worker
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36');
    await this.page.goto(Constants.WHATSAPP_WEB_URL, { waitUntil: 'networkidle2' });
  }

  /**
   * Send a message to a contact or group.
   * @param to - The recipient ID.
   * @param message - The message to send.
   */
  public async sendMessage(to: string, message: string): Promise<void> {
    this.logger.info(`Sending message to ${to}: ${message}`);
    // Implement message sending logic
  }

  /**
   * Clean up resources.
   */
  public async cleanup(): Promise<void> {
    this.logger.info('Cleaning up resources...');
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
      if (this.browser && this.browser.isConnected()) {
        await this.browser.close();
      }
    } catch (error: any) {
      this.logger.error(`Error during cleanup: ${error.message}`);
    }
    await this.config.authStrategy.cleanup();
  }

  /**
   * Check if the page is active and not closed.
   */
  public async isPageActive(): Promise<boolean> {
    return Util.isPageActive(this.page, this.logger);
  }

  /**
   * Get the logger instance.
   */
  public getLogger(): ReturnType<typeof createWinstonLogger> {
    return this.logger;
  }
}
