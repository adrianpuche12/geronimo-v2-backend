import { Injectable, BadRequestException } from '@nestjs/common';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';
import { IntegrationCatalogRepository } from '../../domain/repositories/integration-catalog.repository';

@Injectable()
export class ActivateIntegrationUseCase {
  constructor(
    private activeIntegrationRepo: ActiveIntegrationRepository,
    private catalogRepo: IntegrationCatalogRepository,
  ) {}

  /**
   * Activa una integración existente (ya debe tener tokens de OAuth)
   *
   * @param tenantSchema - Schema del tenant
   * @param integrationId - ID de la integración (int-001, etc.)
   * @param metadata - Configuración adicional
   */
  async execute(
    tenantSchema: string,
    integrationId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Verificar que la integración existe en el catálogo
    const catalogItem = await this.catalogRepo.findOne({
      where: { id: integrationId },
    });

    if (!catalogItem) {
      throw new BadRequestException(`Integration ${integrationId} not found in catalog`);
    }

    // Buscar integración activa
    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);
    const active = await this.activeIntegrationRepo.findOne({
      where: { integrationId },
    });

    if (!active) {
      throw new BadRequestException(
        `Integration ${integrationId} not connected. Please authenticate first via OAuth.`,
      );
    }

    // Actualizar metadata y habilitar
    active.enabled = true;
    active.metadata = {
      ...active.metadata,
      ...metadata,
    };

    await this.activeIntegrationRepo.save(active);
  }
}
