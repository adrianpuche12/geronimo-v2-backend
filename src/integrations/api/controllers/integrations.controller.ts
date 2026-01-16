import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
} from '@nestjs/common';
import { ListIntegrationsUseCase } from '../../application/use-cases/list-integrations.use-case';
import { ActivateIntegrationUseCase } from '../../application/use-cases/activate-integration.use-case';
import { SyncIntegrationUseCase } from '../../application/use-cases/sync-integration.use-case';
import { DeactivateIntegrationUseCase } from '../../application/use-cases/deactivate-integration.use-case';
import { GetIntegrationStatsUseCase } from '../../application/use-cases/get-integration-stats.use-case';
import { GetSyncLogsUseCase } from '../../application/use-cases/get-sync-logs.use-case';
import { GetIntegrationItemsUseCase } from '../../application/use-cases/get-integration-items.use-case';
import { ActivateIntegrationDto } from '../../application/dto/activate-integration.dto';
import { UpdateIntegrationConfigDto } from '../../application/dto/update-integration-config.dto';
import { TenantContext } from '../../../infrastructure/database/tenant-context';

/**
 * Controller para CRUD de integraciones
 *
 * Todos los endpoints requieren autenticación (TenantMiddleware)
 */
@Controller('api/integrations')
export class IntegrationsController {
  constructor(
    private listIntegrationsUseCase: ListIntegrationsUseCase,
    private activateIntegrationUseCase: ActivateIntegrationUseCase,
    private syncIntegrationUseCase: SyncIntegrationUseCase,
    private deactivateIntegrationUseCase: DeactivateIntegrationUseCase,
    private getIntegrationStatsUseCase: GetIntegrationStatsUseCase,
    private getSyncLogsUseCase: GetSyncLogsUseCase,
    private getIntegrationItemsUseCase: GetIntegrationItemsUseCase,
    private tenantContext: TenantContext,
  ) {}

  /**
   * Lista todas las integraciones con su estado
   *
   * GET /api/integrations
   */
  @Get()
  async listIntegrations() {
    const tenant = this.tenantContext.get();
    return this.listIntegrationsUseCase.execute(tenant.schemaName);
  }

  /**
   * Activa una integración (requiere OAuth previo)
   *
   * POST /api/integrations/activate
   * Body: { integrationId: 'int-001', metadata: { repos: [...] } }
   */
  @Post('activate')
  async activateIntegration(@Body() dto: ActivateIntegrationDto) {
    const tenant = this.tenantContext.get();

    await this.activateIntegrationUseCase.execute(
      tenant.schemaName,
      dto.integrationId,
      dto.metadata,
    );

    return { success: true, message: 'Integration activated' };
  }

  /**
   * Actualiza configuración de integración
   *
   * PATCH /api/integrations/:id
   * Body: { enabled: true, metadata: { ... } }
   */
  @Patch(':id')
  async updateIntegration(
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationConfigDto,
  ) {
    const tenant = this.tenantContext.get();

    if (dto.enabled === false) {
      await this.deactivateIntegrationUseCase.execute(tenant.schemaName, id);
    } else if (dto.metadata) {
      // Si se envía metadata, se asume que se quiere activar y actualizar
      await this.activateIntegrationUseCase.execute(
        tenant.schemaName,
        id,
        dto.metadata,
      );
    }

    return { success: true };
  }

  /**
   * Trigger manual de sincronización
   *
   * POST /api/integrations/:id/sync
   */
  @Post(':id/sync')
  async triggerSync(@Param('id') id: string) {
    const tenant = this.tenantContext.get();

    const { jobId } = await this.syncIntegrationUseCase.execute(
      tenant.schemaName,
      id,
      tenant.tenantId,
    );

    return { success: true, jobId, message: 'Sync job queued' };
  }

  /**
   * Desactiva una integración
   *
   * DELETE /api/integrations/:id
   */
  @Delete(':id')
  async deactivateIntegration(@Param('id') id: string) {
    const tenant = this.tenantContext.get();

    await this.deactivateIntegrationUseCase.execute(tenant.schemaName, id);

    return { success: true, message: 'Integration deactivated' };
  }

  /**
   * Obtiene estadísticas de una integración
   *
   * GET /api/integrations/:id/stats
   */
  @Get(':id/stats')
  async getIntegrationStats(@Param('id') id: string) {
    const tenant = this.tenantContext.get();
    return this.getIntegrationStatsUseCase.execute(tenant.schemaName, id);
  }

  /**
   * Lista logs de sincronización
   *
   * GET /api/integrations/:id/logs?limit=10&offset=0
   */
  @Get(':id/logs')
  async getSyncLogs(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
  ) {
    const tenant = this.tenantContext.get();
    
    return this.getSyncLogsUseCase.execute(
      tenant.schemaName,
      id,
      parseInt(limit) || 10,
      parseInt(offset) || 0,
    );
  }

  /**
   * Lista items sincronizados
   *
   * GET /api/integrations/:id/items?limit=100&offset=0
   */
  @Get(':id/items')
  async getIntegrationItems(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Query('offset') offset: string,
  ) {
    const tenant = this.tenantContext.get();

    return this.getIntegrationItemsUseCase.execute(
      tenant.schemaName,
      id,
      parseInt(limit) || 100,
      parseInt(offset) || 0,
    );
  }
}
