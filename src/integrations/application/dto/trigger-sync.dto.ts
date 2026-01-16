import { IsUUID, IsNotEmpty } from 'class-validator';

/**
 * DTO para trigger manual de sync
 *
 * POST /api/integrations/:id/sync
 */
export class TriggerSyncDto {
  @IsUUID()
  @IsNotEmpty()
  integrationId: string;
}
