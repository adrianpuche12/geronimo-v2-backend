import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { IntegrationItem } from '../entities/integration-item.entity';

@Injectable()
export class IntegrationItemRepository extends Repository<IntegrationItem> {
  constructor(private dataSource: DataSource) {
    super(IntegrationItem, dataSource.createEntityManager());
  }

  /**
   * Find item by integration ID and external ID
   * @param tenantSchema - Tenant schema name
   * @param integrationId - Active integration UUID
   * @param externalId - External provider ID
   */
  async findByExternalId(
    tenantSchema: string,
    integrationId: string,
    externalId: string,
  ): Promise<IntegrationItem | null> {
    await this.query(`SET search_path TO ${tenantSchema}`);

    return this.findOne({
      where: {
        integrationId,
        externalId,
      },
    });
  }

  /**
   * Find all items for an integration
   * @param tenantSchema - Tenant schema name
   * @param integrationId - Active integration UUID
   * @param limit - Maximum number of items to return
   */
  async findByIntegration(
    tenantSchema: string,
    integrationId: string,
    limit: number = 100,
  ): Promise<IntegrationItem[]> {
    await this.query(`SET search_path TO ${tenantSchema}`);

    return this.find({
      where: { integrationId, status: 'active' },
      order: { syncedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Count items for an integration
   * @param tenantSchema - Tenant schema name
   * @param integrationId - Active integration UUID
   */
  async countByIntegration(
    tenantSchema: string,
    integrationId: string,
  ): Promise<number> {
    await this.query(`SET search_path TO ${tenantSchema}`);

    return this.count({
      where: { integrationId, status: 'active' },
    });
  }
}
