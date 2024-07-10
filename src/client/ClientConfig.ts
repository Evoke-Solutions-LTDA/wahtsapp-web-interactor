import { AuthStrategy } from '../auth/AuthStrategy';

/**
 * Configuration options for the WhatsApp client.
 */
export interface ClientConfig {
  authStrategy: AuthStrategy;
  debug?: boolean;
  checkInterval?: number;
  maxAttempts?: number;
  workerCount?: number;
  synonymsFilePath?: string;
  similarityThreshold?: number;
}
