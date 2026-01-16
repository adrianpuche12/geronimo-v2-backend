import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { GmailProvider } from '../../infrastructure/providers/gmail/gmail.provider';
import { OAuthService } from '../../infrastructure/services/oauth.service';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';
import { IntegrationItemRepository } from '../../domain/repositories/integration-item.repository';
import { IntegrationSyncLogRepository } from '../../domain/repositories/integration-sync-log.repository';

/**
 * Gmail Sync Processor
 *
 * Procesa jobs de sincronización de Gmail
 * Queue: integrations-sync
 * Job name: gmail-sync
 */
@Processor('integrations-sync')
export class GmailSyncProcessor {
  private readonly logger = new Logger(GmailSyncProcessor.name);

  constructor(
    private gmailProvider: GmailProvider,
    private oauthService: OAuthService,
    private activeIntegrationRepo: ActiveIntegrationRepository,
    private itemRepo: IntegrationItemRepository,
    private syncLogRepo: IntegrationSyncLogRepository,
  ) {}

  @Process('gmail-sync')
  async handleGmailSync(job: Job): Promise<void> {
    const { integrationId, tenantId, tenantSchema } = job.data;
    this.logger.log(`[Job ${job.id}] Starting Gmail sync for integration ${integrationId}`);

    // Create sync log
    const syncLog = await this.syncLogRepo.createLog(tenantSchema, {
      integrationId,
      tenantId,
      jobId: job.id.toString(),
      status: 'in_progress',
      startedAt: new Date(),
    });

    try {
      // Get integration config
      await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);
      const integration = await this.activeIntegrationRepo.findOne({
        where: { id: integrationId },
      });

      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      // Decrypt tokens
      const config = this.oauthService.decryptTokens(
        integration.encryptedConfig,
        integration.encryptionIv,
      );

      const metadata = integration.metadata || {};
      const labels = metadata.labels || ['INBOX'];
      const maxResults = metadata.maxResults || 50;

      // Perform sync
      const syncResult = await this.gmailProvider.sync({
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        labels,
        maxResults,
      });

      let itemsCreated = 0;
      let itemsUpdated = 0;

      // Save items to database
      for (const item of syncResult.items) {
        try {
          await this.itemRepo.query(`SET search_path TO ${tenantSchema}`);
          const existing = await this.itemRepo.findByExternalId(
            tenantSchema,
            integrationId,
            item.externalId,
          );

          if (existing) {
            // Update if content changed
            if (existing.contentHash !== item.contentHash) {
              await this.itemRepo.query(`SET search_path TO ${tenantSchema}`);
              await this.itemRepo.update(existing.id, {
                title: item.title,
                description: item.description,
                content: item.content,
                contentHash: item.contentHash,
                metadata: item.metadata,
                syncedAt: new Date(),
              });
              itemsUpdated++;
              this.logger.debug(`[Job ${job.id}] Updated email: ${item.title}`);
            }
          } else {
            // Create new item
            const newItem = this.itemRepo.create({
              integrationId,
              tenantId,
              externalId: item.externalId,
              itemType: item.itemType,
              title: item.title,
              description: item.description,
              url: item.url,
              content: item.content,
              contentHash: item.contentHash,
              metadata: item.metadata,
              storageLocation: 'database',
              status: 'active',
              externalCreatedAt: item.metadata?.internalDate
                ? new Date(parseInt(item.metadata.internalDate))
                : new Date(),
            });

            await this.itemRepo.query(`SET search_path TO ${tenantSchema}`);
            await this.itemRepo.save(newItem);
            itemsCreated++;
            this.logger.debug(`[Job ${job.id}] Created email: ${item.title}`);
          }
        } catch (error) {
          this.logger.error(
            `[Job ${job.id}] Error saving item ${item.externalId}: ${error.message}`,
          );
        }
      }

      // Update integration last sync
      await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);
      await this.activeIntegrationRepo.update(integration.id, {
        lastSync: new Date(),
        nextSync: new Date(Date.now() + 3600 * 1000), // 1 hour
        syncStatus: 'success',
      });

      // Update sync log
      const duration = Math.floor((Date.now() - syncLog.startedAt.getTime()) / 1000);
      await this.syncLogRepo.query(`SET search_path TO ${tenantSchema}`);
      await this.syncLogRepo.update(syncLog.id, {
        status: 'success',
        finishedAt: new Date(),
        durationSeconds: duration,
        itemsFetched: syncResult.itemsFetched,
        itemsCreated,
        itemsUpdated,
        itemsFailed: syncResult.itemsFailed,
        metadata: syncResult.metadata,
      });

      this.logger.log(
        `[Job ${job.id}] Gmail sync completed. ` +
        `Fetched: ${syncResult.itemsFetched}, ` +
        `Created: ${itemsCreated}, ` +
        `Updated: ${itemsUpdated}, ` +
        `Failed: ${syncResult.itemsFailed}`,
      );
    } catch (error) {
      this.logger.error(
        `[Job ${job.id}] Gmail sync failed: ${error.message}`,
        error.stack,
      );

      // Update sync log with error
      const duration = Math.floor((Date.now() - syncLog.startedAt.getTime()) / 1000);
      await this.syncLogRepo.query(`SET search_path TO ${tenantSchema}`);
      await this.syncLogRepo.update(syncLog.id, {
        status: 'failed',
        finishedAt: new Date(),
        durationSeconds: duration,
        errorMessage: error.message,
        errorStack: error.stack,
      });

      throw error;
    }
  }
}
