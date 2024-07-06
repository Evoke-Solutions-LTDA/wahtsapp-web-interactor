/**
 * Represents a chat in WhatsApp.
 */
export class Chat {
  public id: string;
  public name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}
