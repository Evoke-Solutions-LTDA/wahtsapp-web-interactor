import { WorkerManager } from './client/WorkerManager';
import { RemoteAuth } from './auth/RemoteAuth';
import { MessageHandler } from './handlers/MessageHandler';
import { QRCodeHandler } from './handlers/QRCodeHandler';

// Configuração do cliente
const userId = 'user123';
const config: any = {
  debug: true,
  authStrategy: RemoteAuth,
  workerCount: 2 // Quantidade de workers
};

// Inicializa o gerenciador de workers
const workerManager = new WorkerManager(config, userId);

(async () => {
  for (let i = 0; i < config.workerCount; i++) {
    const client = workerManager.getClients()[i];
    const messageHandler = new MessageHandler(client);
    const qrCodeHandler = new QRCodeHandler(client);
    const logger = client.getLogger();

    client.on('qr', (qrCode: string) => {
      logger.info(`Worker ${i + 1} QR Code received: ${qrCode}`);
      qrCodeHandler.displayQRCode(qrCode);
    });

    client.on('auth_failed', () => {
      logger.info(`Worker ${i + 1} authentication failed`);
    });

    client.on('ready', () => {
      logger.info(`Worker ${i + 1} is ready!`);

      // Enviando uma mensagem de exemplo após o cliente estar pronto
      messageHandler.sendMessage('1234567890@c.us', 'Olá, mundo!');

      // Initialize the next worker if there is one
      if (i + 1 < config.workerCount) {
        const nextClient = workerManager.getClients()[i + 1];
        nextClient.initialize();
      }
    });

    client.on('message', (message: string) => {
      messageHandler.handleMessage(message);
    });

    // Start the first worker
    if (i === 0) {
      await client.initialize();
    }
  }
})();
