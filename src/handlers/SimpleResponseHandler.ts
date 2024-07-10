import { ResponseHandler } from './ResponseHandler';
import { MessageHandler } from './MessageHandler';
import { Logger } from 'winston';
import { Util } from '../utils/Util';

export class SimpleResponseHandler implements ResponseHandler {
  private messageHandler: MessageHandler;
  private responses: { question: string, answer: string }[];
  private logger: Logger;
  private similarityThreshold: number;

  constructor(messageHandler: MessageHandler, responses: { question: string, answer: string }[], logger: Logger, similarityThreshold: number = 70) {
    this.messageHandler = messageHandler;
    this.responses = responses;
    this.logger = logger;
    this.similarityThreshold = similarityThreshold;
  }

  public async handle(messageData: { messageText: string, dataId: string }): Promise<void> {
    this.logger.info(`Handling message: ${messageData.messageText}`);

    let bestMatch = null;
    let highestSimilarity = 0;

    for (const response of this.responses) {
      const similarity = Util.calculateSimilarity(messageData.messageText, response.question);
      this.logger.info(`Similarity between "${messageData.messageText}" and "${response.question}": ${similarity}%`);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = response;
      }
    }

    if (bestMatch && highestSimilarity >= this.similarityThreshold) {
      this.logger.info(`Found response: ${bestMatch.answer}`);
      await this.messageHandler.sendMessageToContact(bestMatch.answer);
    } else {
      this.logger.info(`No suitable response found for: ${messageData.messageText}`);
    }
  }
}
