import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Integration Item (Tenant-Specific)
 * Stores individual items synced from integrations
 */
@Entity({ name: 'integration_items' })
@Index('idx_integration_items_integration_id', ['integrationId'])
@Index('idx_integration_items_external_id', ['externalId'])
@Index('idx_integration_items_content_hash', ['contentHash'])
@Index('idx_integration_items_item_type', ['itemType'])
@Index('idx_integration_items_tenant_id', ['tenantId'])
@Index('idx_integration_items_status', ['status'])
@Index('idx_integration_items_synced_at', ['syncedAt'])
export class IntegrationItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id', type: 'uuid', nullable: true })
  integrationId: string; // FK to ActiveIntegration

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'external_id', type: 'varchar', length: 500 })
  externalId: string; // ID from external system

  @Column({ name: 'item_type', type: 'varchar', length: 50 })
  itemType: string; // 'readme', 'doc', 'commit', 'issue', 'email'

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  url: string;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: number;

  // Content storage
  @Column({ type: 'text', nullable: true })
  content: string; // Full content or B2 URL if too large

  @Column({ name: 'content_hash', type: 'varchar', length: 64, nullable: true })
  contentHash: string; // SHA-256 hash for deduplication

  @Column({ name: 'storage_location', type: 'varchar', length: 10, default: 'database' })
  storageLocation: string; // 'database' or 'b2'

  @Column({ name: 'b2_file_path', type: 'text', nullable: true })
  b2FilePath: string; // Path in B2 if stored there

  // Metadata
  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // 'active', 'deleted', 'archived'

  @Column({ name: 'external_created_at', type: 'timestamp', nullable: true })
  externalCreatedAt: Date;

  @Column({ name: 'external_updated_at', type: 'timestamp', nullable: true })
  externalUpdatedAt: Date;

  @Column({ name: 'synced_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  syncedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
