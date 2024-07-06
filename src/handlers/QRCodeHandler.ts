import { Client } from '../client/Client';
import qrcode from 'qrcode-terminal';

/**
 * Handles QR code generation and display.
 */
export class QRCodeHandler {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Display the QR code in the terminal.
   * @param qrCode - The QR code string.
   */
  public displayQRCode(qrCode: string): void {
    qrcode.generate(qrCode, { small: true });
  }
}
