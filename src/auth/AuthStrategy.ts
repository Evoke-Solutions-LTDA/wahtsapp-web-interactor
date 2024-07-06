import { Page } from 'puppeteer';

/**
 * Base class for authentication strategies.
 * Provides a template for different authentication methods.
 */
export abstract class AuthStrategy {
  /**
   * Initializes the authentication strategy.
   * Should be implemented by subclasses.
   */
  public abstract initialize(page?: Page): Promise<void>;

  /**
   * Cleans up any resources used by the authentication strategy.
   * Should be implemented by subclasses.
   */
  public abstract cleanup(): Promise<void>;

  /**
   * Retrieves the authentication status.
   * @returns boolean indicating if authenticated.
   */
  public abstract isAuthenticated(): boolean;

  /**
   * Save session data.
   * Should be implemented by subclasses.
   */
  public abstract saveSession(page: Page): Promise<void>;
}
