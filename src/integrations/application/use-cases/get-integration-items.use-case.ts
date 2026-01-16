import { Injectable } from '@nestjs/common';
import { IntegrationItemRepository } from '../../domain/repositories/integration-item.repository';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';

@Injectable()
export class GetIntegrationItemsUseCase {
  constructor(
    private integrationItemRepo: IntegrationItemRepository,
    private activeIntegrationRepo: ActiveIntegrationRepository,
  ) {}

  async execute(
    tenantSchema: string,
    integrationCode: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    await this.integrationItemRepo.query(`SET search_path TO ${tenantSchema}`);

    const integration = await this.activeIntegrationRepo.query(`
      SELECT id FROM active_integrations
      WHERE integration_id = '${integrationCode}'
      LIMIT 1
    `);

    if (!integration || integration.length === 0) {
      return { items: [], total: 0, limit, offset, hasMore: false };
    }

    const actualId = integration[0].id;

    const items = await this.integrationItemRepo.query(`
      SELECT
        id,
        integration_id,
        external_id,
        item_type,
        title,
        description,
        url,
        metadata,
        external_updated_at,
        synced_at,
        status
      FROM integration_items
      WHERE integration_id = '${actualId}'
      ORDER BY external_updated_at DESC NULLS LAST, synced_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const totalResult = await this.integrationItemRepo.query(`
      SELECT COUNT(*) as count
      FROM integration_items
      WHERE integration_id = '${actualId}'
    `);

    const total = parseInt(totalResult[0]?.count || '0');

    return {
      items: items.map(item => ({
        id: item.id,
        externalId: item.external_id,
        type: item.item_type,
        title: item.title,
        description: item.description,
        url: item.url,
        metadata: item.metadata,
        lastModified: item.external_updated_at,
        syncedAt: item.synced_at,
        status: item.status,
      })),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }
}
