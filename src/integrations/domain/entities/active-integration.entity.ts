import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Active Integration (Tenant-Specific)
 * Represents an integration activated by a specific tenant
 */
@Entity({ name: 'active_integrations' })
export class ActiveIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id', type: 'varchar', length: 50 })
  integrationId: string; // FK to IntegrationCatalog

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  // Encrypted configuration (AES-256-GCM)
  @Column({ name: 'encrypted_config', type: 'text' })
  encryptedConfig: string; // Encrypted JSON with OAuth tokens

  @Column({ name: 'encryption_iv', type: 'varchar', length: 32 })
  encryptionIv: string; // Initialization Vector for AES-256-GCM

  // Sync status
  @Column({ name: 'last_sync', type: 'timestamp', nullable: true })
  lastSync: Date;

  @Column({ name: 'next_sync', type: 'timestamp', nullable: true })
  nextSync: Date;

  @Column({ name: 'sync_status', type: 'varchar', length: 50, default: 'pending' })
  syncStatus: string; // 'pending', 'running', 'success', 'failed'

  @Column({ name: 'sync_errors', type: 'jsonb', default: '[]' })
  syncErrors: any[];

  // Metadata
  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>; // { totalItems: 0, lastError: null }

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
