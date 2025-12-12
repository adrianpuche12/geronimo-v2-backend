import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { FilesystemService } from './filesystem.service';
import { SecretsDetectorService } from '../security/secrets-detector.service';
import { redisService } from '../storage/redis.service';

@Injectable()
export class DocsService {
  private readonly tenantId = 'default-001';

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private duplicateDetectionService: DuplicateDetectionService,
    private filesystemService: FilesystemService,
    private secretsDetectorService: SecretsDetectorService,
  ) {}

  async create(createDocDto: {
    projectId: string;
    path: string;
    title?: string;
    content?: string;
    metadata?: Record<string, any>;
    author?: string;
    skipDuplicateCheck?: boolean;
  }): Promise<Document> {
    // Verificar duplicados
    if (!createDocDto.skipDuplicateCheck && createDocDto.content) {
      const duplicateCheck = await this.duplicateDetectionService.checkDuplicate(
        createDocDto.projectId,
        createDocDto.path,
        createDocDto.content,
      );

      if (duplicateCheck.isDuplicate) {
        throw new ConflictException({
          message: duplicateCheck.message,
          duplicateType: duplicateCheck.duplicateType,
          existingDocument: {
            id: duplicateCheck.existingDocument?.id,
            path: duplicateCheck.existingDocument?.path,
            title: duplicateCheck.existingDocument?.title,
          },
        });
      }
    }

    const docData: any = { ...createDocDto };

    if (createDocDto.content) {
      // Detectar secretos
      const secretDetection = this.secretsDetectorService.detectSecrets(createDocDto.content);

      docData.metadata = {
        ...(createDocDto.metadata || {}),
        hasSecrets: secretDetection.hasSecrets,
        secretsCount: secretDetection.secrets.length,
        secretTypes: [...new Set(secretDetection.secrets.map(s => s.type))],
      };

      if (secretDetection.hasSecrets) {
        console.log(`[SECURITY] Document "${createDocDto.path}" contains ${secretDetection.secrets.length} secret(s)`);
      }

      // Guardar archivo (local o B2 según tamaño)
      try {
        const fileData = await this.filesystemService.saveFile(
          createDocDto.projectId,
          createDocDto.content,
          createDocDto.path
        );
        docData.filePath = fileData.filePath;
        docData.hash = fileData.hash;
        docData.fileSize = fileData.fileSize;
        docData.storageLocation = fileData.storageLocation;
        docData.mimeType = this.filesystemService.getMimeType(createDocDto.path);
        
        console.log(`[DocsService] File saved - Location: ${fileData.storageLocation}, Size: ${fileData.fileSize} bytes`);
      } catch (error) {
        console.error('[DocsService] Error saving to storage:', error);
        throw error;
      }
    }

    // Guardar en PostgreSQL
    const document = this.documentRepository.create(docData);
    const saved = await this.documentRepository.save(document);
    const finalDoc = Array.isArray(saved) ? saved[0] : saved;

    // Cachear en Redis
    await redisService.set(
      this.tenantId,
      `doc:${finalDoc.id}`,
      {
        id: finalDoc.id,
        projectId: finalDoc.projectId,
        path: finalDoc.path,
        title: finalDoc.title,
        filePath: finalDoc.filePath,
        hash: finalDoc.hash,
        fileSize: finalDoc.fileSize,
        storageLocation: finalDoc.storageLocation,
        createdAt: finalDoc.createdAt
      },
      3600 // TTL 1 hora
    );

    console.log(`[DocsService] Document created - ID: ${finalDoc.id}, PostgreSQL + Redis cached`);
    return finalDoc;
  }

  async findAll(): Promise<Document[]> {
    return this.documentRepository.find({
      relations: ['project'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Document> {
    // Intentar obtener de Redis primero
    const cached = await redisService.get(this.tenantId, `doc:${id}`);
    if (cached) {
      console.log(`[DocsService] Document ${id} retrieved from Redis cache`);
      // Si está en cache pero necesitamos el contenido, lo obtenemos de DB
      const fullDoc = await this.documentRepository.findOne({
        where: { id },
        relations: ['project'],
      });
      if (fullDoc) return fullDoc;
    }

    // Si no está en cache, obtener de PostgreSQL
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: ['project'],
    });
    
    if (!document) {
      throw new NotFoundException(`Document with id ${id} not found`);
    }

    // Cachear para próxima vez
    await redisService.set(
      this.tenantId,
      `doc:${id}`,
      {
        id: document.id,
        projectId: document.projectId,
        path: document.path,
        title: document.title,
        filePath: document.filePath,
        hash: document.hash,
        fileSize: document.fileSize,
        storageLocation: document.storageLocation,
        createdAt: document.createdAt
      },
      3600
    );

    return document;
  }

  async findByProject(projectId: string): Promise<Document[]> {
    return this.documentRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);
    
    // Eliminar archivo físico
    if (document.filePath) {
      await this.filesystemService.deleteFile(document.filePath);
    }
    
    // Eliminar de PostgreSQL
    await this.documentRepository.delete(id);
    
    // Eliminar de Redis
    await redisService.del(this.tenantId, `doc:${id}`);
    
    console.log(`[DocsService] Document ${id} deleted from all layers`);
  }

  async sync(projectId: string, documents: Array<{ path: string; content: string; title?: string }>) {
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      total: documents.length,
      duplicates: [] as Array<{ path: string; reason: string }>,
    };

    for (const doc of documents) {
      try {
        const existing = await this.documentRepository.findOne({
          where: { projectId, path: doc.path },
        });

        if (existing) {
          // Actualizar documento existente
          await this.documentRepository.update(existing.id, {
            content: doc.content,
            title: doc.title || existing.title,
          });
          results.updated++;
        } else {
          // Crear nuevo documento
          await this.create({
            projectId,
            path: doc.path,
            content: doc.content,
            title: doc.title,
            skipDuplicateCheck: true, // Skip para sync masivo
          });
          results.created++;
        }
      } catch (error) {
        console.error(`Error syncing document ${doc.path}:`, error);
        results.skipped++;
      }
    }

    return results;
  }
}
