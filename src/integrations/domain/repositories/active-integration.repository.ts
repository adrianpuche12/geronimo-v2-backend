import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ActiveIntegration } from '../entities/active-integration.entity';

@Injectable()
export class ActiveIntegrationRepository extends Repository<ActiveIntegration> {
  constructor(private dataSource: DataSource) {
    super(ActiveIntegration, dataSource.createEntityManager());
  }

  /**
   * Find integration by tenant and integration catalog ID
   * @param tenantSchema - Tenant schema name (e.g., 'tenant_default_001')
   * @param integrationId - Integration catalog ID (e.g., 'int-001')
   */
  async findByTenantAndIntegrationId(
    tenantSchema: string,
    integrationId: string,
  ): Promise<ActiveIntegration | null> {
    // Set search_path to tenant schema
    await this.query(`SET search_path TO ${tenantSchema}`);

    return this.findOne({
      where: {
        integrationId,
        enabled: true,
      },
    });
  }

  /**
   * Find all integrations pending sync
   * @param tenantSchema - Tenant schema name
   */
  async findPendingSync(tenantSchema: string): Promise<ActiveIntegration[]> {
    await this.query(`SET search_path TO ${tenantSchema}`);

    const now = new Date();
    return this.createQueryBuilder('integration')
      .where('integration.enabled = :enabled', { enabled: true })
      .andWhere(
        '(integration.nextSync IS NULL OR integration.nextSync <= :now)',
        { now },
      )
      .getMany();
  }

  /**
   * Find all active integrations for a tenant
   * @param tenantSchema - Tenant schema name
   */
  async findAllActive(tenantSchema: string): Promise<ActiveIntegration[]> {
    await this.query(`SET search_path TO ${tenantSchema}`);

    return this.find({
      where: { enabled: true },
      order: { createdAt: 'DESC' },
    });
  }
}
