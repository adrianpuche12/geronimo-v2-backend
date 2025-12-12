import { Injectable, ConflictException } from '@nestjs/common';
import { DocumentRepository } from '../../domain/repositories/document.repository';
import { CreateDocumentDto } from '../dto/document.dto';
import * as crypto from 'crypto';

@Injectable()
export class CreateDocumentUseCase {
  constructor(private documentRepository: DocumentRepository) {}

  async execute(dto: CreateDocumentDto & { file?: Express.Multer.File }) {
    console.log('[CreateDocumentUseCase] Executing with:', {
      projectId: dto.projectId,
      path: dto.path,
      hasFile: !!dto.file,
      fileSize: dto.file?.size,
      hasContent: !!dto.content,
    });

    // Si viene un archivo, calcular hash del buffer
    let hash: string | undefined;
    let fileBuffer: Buffer | undefined;
    
    if (dto.file) {
      fileBuffer = dto.file.buffer;
      hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // Check for file hash duplicates
      if (!dto.skipDuplicateCheck) {
        const existing = await this.documentRepository.findByHash(dto.projectId, hash);
        
        if (existing) {
          throw new ConflictException({
            message: 'Duplicate file detected',
            duplicateType: 'file_hash',
            existingDocument: {
              id: existing.id,
              path: existing.path,
              title: existing.title,
            },
          });
        }
      }
    } else if (dto.content) {
      // Si no viene archivo pero viene content, calcular hash del content
      hash = crypto.createHash('sha256').update(dto.content).digest('hex');
      
      if (!dto.skipDuplicateCheck) {
        const existing = await this.documentRepository.findByHash(dto.projectId, hash);
        
        if (existing) {
          throw new ConflictException({
            message: 'Duplicate document detected',
            duplicateType: 'content_hash',
            existingDocument: {
              id: existing.id,
              path: existing.path,
              title: existing.title,
            },
          });
        }
      }
    }

    // Create document
    return await this.documentRepository.create({
      project_id: dto.projectId,
      path: dto.path,
      title: dto.title,
      content: dto.content,
      hash: hash,
      file_size: dto.file?.size,
      mime_type: dto.file?.mimetype,
      file_buffer: fileBuffer,
    });
  }
}
