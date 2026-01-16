import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { IntegrationProvider } from '../../../interfaces/integration-provider.interface';
import { SyncResult, SyncedItem } from '../../../interfaces/sync-result.interface';
import { OAuthService } from '../../services/oauth.service';
import * as crypto from 'crypto';

export interface DriveConfig {
  accessToken: string;
  refreshToken?: string;
  folders?: string[];  // Folder IDs a sincronizar (default: root)
  maxResults?: number;  // Max archivos por sync (default: 100)
}

@Injectable()
export class GoogleDriveProvider implements IntegrationProvider {
  private readonly logger = new Logger(GoogleDriveProvider.name);

  constructor(
    private configService: ConfigService,
    private oauthService: OAuthService,
  ) {}

  getProviderName(): string {
    return 'Google Drive';
  }

  async sync(config: DriveConfig): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      itemsFetched: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsFailed: 0,
      errors: [],
      items: [],
      metadata: { provider: 'drive' },
    };

    try {
      // Crear cliente OAuth2
      const oauth2Client = new google.auth.OAuth2(
        this.configService.get<string>('GOOGLE_CLIENT_ID'),
        this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      );

      oauth2Client.setCredentials({
        access_token: config.accessToken,
        refresh_token: config.refreshToken,
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Folders a sincronizar (default: root)
      const folders = config.folders || ['root'];
      const maxResults = config.maxResults || 100;

      this.logger.log(`Syncing ${folders.length} folders, max ${maxResults} files`);

      for (const folderId of folders) {
        try {
          const files = await this.listFilesInFolder(drive, folderId, maxResults);

          for (const file of files) {
            try {
              const item = await this.processFile(drive, file);
              if (item) result.items.push(item);
            } catch (error) {
              result.errors.push(`Error processing file ${file.id}: ${error.message}`);
              result.itemsFailed++;
            }
          }
        } catch (error) {
          result.errors.push(`Error syncing folder ${folderId}: ${error.message}`);
        }
      }

      result.itemsFetched = result.items.length;
      this.logger.log(`✅ Drive sync completed: ${result.itemsFetched} files`);

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      this.logger.error(`❌ Drive sync failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Lista archivos en una carpeta
   */
  private async listFilesInFolder(
    drive: drive_v3.Drive,
    folderId: string,
    maxResults: number,
  ): Promise<drive_v3.Schema$File[]> {
    const files: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)',
        pageSize: Math.min(maxResults - files.length, 1000),
        pageToken,
      });

      files.push(...(response.data.files || []));
      pageToken = response.data.nextPageToken;

      if (files.length >= maxResults) break;
    } while (pageToken);

    return files;
  }

  /**
   * Procesa un archivo individual
   */
  private async processFile(
    drive: drive_v3.Drive,
    file: drive_v3.Schema$File,
  ): Promise<SyncedItem | null> {
    const mimeType = file.mimeType || '';

    // Determinar si es Google Doc nativo
    const isGoogleDoc = mimeType.startsWith('application/vnd.google-apps.');

    let content: string;
    let contentHash: string;

    if (isGoogleDoc) {
      // Exportar a texto/markdown
      content = await this.exportGoogleDoc(drive, file);
      contentHash = crypto.createHash('sha256').update(content).digest('hex');
    } else {
      // Archivo normal - solo guardar metadata, content puede ir a B2
      const size = parseInt(file.size || '0');

      if (size > 1048576) {  // >1MB
        // TODO: Descargar y subir a B2
        content = `[File stored in B2: ${file.name}]`;
        contentHash = file.id;  // Usar ID como hash
      } else {
        // Descargar contenido
        const { data } = await drive.files.get(
          { fileId: file.id, alt: 'media' },
          { responseType: 'text' },
        );

        content = typeof data === 'string' ? data : JSON.stringify(data);
        contentHash = crypto.createHash('sha256').update(content).digest('hex');
      }
    }

    return {
      externalId: file.id,
      itemType: isGoogleDoc ? 'document' : 'file',
      title: file.name || 'Untitled',
      description: `Google Drive file: ${file.name}`,
      url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      content,
      contentHash,
      metadata: {
        fileId: file.id,
        mimeType,
        size: parseInt(file.size || '0'),
        modifiedTime: file.modifiedTime,
        isGoogleDoc,
      },
      externalCreatedAt: new Date(),
      externalUpdatedAt: new Date(file.modifiedTime || Date.now()),
    };
  }

  /**
   * Exporta Google Doc a texto
   */
  private async exportGoogleDoc(
    drive: drive_v3.Drive,
    file: drive_v3.Schema$File,
  ): Promise<string> {
    const mimeType = file.mimeType;

    // Mapeo de formatos de exportación
    let exportMimeType: string;

    if (mimeType === 'application/vnd.google-apps.document') {
      // Google Docs → Plain text
      exportMimeType = 'text/plain';
    } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Google Sheets → CSV
      exportMimeType = 'text/csv';
    } else if (mimeType === 'application/vnd.google-apps.presentation') {
      // Google Slides → Plain text
      exportMimeType = 'text/plain';
    } else {
      throw new Error(`Unsupported Google Doc type: ${mimeType}`);
    }

    const { data } = await drive.files.export(
      { fileId: file.id, mimeType: exportMimeType },
      { responseType: 'text' },
    );

    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  async testConnection(config: DriveConfig): Promise<boolean> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        this.configService.get<string>('GOOGLE_CLIENT_ID'),
        this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      );

      oauth2Client.setCredentials({
        access_token: config.accessToken,
      });

      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      await drive.about.get({ fields: 'user' });

      return true;
    } catch {
      return false;
    }
  }

  validateConfig(config: any): boolean {
    return config && typeof config.accessToken === 'string';
  }
}
