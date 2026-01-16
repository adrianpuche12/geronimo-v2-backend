import { Injectable } from '@nestjs/common';
import { IntegrationCatalogRepository } from '../../domain/repositories/integration-catalog.repository';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';

export interface IntegrationWithStatus {
  id: string;
  name: string;
  category: string;
  description: string;
  iconUrl: string | null;
  authType: string;
  isActive: boolean;
  isConnected: boolean;
  connectedAt?: string;
  lastSync?: string;
  syncStatus?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class ListIntegrationsUseCase {
  constructor(
    private catalogRepo: IntegrationCatalogRepository,
    private activeIntegrationRepo: ActiveIntegrationRepository,
  ) {}

  /**
   * Lista todas las integraciones disponibles con su estado
   *
   * @param tenantSchema - Schema del tenant
   * @returns Array de integraciones con estado
   */
  async execute(tenantSchema: string): Promise<IntegrationWithStatus[]> {
    // Obtener catálogo completo (shared schema)
    const catalog = await this.catalogRepo.find({
      where: { isActive: true },
    });

    // Obtener integraciones activas del tenant
    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);
    const activeIntegrations = await this.activeIntegrationRepo.find();

    // Mapear catálogo con estado
    return catalog.map((catalogItem) => {
      const active = activeIntegrations.find(
        (a) => a.integrationId === catalogItem.id,
      );

      return {
        id: catalogItem.id,
        name: catalogItem.name,
        category: catalogItem.category,
        description: catalogItem.description,
        iconUrl: catalogItem.iconUrl || null,
        authType: catalogItem.authType,
        isActive: catalogItem.isActive,
        isConnected: !!active && active.enabled,
        connectedAt: active?.metadata?.connectedAt,
        lastSync: active?.lastSync?.toISOString(),
        syncStatus: active?.syncStatus,
        metadata: active?.metadata,
      };
    });
  }
}
