import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { GitHubProvider } from '../../infrastructure/providers/github/github.provider';
import { OAuthService } from '../../infrastructure/services/oauth.service';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';
import { IntegrationItemRepository } from '../../domain/repositories/integration-item.repository';
import { IntegrationSyncLogRepository } from '../../domain/repositories/integration-sync-log.repository';

@Processor('integrations-sync')
export class GitHubSyncProcessor {
  private readonly logger = new Logger(GitHubSyncProcessor.name);

  constructor(
    private githubProvider: GitHubProvider,
    private oauthService: OAuthService,
    private activeIntegrationRepo: ActiveIntegrationRepository,
    private itemRepo: IntegrationItemRepository,
    private syncLogRepo: IntegrationSyncLogRepository,
  ) {}

  @Process('github-sync')
  async handleGitHubSync(job: Job): Promise<void> {
    const { integrationId, tenantId, tenantSchema } = job.data;
    this.logger.log(`[Job ${job.id}] Starting GitHub sync for integration ${integrationId}`);

    const syncLog = await this.syncLogRepo.createLog(tenantSchema, {
      integrationId,
      tenantId,
      jobId: job.id.toString(),
      status: 'in_progress',
      startedAt: new Date(),
    });

    try {
      const integration = await this.activeIntegrationRepo.findOne({
        where: { id: integrationId },
      });

      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      const config = this.oauthService.decryptTokens(integration.encryptedConfig, integration.encryptionIv);
      const metadata = integration.metadata || {};
      const repos = metadata.repos || [];

      if (repos.length === 0) {
        this.logger.warn(`[Job ${job.id}] No repos configured`);
        await this.syncLogRepo.query(`SET search_path TO ${tenantSchema}`);
        await this.syncLogRepo.update(syncLog.id, {
          status: 'success',
          finishedAt: new Date(),
          durationSeconds: 0,
          itemsFetched: 0,
        });
        return;
      }

      const syncResult = await this.githubProvider.sync({
        accessToken: config.accessToken,
        repos,
        syncReadme: true,
        syncDocs: true,
        syncCommits: true,
        syncIssues: true,
        syncPullRequests: true,
      });

      let itemsCreated = 0;
      let itemsUpdated = 0;

      for (const item of syncResult.items) {
        try {
          const existing = await this.itemRepo.findByExternalId(
            tenantSchema,
            integrationId,
            item.externalId,
          );

          if (existing) {
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
            }
          } else {
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
            });

            await this.itemRepo.query(`SET search_path TO ${tenantSchema}`);
            await this.itemRepo.save(newItem);
            itemsCreated++;
          }
        } catch (error) {
          this.logger.error(`[Job ${job.id}] Error saving item ${item.externalId}: ${error.message}`);
        }
      }

      await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);
      await this.activeIntegrationRepo.update(integration.id, {
        lastSync: new Date(),
        nextSync: new Date(Date.now() + 3600 * 1000),
        syncStatus: 'success',
      });

      await this.syncLogRepo.query(`SET search_path TO ${tenantSchema}`);
      await this.syncLogRepo.update(syncLog.id, {
        status: 'success',
        finishedAt: new Date(),
        durationSeconds: Math.floor((Date.now() - syncLog.startedAt.getTime()) / 1000),
        itemsFetched: syncResult.itemsFetched,
        itemsCreated,
        itemsUpdated,
        itemsFailed: syncResult.itemsFailed,
      });

      this.logger.log(`[Job ${job.id}] GitHub sync completed. Created: ${itemsCreated}, Updated: ${itemsUpdated}`);
    } catch (error) {
      this.logger.error(`[Job ${job.id}] GitHub sync failed: ${error.message}`, error.stack);

      await this.syncLogRepo.query(`SET search_path TO ${tenantSchema}`);
      await this.syncLogRepo.update(syncLog.id, {
        status: 'failed',
        finishedAt: new Date(),
        durationSeconds: Math.floor((Date.now() - syncLog.startedAt.getTime()) / 1000),
        errorMessage: error.message,
        errorStack: error.stack,
      });

      throw error;
    }
  }
}
