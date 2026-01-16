import { SyncResult } from './sync-result.interface';

/**
 * Base interface for all integration providers
 * Each provider (GitHub, Gmail, Drive) must implement this interface
 */
export interface IntegrationProvider {
  /**
   * Get the provider name (e.g., 'github', 'gmail', 'google-drive')
   */
  getProviderName(): string;

  /**
   * Sync data from the external provider
   * @param config - Configuration including OAuth tokens, repos, labels, etc.
   * @returns SyncResult with fetched items
   */
  sync(config: any): Promise<SyncResult>;

  /**
   * Test connection to the provider (health check)
   * @param config - Configuration to test
   * @returns true if connection successful, false otherwise
   */
  testConnection(config: any): Promise<boolean>;

  /**
   * Validate configuration schema
   * @param config - Configuration to validate
   * @returns true if valid, false otherwise
   */
  validateConfig(config: any): boolean;
}
