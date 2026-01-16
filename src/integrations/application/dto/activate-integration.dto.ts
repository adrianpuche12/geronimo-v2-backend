import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

/**
 * DTO para activar una integración
 *
 * POST /api/integrations/activate
 */
export class ActivateIntegrationDto {
  @IsString()
  @IsNotEmpty()
  integrationId: string;  // 'int-001', 'int-004', 'int-020'

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;  // Configuración específica
}

/**
 * Ejemplos de metadata:
 *
 * GitHub (int-001):
 * {
 *   repos: ['facebook/react', 'microsoft/vscode']
 * }
 *
 * Gmail (int-004):
 * {
 *   labels: ['INBOX', 'IMPORTANT'],
 *   maxResults: 100
 * }
 *
 * Drive (int-020):
 * {
 *   folders: ['1ABC...', '2DEF...'],  // Folder IDs
 *   maxResults: 100
 * }
 */
