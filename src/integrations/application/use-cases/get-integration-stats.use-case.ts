import { Injectable } from '@nestjs/common';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';
import { IntegrationItemRepository } from '../../domain/repositories/integration-item.repository';
import { IntegrationSyncLogRepository } from '../../domain/repositories/integration-sync-log.repository';

@Injectable()
export class GetIntegrationStatsUseCase {
  constructor(
    private activeIntegrationRepo: ActiveIntegrationRepository,
    private integrationItemRepo: IntegrationItemRepository,
    private syncLogRepo: IntegrationSyncLogRepository,
  ) {}

  async execute(tenantSchema: string, integrationCode: string) {
    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);

    const integration = await this.activeIntegrationRepo.query(`
      SELECT * FROM active_integrations
      WHERE integration_id = '${integrationCode}'
      LIMIT 1
    `);

    if (!integration || integration.length === 0) {
      return {
        integrationCode,
        enabled: false,
        totalItems: 0,
        lastSync: null,
        nextSync: null,
        syncStatus: 'not_found',
        stats: {
          successfulSyncs: 0,
          failedSyncs: 0,
          lastSyncDurationSeconds: null,
          lastSyncMessage: 'Integration not activated',
        },
        metadata: null,
      };
    }

    const integ = integration[0];
    const actualId = integ.id;

    const totalItemsResult = await this.integrationItemRepo.query(`
      SELECT COUNT(*) as count FROM integration_items
      WHERE integration_id = '${actualId}'
    `);

    const totalItems = parseInt(totalItemsResult[0]?.count || '0');

    const lastLog = await this.syncLogRepo.query(`
      SELECT * FROM integration_sync_logs
      WHERE integration_id = '${actualId}'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const successLogs = await this.syncLogRepo.query(`
      SELECT COUNT(*) as count FROM integration_sync_logs
      WHERE integration_id = '${actualId}'
        AND status = 'success'
        AND created_at >= '${thirtyDaysAgo.toISOString()}'
    `);

    const errorLogs = await this.syncLogRepo.query(`
      SELECT COUNT(*) as count FROM integration_sync_logs
      WHERE integration_id = '${actualId}'
        AND status IN ('error', 'failed')
        AND created_at >= '${thirtyDaysAgo.toISOString()}'
    `);

    let syncStatus = 'pending';
    if (lastLog && lastLog.length > 0) {
      syncStatus = lastLog[0].status === 'success' ? 'synced' : 'error';
    }

    return {
      integrationId: integ.id,
      integrationCode: integ.integration_id,
      enabled: integ.enabled,
      totalItems,
      lastSync: integ.last_sync,
      nextSync: integ.next_sync,
      syncStatus,
      stats: {
        successfulSyncs: parseInt(successLogs[0]?.count || '0'),
        failedSyncs: parseInt(errorLogs[0]?.count || '0'),
        lastSyncDurationSeconds: lastLog[0]?.duration_seconds || null,
        lastSyncMessage: lastLog[0]?.error_message || null,
      },
      metadata: integ.metadata,
    };
  }
}
