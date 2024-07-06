/**
 * Represents a message in WhatsApp.
 */
export class Message {
  public id: string;
  public from: string;
  public to: string;
  public content: string;

  constructor(id: string, from: string, to: string, content: string) {
    this.id = id;
    this.from = from;
    this.to = to;
    this.content = content;
  }
}
