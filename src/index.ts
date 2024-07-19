// src/index.ts
import { WorkerManager } from './client/WorkerManager';
import { RemoteAuth } from './auth/RemoteAuth';
import { SimpleResponseHandler } from './handlers/SimpleResponseHandler';
import { IncomingMessageHandler } from './handlers/IncomingMessageHandler';
import { MessageHandler } from './handlers/MessageHandler';
import { Util } from './utils/Util';
import fs from 'fs';

// Configuração do cliente
const userId = 'user123';
const synonymsFilePath = 'synonyms.json';

// Carrega os sinônimos do arquivo JSON
let synonyms = {};
if (fs.existsSync(synonymsFilePath)) {
  synonyms = JSON.parse(fs.readFileSync(synonymsFilePath, 'utf-8'));
}

// Define os sinônimos na classe Util
Util.setSynonyms(synonyms);

const config: any = {
  debug: true,
  authStrategy: RemoteAuth,
  workerCount: 1, // Quantidade de workers
  similarityThreshold: 60 // Define a porcentagem de similaridade
};

// Inicializa o gerenciador de workers
const workerManager = new WorkerManager(config, userId);

(async () => {
  for (let i = 0; i < config.workerCount; i++) {
    const client = workerManager.getClients()[i];
    const logger = client.getLogger();
    const incomingMessageHandler = client['incomingMessageHandler'];

    if (!incomingMessageHandler) {
      logger.error('IncomingMessageHandler is not initialized in the client.');
      continue;
    }

    // Registrar perguntas e respostas
    const responses = [
      { question: 'Olá', answer: 'Olá, como posso ajudar?' },
      { question: 'Quem é você?', answer: 'Eu sou o Bot Líder, como posso ajudar?' }
    ];
    const messageHandler = new MessageHandler(client);
    const responseHandler = new SimpleResponseHandler(messageHandler, responses, logger, config.similarityThreshold);

    // Adiciona o handler de resposta ao IncomingMessageHandler
    logger.info('Adicionando ResponseHandler');
    incomingMessageHandler.addResponseHandler(responseHandler);
    logger.info(`Registered response handler with ${responses.length} responses.`);

    client.on('qr', (qrCode: string) => {
      logger.info(`Worker ${i + 1} QR Code received: ${qrCode}`);
    });

    client.on('auth_failed', () => {
      logger.info(`Worker ${i + 1} authentication failed`);
    });

    client.on('authenticated', () => {
      logger.info(`Worker ${i + 1} is authenticated`);
    });

    client.on('incomingMessage', async (data: any) => {
      logger.info(`Incoming message data: ${JSON.stringify(data)}`);
      // Não é necessário fazer nada aqui, a fila é processada no IncomingMessageHandler
    });

    client.on('ready', async () => {
      logger.info(`Worker ${i + 1} is ready!`);

      // Initialize the next worker if there is one
      if (i + 1 < config.workerCount) {
        const nextClient = workerManager.getClients()[i + 1];
        await nextClient.initialize();
      }

      // Enviar mensagens em massa quando o cliente estiver pronto
      const contactsWithMessagesAndImages = [
        { contact: '+5547984043591', message: 'Olá, isso é uma mensagem de teste.', imageUrl: 'https://imgur.com/cDH5YxZ.png', option: 'textWithImage' },
        { contact: '+5551990115310', message: 'Olá, esta é outra mensagem de teste.',imageUrl: 'https://imgur.com/cDH5YxZ.png', option: 'textThenImage' },
        { contact: '+5547984043591', message: 'Olá, mais uma mensagem de teste.', imageUrl: 'https://imgur.com/cDH5YxZ.png', option: 'imageThenText' }
      ];

      await messageHandler.sendBulkMessagesToContacts(contactsWithMessagesAndImages);
    });

    // Adicionar logs antes de inicializar o cliente
    logger.info(`Initializing worker ${i + 1}`);
    await client.initialize();
  }
})();
