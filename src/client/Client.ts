import createWinstonLogger from '../logger/Logger';
import { EventEmitter } from 'events';
import puppeteer, { Page, Browser } from 'puppeteer';
import { Constants } from '../utils/Constants';
import { ConnectionHandler } from '../handlers/ConnectionHandler';
import { Util } from '../utils/Util';
import { ClientConfig } from './ClientConfig';
import { SessionManager } from '../auth/SessionManager';
import path from 'path';
import fs from 'fs/promises';
import { QRHandler } from '../handlers/QRHandler';
import { IncomingMessageHandler } from '../handlers/IncomingMessageHandler';

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
  private sessionManager: SessionManager;
  private incomingMessageHandler: IncomingMessageHandler;

  constructor(config: ClientConfig, private userId: string, private workerId: string) {
    super();
    this.config = config;
    this.logger = createWinstonLogger(config.debug || false);
    this.qrHandler = new QRHandler(this);
    this.connectionHandler = new ConnectionHandler(this, config.checkInterval || 10000, config.maxAttempts || 12);
    this.sessionManager = new SessionManager(userId, workerId);
    this.incomingMessageHandler = new IncomingMessageHandler(this);
  }

  /**
   * Initialize the WhatsApp client.
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing WhatsApp client...');
    await this.launchBrowser();
    if (this.page) {
      this.incomingMessageHandler.initialize();
      this.config.authStrategy.initialize(this.page)
        .then(async () => {
          if (!this.config.authStrategy.isAuthenticated()) {
            await this.qrHandler.checkQRAndInitialize();
            await this.connectionHandler.waitForConnection();
            await this.config.authStrategy.saveSession(this.page!);
            this.emit('authenticated');
          } else {
            this.logger.info('Authenticated using saved session.');
            this.emit('authenticated');
          }
          await this.connectionHandler.monitorDisconnection();
          this.emit('ready');
        })
        .catch(error => this.logger.error(`Error during initialization: ${error.message}`));
    }
  }

  /**
   * Launch the browser and navigate to WhatsApp Web.
   */
  private async launchBrowser(): Promise<void> {
    const userDataDir = path.join('data/user_data', this.userId, this.workerId);
    await fs.mkdir(userDataDir, { recursive: true });

    this.browser = await puppeteer.launch({
      headless: false,
      userDataDir, // Diretório para armazenar dados do navegador por usuário e worker
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
        this.logger.info('Closing page...');
        await this.page.close();
        this.logger.info('Page closed.');
      }
      if (this.browser && this.browser.isConnected()) {
        this.logger.info('Closing browser...');
        await this.browser.close();
        this.logger.info('Browser closed.');
      }
    } catch (error: any) {
      this.logger.error(`Error during cleanup: ${error.message}`);
    }
    this.logger.info('Auth strategy cleanup done.');
    Promise.resolve()
  }

  /**
   * Disconnect the client and remove session data.
   */
  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting and removing session data...');
    await this.cleanup(); // Fechar recursos primeiro

    this.logger.info('Cleanup done.');

    // Esperar um pouco para garantir que os arquivos estejam liberados
    await new Promise(resolve => setTimeout(resolve, 5000));

    this.logger.info('Waiting period done.');

    await this.sessionManager.removeSession();
    const userDataDir = path.join('data/user_data', this.userId, this.workerId);
    try {
      await fs.rm(userDataDir, { recursive: true, force: true });
      this.logger.info(`User data directory ${userDataDir} removed.`);
    } catch (error: any) {
      this.logger.error(`Error removing user data directory ${userDataDir}: ${error.message}`);
    }
    this.emit('disconnected');
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
