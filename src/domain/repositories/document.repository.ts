import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../infrastructure/database/tenant-context';
import { databaseService } from '../../storage/database.service';
import { redisService } from '../../storage/redis.service';
import { b2StorageService } from '../../storage/b2.service';
import * as crypto from 'crypto';

export interface Document {
  id: string;
  project_id: string;
  path: string;
  title?: string;
  content?: string;
  hash?: string;
  file_size?: number;
  file_path?: string;
  storage_location?: string;
  mime_type?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class DocumentRepository {
  constructor(private tenantContext: TenantContext) {}

  async create(data: {
    project_id: string;
    path: string;
    title?: string;
    content?: string;
    hash?: string;
    file_size?: number;
    mime_type?: string;
    file_buffer?: Buffer;
  }): Promise<Document> {
    const tenantId = this.tenantContext.getTenantId();
    const userId = 'default-user'; // TODO: Get from auth context
    
    let file_path: string | null = null;
    let storage_location = 'local';

    // Si viene archivo y es > 1MB, subir a B2
    if (data.file_buffer && data.file_size && b2StorageService.shouldUseB2(data.file_size)) {
      console.log(`[DocumentRepository] Archivo > 1MB (${(data.file_size / 1024 / 1024).toFixed(2)}MB), subiendo a B2...`);
      
      const filename = data.title || data.path.split('/').pop() || 'document';
      const key = b2StorageService.generateKey(data.project_id, filename);
      
      file_path = await b2StorageService.saveFile(tenantId, key, data.file_buffer);
      storage_location = 'b2';
      
      console.log(`[DocumentRepository] Archivo guardado en B2: ${file_path}`);
    }

    const result = await databaseService.query(
      `INSERT INTO documents (
        project_id, path, title, content, file_path, hash, file_size, 
        storage_location, mime_type, metadata, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        data.project_id,
        data.path,
        data.title,
        data.content,
        file_path,
        data.hash,
        data.file_size || 0,
        storage_location,
        data.mime_type,
        JSON.stringify({}),
        userId,
      ]
    );

    const doc = result.rows[0];

    // Cachear en Redis
    await redisService.set(
      tenantId,
      `doc:${doc.id}`,
      {
        id: doc.id,
        project_id: doc.project_id,
        title: doc.title,
        path: doc.path,
        storage_location: doc.storage_location,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
      },
      3600
    );

    console.log(`[DocumentRepository] Documento creado y cacheado: ${doc.id} (storage: ${storage_location})`);
    
    return doc;
  }

  async findById(id: string): Promise<Document | null> {
    const tenantId = this.tenantContext.getTenantId();
    
    // Intentar obtener de cache
    const cached = await redisService.get(tenantId, `doc:${id}`);
    if (cached) {
      console.log(`[DocumentRepository] Documento obtenido de cache: ${id}`);
      return cached as Document;
    }

    // Si no está en cache, buscar en DB
    const result = await databaseService.query(
      'SELECT * FROM documents WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const doc = result.rows[0];

    // Cachear para futuras consultas
    await redisService.set(tenantId, `doc:${id}`, doc, 3600);

    return doc;
  }

  /**
   * Get document by ID with content (downloads from B2 if needed)
   */
  async findByIdWithContent(id: string): Promise<Document | null> {
    const doc = await this.findById(id);
    
    if (!doc) {
      return null;
    }

    // If file is in B2 and content is null, download it
    if (doc.storage_location === 'b2' && doc.file_path && !doc.content) {
      console.log(`[DocumentRepository] Descargando archivo desde B2: ${doc.file_path}`);
      
      const tenantId = this.tenantContext.getTenantId();
      const fileBuffer = await b2StorageService.getFile(tenantId, doc.file_path);
      
      // Convert buffer to string (assuming text file)
      doc.content = fileBuffer.toString('utf-8');
      
      console.log(`[DocumentRepository] Archivo descargado: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    }

    return doc;
  }

  async findByHash(projectId: string, hash: string): Promise<Document | null> {
    const result = await databaseService.query(
      'SELECT * FROM documents WHERE project_id = $1 AND hash = $2 LIMIT 1',
      [projectId, hash]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async delete(id: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    
    // Get document to check if needs B2 deletion
    const doc = await this.findById(id);
    
    if (doc?.storage_location === 'b2' && doc.file_path) {
      const key = doc.file_path.replace('b2://', '');
      await b2StorageService.deleteFile(tenantId, key);
    }

    await databaseService.query('DELETE FROM documents WHERE id = ', [id]);
    await redisService.delete(tenantId, `doc:${id}`);
  }

  calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
