import { Injectable } from '@nestjs/common';
import { IntegrationSyncLogRepository } from '../../domain/repositories/integration-sync-log.repository';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';

@Injectable()
export class GetSyncLogsUseCase {
  constructor(
    private syncLogRepo: IntegrationSyncLogRepository,
    private activeIntegrationRepo: ActiveIntegrationRepository,
  ) {}

  async execute(
    tenantSchema: string,
    integrationCode: string,
    limit: number = 10,
    offset: number = 0,
  ) {
    await this.syncLogRepo.query(`SET search_path TO ${tenantSchema}`);

    const integration = await this.activeIntegrationRepo.query(`
      SELECT id FROM active_integrations
      WHERE integration_id = '${integrationCode}'
      LIMIT 1
    `);

    if (!integration || integration.length === 0) {
      return { logs: [], total: 0, limit, offset, hasMore: false };
    }

    const actualId = integration[0].id;

    const logs = await this.syncLogRepo.query(`
      SELECT
        id,
        integration_id,
        status,
        error_message,
        items_fetched,
        items_created,
        items_updated,
        duration_seconds,
        started_at,
        finished_at,
        created_at
      FROM integration_sync_logs
      WHERE integration_id = '${actualId}'
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const totalResult = await this.syncLogRepo.query(`
      SELECT COUNT(*) as count
      FROM integration_sync_logs
      WHERE integration_id = '${actualId}'
    `);

    const total = parseInt(totalResult[0]?.count || '0');

    return {
      logs: logs.map(log => ({
        id: log.id,
        status: log.status,
        message: log.error_message || 'Sync completed successfully',
        itemsFetched: log.items_fetched,
        itemsCreated: log.items_created,
        itemsUpdated: log.items_updated,
        durationSeconds: log.duration_seconds,
        startedAt: log.started_at,
        finishedAt: log.finished_at,
        createdAt: log.created_at,
      })),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }
}
