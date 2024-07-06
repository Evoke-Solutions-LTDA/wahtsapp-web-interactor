import { WorkerManager } from './client/WorkerManager';
import { RemoteAuth } from './auth/RemoteAuth';
import { QRCodeHandler } from './handlers/QRCodeHandler';
import { MessageHandler } from './handlers/MessageHandler';

// Configuração do cliente
const userId = 'user124';
const config:any = {
  debug: true,
  authStrategy: RemoteAuth,
  workerCount: 4 // Quantidade de workers
};

// Inicializa o gerenciador de workers
const workerManager = new WorkerManager(config, userId);

workerManager.initializeAll().then(() => {
  workerManager.getClients().forEach((client, index) => {
    const qrCodeHandler = new QRCodeHandler(client);
    const messageHandler = new MessageHandler(client);
    const logger = client.getLogger();

    client.on('qr', (qrCode: string) => {
      logger.info(`Worker ${index + 1} QR Code received: ${qrCode}`);
      qrCodeHandler.displayQRCode(qrCode);
    });

    client.on('auth_failed', () => {
      console.log(`Worker ${index + 1} authentication failed`);
    });

    client.on('ready', () => {
      logger.info(`Worker ${index + 1} is ready!`);

      // Enviando uma mensagem de exemplo após o cliente estar pronto
      messageHandler.sendMessage('1234567890@c.us', 'Olá, mundo!');
    });

    client.on('message', (message: string) => {
      messageHandler.handleMessage(message);
    });
  });
});
