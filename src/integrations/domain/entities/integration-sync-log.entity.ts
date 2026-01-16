import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Integration Sync Log (Tenant-Specific)
 * Logs all sync operations with detailed statistics
 */
@Entity({ name: 'integration_sync_logs' })
@Index('idx_sync_logs_integration_id', ['integrationId'])
@Index('idx_sync_logs_tenant_id', ['tenantId'])
@Index('idx_sync_logs_status', ['status'])
@Index('idx_sync_logs_started_at', ['startedAt'])
@Index('idx_sync_logs_job_id', ['jobId'])
export class IntegrationSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string; // FK to ActiveIntegration

  @Column({ name: 'tenant_id', type: 'varchar', length: 100 })
  tenantId: string;

  @Column({ name: 'started_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamp', nullable: true })
  finishedAt: Date;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number;

  @Column({ type: 'varchar', length: 20 })
  status: string; // 'in_progress', 'success', 'failed', 'partial'

  @Column({ name: 'items_fetched', type: 'int', default: 0 })
  itemsFetched: number;

  @Column({ name: 'items_created', type: 'int', default: 0 })
  itemsCreated: number;

  @Column({ name: 'items_updated', type: 'int', default: 0 })
  itemsUpdated: number;

  @Column({ name: 'items_deleted', type: 'int', default: 0 })
  itemsDeleted: number;

  @Column({ name: 'items_failed', type: 'int', default: 0 })
  itemsFailed: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'error_stack', type: 'text', nullable: true })
  errorStack: string;

  @Column({ name: 'job_id', type: 'varchar', length: 255, nullable: true })
  jobId: string; // Bull Queue job ID

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
