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

    client.on('incomingMessage', (data: any) => {
      logger.info(data);

      messageHandler.sendMessageToContact('Olá, meu nome é Bot Lider e essa é uma resposta automática de teste')

      // messageHandler.searchAndSendMessage(data.phoneNumber, 'ola testando mensagem')
      
    });

    client.on('ready', async () => {
      logger.info(`Worker ${i + 1} is ready!`);

      // Initialize the next worker if there is one
      if (i + 1 < config.workerCount) {
        const nextClient = workerManager.getClients()[i + 1];
        await nextClient.initialize();
      }


      // // Lista de contatos para enviar mensagens em massa
      // const contacts = [
      //   '+55 47 98404-3591',
      // ];

      // // Mensagem a ser enviada
      // const message = 'Olá, esta é uma mensagem automatizada de teste do bot lider!';
      // const delay = 3000; // 5 segundos de atraso entre as mensagens

      // // Enviando mensagens em massa após o cliente estar pronto
      // await messageHandler.sendBulkMessages(contacts, message, delay);
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
