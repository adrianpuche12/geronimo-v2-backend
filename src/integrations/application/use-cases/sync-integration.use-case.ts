import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ActiveIntegrationRepository } from '../../domain/repositories/active-integration.repository';

@Injectable()
export class SyncIntegrationUseCase {
  constructor(
    @InjectQueue('integrations-sync') private syncQueue: Queue,
    private activeIntegrationRepo: ActiveIntegrationRepository,
  ) {}

  /**
   * Trigger manual de sincronización
   *
   * @param tenantSchema - Schema del tenant
   * @param integrationCodeOrUuid - integration_id (int-001) o UUID
   * @param tenantId - ID del tenant
   */
  async execute(
    tenantSchema: string,
    integrationCodeOrUuid: string,
    tenantId: string,
  ): Promise<{ jobId: string }> {
    await this.activeIntegrationRepo.query(`SET search_path TO ${tenantSchema}`);

    // Detectar si es UUID o integration_id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(integrationCodeOrUuid);

    let integration;
    if (isUuid) {
      // Buscar por UUID
      integration = await this.activeIntegrationRepo.findOne({
        where: { id: integrationCodeOrUuid },
      });
    } else {
      // Buscar por integration_id
      const result = await this.activeIntegrationRepo.query(`
        SELECT * FROM active_integrations
        WHERE integration_id = '${integrationCodeOrUuid}'
        LIMIT 1
      `);
      integration = result.length > 0 ? result[0] : null;
    }

    if (!integration) {
      throw new BadRequestException('Integration not found');
    }

    if (!integration.enabled) {
      throw new BadRequestException('Integration is disabled');
    }

    // Determinar tipo de job según integrationId
    let jobName: string;
    switch (integration.integration_id) {
      case 'int-001':
        jobName = 'github-sync';
        break;
      case 'int-004':
        jobName = 'gmail-sync';
        break;
      case 'int-020':
        jobName = 'drive-sync';
        break;
      default:
        throw new BadRequestException('Unknown integration type');
    }

    // Agregar job a la cola con prioridad alta
    const job = await this.syncQueue.add(
      jobName,
      {
        integrationId: integration.id,
        tenantId,
        tenantSchema,
      },
      {
        priority: 1, // Alta prioridad para syncs manuales
        attempts: 2,
        removeOnComplete: 50,
      },
    );

    return { jobId: job.id.toString() };
  }
}
