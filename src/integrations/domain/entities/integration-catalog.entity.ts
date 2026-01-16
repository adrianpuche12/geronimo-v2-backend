import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Integration Catalog (Global - Shared Schema)
 * Contains all available integrations that can be activated by tenants
 */
@Entity({ schema: 'shared', name: 'integrations_catalog' })
export class IntegrationCatalog {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string; // 'int-001', 'int-004', 'int-020'

  @Column({ type: 'varchar', length: 100 })
  name: string; // 'GitHub', 'Gmail', 'Google Drive'

  @Column({ type: 'varchar', length: 50 })
  category: string; // 'development', 'email', 'storage'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl: string;

  @Column({ name: 'for_industry', type: 'varchar', length: 100, default: 'all' })
  forIndustry: string; // 'all', 'tech', 'automotive', 'sales'

  @Column({ name: 'auth_type', type: 'varchar', length: 50 })
  authType: string; // 'oauth2', 'api_key', 'basic'

  @Column({ name: 'config_schema', type: 'jsonb', nullable: true })
  configSchema: any; // JSON Schema for configuration validation

  @Column({ name: 'sync_frequency', type: 'varchar', length: 50, default: 'hourly' })
  syncFrequency: string; // 'hourly', 'daily', 'realtime'

  @Column({ name: 'requires_webhook', type: 'boolean', default: false })
  requiresWebhook: boolean;

  @Column({ name: 'documentation_url', type: 'varchar', length: 500, nullable: true })
  documentationUrl: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_beta', type: 'boolean', default: false })
  isBeta: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
