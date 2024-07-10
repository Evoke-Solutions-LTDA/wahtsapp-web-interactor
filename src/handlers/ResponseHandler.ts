export interface ResponseHandler {
  handle(messageData: { messageText: string, dataId: string }): Promise<void>;
}