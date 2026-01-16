import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';
import { DataSource } from 'typeorm';

/**
 * Servicio de scheduling automático de sincronizaciones
 * Ejecuta cada 30 minutos y revisa integraciones que necesitan sync
 */
@Injectable()
export class SyncSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    @InjectQueue('integrations-sync') private syncQueue: Queue,
    private activeIntegrationRepo: ActiveIntegrationRepository,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('✅ Sync Scheduler Service initialized');
    this.logger.log('   Cron schedule: Every 30 minutes');
    this.logger.log('   Queue: integrations-sync');
  }

  /**
   * Cron job que se ejecuta cada 30 minutos
   */
  @Cron('*/30 * * * *')  // Cada 30 minutos
  async scheduleSyncJobs() {
    const startTime = Date.now();
    this.logger.log('🔄 [Scheduler] Running sync check...');

    try {
      const tenantSchemas = await this.getAllTenantSchemas();
      this.logger.log(`   Found ${tenantSchemas.length} tenant schemas`);

      let totalJobsQueued = 0;

      for (const schema of tenantSchemas) {
        try {
          const integrations = await this.findPendingSync(schema);

          if (integrations.length === 0) {
            this.logger.debug(`   [${schema}] No integrations pending sync`);
            continue;
          }

          this.logger.log(`   [${schema}] Found ${integrations.length} integrations to sync`);

          for (const integration of integrations) {
            const jobName = this.getJobNameForIntegration(integration.integrationId);

            if (!jobName) {
              this.logger.warn(`   [${schema}] Unknown integration type: ${integration.integrationId}`);
              continue;
            }

            // Agregar job a la cola
            const job = await this.syncQueue.add(
              jobName,
              {
                integrationId: integration.id,
                tenantId: schema.replace('tenant_', ''),
                tenantSchema: schema,
              },
              {
                priority: 5,  // Prioridad normal (manual es 1)
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000,
                },
                removeOnComplete: 100,
                removeOnFail: 500,
              },
            );

            totalJobsQueued++;
            this.logger.debug(`   [${schema}] Queued ${jobName} job #${job.id}`);
          }
        } catch (error) {
          this.logger.error(`   [${schema}] Error scheduling sync: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(`✅ [Scheduler] Completed in ${duration}ms. Queued ${totalJobsQueued} jobs.`);

    } catch (error) {
      this.logger.error(`❌ [Scheduler] Fatal error: ${error.message}`, error.stack);
    }
  }

  /**
   * Obtiene todos los schemas de tenants
   */
  private async getAllTenantSchemas(): Promise<string[]> {
    const result = await this.dataSource.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name
    `);

    return result.map((row: any) => row.schema_name);
  }

  /**
   * Encuentra integraciones que necesitan sync
   */
  private async findPendingSync(tenantSchema: string): Promise<any[]> {
    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);

    return this.activeIntegrationRepo.query(`
      SELECT * FROM active_integrations
      WHERE enabled = true
        AND integration_id IN ('int-001', 'int-004', 'int-020')
      ORDER BY last_sync ASC NULLS FIRST
      LIMIT 10
    `);
  }

  /**
   * Mapea integration_id a nombre de job
   */
  private getJobNameForIntegration(integrationId: string): string | null {
    switch (integrationId) {
      case 'int-001':
        return 'github-sync';
      case 'int-004':
        return 'gmail-sync';  // Gmail sync
        
      case 'int-020':
        return 'drive-sync';
      default:
        return null;
    }
  }

  /**
   * Trigger manual de sincronización (usado por controllers)
   */
  async triggerManualSync(
    integrationId: string,
    tenantSchema: string,
    tenantId: string,
  ): Promise<{ jobId: string }> {
    this.logger.log(`🔧 [Scheduler] Manual sync triggered for integration ${integrationId}`);

    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);
    const integration = await this.activeIntegrationRepo.findOne({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    const jobName = this.getJobNameForIntegration(integration.integrationId);

    if (!jobName) {
      throw new Error(`Sync not available for this integration type`);
    }

    const job = await this.syncQueue.add(
      jobName,
      {
        integrationId: integration.id,
        tenantId,
        tenantSchema,
      },
      {
        priority: 1,  // Alta prioridad (manual)
        attempts: 2,
        removeOnComplete: 50,
      },
    );

    this.logger.log(`   Job #${job.id} queued (${jobName})`);

    return { jobId: job.id.toString() };
  }

  /**
   * Obtiene estadísticas de la cola
   */
  async getQueueStats(): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.syncQueue.getWaitingCount(),
      this.syncQueue.getActiveCount(),
      this.syncQueue.getCompletedCount(),
      this.syncQueue.getFailedCount(),
      this.syncQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }
}
