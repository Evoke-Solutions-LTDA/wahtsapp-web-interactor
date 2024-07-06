import { AuthStrategy } from './AuthStrategy';

/**
 * No authentication strategy. Used for development or testing purposes.
 */
export class NoAuth extends AuthStrategy {
  public async initialize(): Promise<void> {
    // No authentication required
  }

  public async cleanup(): Promise<void> {
    // No cleanup required
  }

  public isAuthenticated(): boolean {
    return true; // Always authenticated
  }

  public async saveSession(): Promise<void> {
    // No session to save
  }
}
