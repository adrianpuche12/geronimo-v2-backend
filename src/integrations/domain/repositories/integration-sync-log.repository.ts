import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { IntegrationSyncLog } from '../entities/integration-sync-log.entity';

@Injectable()
export class IntegrationSyncLogRepository extends Repository<IntegrationSyncLog> {
  constructor(private dataSource: DataSource) {
    super(IntegrationSyncLog, dataSource.createEntityManager());
  }

  /**
   * Find recent sync logs for an integration
   * @param tenantSchema - Tenant schema name
   * @param integrationId - Active integration UUID
   * @param limit - Maximum number of logs to return
   */
  async findRecentLogs(
    tenantSchema: string,
    integrationId: string,
    limit: number = 10,
  ): Promise<IntegrationSyncLog[]> {
    await this.query(`SET search_path TO ${tenantSchema}`);

    return this.find({
      where: { integrationId },
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Find last successful sync
   * @param tenantSchema - Tenant schema name
   * @param integrationId - Active integration UUID
   */
  async findLastSuccessful(
    tenantSchema: string,
    integrationId: string,
  ): Promise<IntegrationSyncLog | null> {
    await this.query(`SET search_path TO ${tenantSchema}`);

    return this.findOne({
      where: { integrationId, status: 'success' },
      order: { startedAt: 'DESC' },
    });
  }

  /**
   * Create a new sync log
   * @param tenantSchema - Tenant schema name
   * @param log - Partial log data
   */
  async createLog(
    tenantSchema: string,
    log: Partial<IntegrationSyncLog>,
  ): Promise<IntegrationSyncLog> {
    await this.query(`SET search_path TO ${tenantSchema}`);

    const newLog = this.create(log);
    return this.save(newLog);
  }
}
