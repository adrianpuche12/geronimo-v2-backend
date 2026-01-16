import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { GoogleDriveProvider } from '../../infrastructure/providers/google-drive/google-drive.provider';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';
import { IntegrationItemRepository } from '../../domain/repositories/integration-item.repository';
import { IntegrationSyncLogRepository } from '../../domain/repositories/integration-sync-log.repository';
import { OAuthService } from '../../infrastructure/services/oauth.service';

@Processor('integrations-sync')
export class DriveSyncProcessor {
  private readonly logger = new Logger(DriveSyncProcessor.name);

  constructor(
    private driveProvider: GoogleDriveProvider,
    private activeIntegrationRepo: ActiveIntegrationRepository,
    private integrationItemRepo: IntegrationItemRepository,
    private syncLogRepo: IntegrationSyncLogRepository,
    private oauthService: OAuthService,
  ) {}

  @Process('drive-sync')
  async handleSync(job: Job) {
    const { integrationId, tenantId, tenantSchema } = job.data;

    this.logger.log(`[Job ${job.id}] Starting Drive sync`);

    const syncLog = await this.syncLogRepo.save({
      integrationId,
      tenantId,
      status: 'in_progress',
      startedAt: new Date(),
      jobId: job.id.toString(),
    } as any);

    try {
      await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);
      const integration = await this.activeIntegrationRepo.findOne({
        where: { id: integrationId },
      });

      if (!integration) throw new Error('Integration not found');

      const tokens = this.oauthService.decryptTokens(
        integration.encryptedConfig,
        integration.encryptionIv,
      );

      const config = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        folders: integration.metadata?.folders || ['root'],
        maxResults: 100,
      };

      const result = await this.driveProvider.sync(config);

      if (!result.success) {
        throw new Error(`Sync failed: ${result.errors.join(', ')}`);
      }

      // Guardar items (similar a GitHub/Gmail)
      let itemsCreated = 0;
      let itemsUpdated = 0;

      for (const item of result.items) {
        const existing = await this.integrationItemRepo.findOne({
          where: { integrationId, externalId: item.externalId },
        });

        if (existing) {
          if (existing.contentHash !== item.contentHash) {
            Object.assign(existing, {
              content: item.content,
              contentHash: item.contentHash,
              title: item.title,
              metadata: item.metadata,
              syncedAt: new Date(),
              updatedAt: new Date(),
            });
            await this.integrationItemRepo.save(existing);
            itemsUpdated++;
          }
        } else {
          await this.integrationItemRepo.save({
            integrationId,
            tenantId,
            ...item,
            storageLocation: 'database',
            status: 'active',
            syncedAt: new Date(),
          } as any);
          itemsCreated++;
        }
      }

      integration.lastSync = new Date();
      integration.nextSync = new Date(Date.now() + 60 * 60 * 1000);
      integration.syncStatus = 'success';
      await this.activeIntegrationRepo.save(integration);

      syncLog.status = 'success';
      syncLog.finishedAt = new Date();
      syncLog.itemsFetched = result.itemsFetched;
      syncLog.itemsCreated = itemsCreated;
      syncLog.itemsUpdated = itemsUpdated;
      await this.syncLogRepo.save(syncLog);

      this.logger.log(`[Job ${job.id}] ✅ Drive sync completed`);

      return { success: true, result };
    } catch (error) {
      this.logger.error(`[Job ${job.id}] ❌ ${error.message}`);
      syncLog.status = 'failed';
      syncLog.errorMessage = error.message;
      await this.syncLogRepo.save(syncLog);
      throw error;
    }
  }
}
