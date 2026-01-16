/**
 * Represents a single item fetched from an external provider
 */
export interface SyncedItem {
  /** Unique ID in the external provider (e.g., 'owner/repo/README.md', 'message-id-123') */
  externalId: string;

  /** Type of item: 'file', 'commit', 'email', 'document', 'issue', 'pull_request', etc. */
  itemType: string;

  /** Title or name of the item */
  title: string;

  /** Description or summary (optional) */
  description?: string;

  /** URL to view the item in the external provider (optional) */
  url?: string;

  /** Full content/body of the item (optional, may be stored in B2 if large) */
  content?: string;

  /** SHA-256 hash of content for change detection */
  contentHash: string;

  /** Additional metadata specific to the provider */
  metadata: Record<string, any>;

  /** When the item was created in the external provider (optional) */
  externalCreatedAt?: Date;

  /** When the item was last updated in the external provider (optional) */
  externalUpdatedAt?: Date;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether the sync completed successfully */
  success: boolean;

  /** Total number of items fetched from the provider */
  itemsFetched: number;

  /** Number of new items created in our database */
  itemsCreated: number;

  /** Number of existing items updated in our database */
  itemsUpdated: number;

  /** Number of items that failed to process */
  itemsFailed: number;

  /** Array of error messages (if any) */
  errors: string[];

  /** Array of synced items */
  items: SyncedItem[];

  /** Additional metadata about the sync (optional) */
  metadata?: Record<string, any>;
}
