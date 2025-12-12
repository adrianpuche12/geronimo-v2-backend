import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { b2StorageService } from '../storage/b2.service';
import { redisService } from '../storage/redis.service';

@Injectable()
export class FilesystemService {
  private readonly storageBasePath = '/opt/geronimo-v2/storage/uploads';
  private readonly tenantId = 'default-001'; // Por ahora usamos tenant por defecto

  async saveFile(projectId: string, content: string, filename: string): Promise<{
    filePath: string;
    hash: string;
    fileSize: number;
    storageLocation: string;
  }> {
    const hash = this.calculateHash(content);
    const fileSize = Buffer.byteLength(content, 'utf-8');
    
    // Decidir dónde guardar según el tamaño
    const useB2 = b2StorageService.shouldUseB2(fileSize);
    
    let filePath: string;
    let storageLocation: string;

    if (useB2) {
      // Guardar en Backblaze B2
      const key = b2StorageService.generateKey(projectId, filename);
      filePath = await b2StorageService.saveFile(this.tenantId, key, Buffer.from(content, 'utf-8'));
      storageLocation = 'b2';
      console.log(`[FilesystemService] File saved to B2: ${filePath} (${fileSize} bytes)`);
    } else {
      // Guardar en filesystem local
      const projectDir = path.join(this.storageBasePath, projectId);
      await fs.mkdir(projectDir, { recursive: true });
      
      const ext = path.extname(filename) || '.txt';
      filePath = path.join(projectDir, `${hash}${ext}`);
      
      await fs.writeFile(filePath, content, 'utf-8');
      storageLocation = 'local';
      console.log(`[FilesystemService] File saved locally: ${filePath} (${fileSize} bytes)`);
    }

    // Cachear metadata en Redis
    await redisService.set(
      this.tenantId,
      `file:${hash}`,
      {
        filePath,
        hash,
        fileSize,
        storageLocation,
        projectId,
        filename,
        savedAt: new Date().toISOString()
      },
      3600 // TTL 1 hora
    );

    return {
      filePath,
      hash,
      fileSize,
      storageLocation
    };
  }

  async readFile(filePath: string): Promise<string> {
    // Si es una ruta de B2, leer desde B2
    if (filePath.startsWith('b2://')) {
      const buffer = await b2StorageService.getFile(this.tenantId, filePath);
      return buffer.toString('utf-8');
    }
    
    // Si es local, leer desde filesystem
    return fs.readFile(filePath, 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      if (filePath.startsWith('b2://')) {
        // Eliminar de B2
        const key = filePath.substring(5); // Remover 'b2://'
        await b2StorageService.deleteFile(this.tenantId, key);
      } else {
        // Eliminar de filesystem local
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.html': 'text/html',
      '.css': 'text/css'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
