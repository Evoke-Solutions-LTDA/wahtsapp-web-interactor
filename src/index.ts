import { WorkerManager } from './client/WorkerManager';
import { RemoteAuth } from './auth/RemoteAuth';
import { MessageHandler } from './handlers/MessageHandler';
import { QRCodeHandler } from './handlers/QRCodeHandler';
import { IncomingMessageHandler } from './handlers/IncomingMessageHandler'; // Novo handler
import { Message } from './structures/Message';

// Configuração do cliente
const userId = 'user123';
const config: any = {
  debug: true,
  authStrategy: RemoteAuth,
  workerCount: 1 // Quantidade de workers
};

// Inicializa o gerenciador de workers
const workerManager = new WorkerManager(config, userId);

(async () => {
  for (let i = 0; i < config.workerCount; i++) {
    const client = workerManager.getClients()[i];
    const messageHandler = new MessageHandler(client);
    const qrCodeHandler = new QRCodeHandler(client);
    const incomingMessageHandler = new IncomingMessageHandler(client); // Novo handler
    const logger = client.getLogger();

    client.on('qr', (qrCode: string) => {
      logger.info(`Worker ${i + 1} QR Code received: ${qrCode}`);
      qrCodeHandler.displayQRCode(qrCode);
    });

    client.on('auth_failed', () => {
      logger.info(`Worker ${i + 1} authentication failed`);
    });

    client.on('authenticated', () => {
      logger.info(`Worker ${i + 1} is authenticated`);
    });

    client.on('ready', async () => {
      logger.info(`Worker ${i + 1} is ready!`);

      // Initialize the next worker if there is one
      if (i + 1 < config.workerCount) {
        const nextClient = workerManager.getClients()[i + 1];
        await nextClient.initialize();
      }
    });

    client.on('message_received', (message: Message) => {
      logger.info(`New message received: ${message.content}`);
      messageHandler.handleMessage(message.content);
    });

    // Start the first worker
    if (i === 0) {
      await client.initialize();
    }
  }
})();
