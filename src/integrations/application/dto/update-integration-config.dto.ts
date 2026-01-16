import { IsObject, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO para actualizar configuración de integración
 *
 * PATCH /api/integrations/:id
 */
export class UpdateIntegrationConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
