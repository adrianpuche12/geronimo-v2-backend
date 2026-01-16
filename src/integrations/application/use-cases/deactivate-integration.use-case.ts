import { Injectable } from '@nestjs/common';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';

@Injectable()
export class DeactivateIntegrationUseCase {
  constructor(
    private activeIntegrationRepo: ActiveIntegrationRepository,
  ) {}

  /**
   * Desactiva una integración (no elimina tokens)
   *
   * @param tenantSchema - Schema del tenant
   * @param integrationId - UUID de la integración activa
   */
  async execute(tenantSchema: string, integrationId: string): Promise<void> {
    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);

    const integration = await this.activeIntegrationRepo.findOne({
      where: { id: integrationId },
    });

    if (!integration) return;

    integration.enabled = false;
    await this.activeIntegrationRepo.save(integration);
  }
}
