import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import * as crypto from 'crypto';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'exact' | 'path';
  existingDocument?: Document;
  message?: string;
}

@Injectable()
export class DuplicateDetectionService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
  ) {}

  /**
   * Calcula el hash SHA-256 del contenido
   */
  private calculateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Verifica si un documento es duplicado
   * Nivel 1: Verifica path exacto
   * Nivel 2: Verifica hash del contenido
   */
  async checkDuplicate(
    projectId: string,
    path: string,
    content: string,
  ): Promise<DuplicateCheckResult> {
    // Nivel 1: Verificar por path exacto
    const existingByPath = await this.documentRepository.findOne({
      where: { projectId, path },
    });

    if (existingByPath) {
      return {
        isDuplicate: true,
        duplicateType: 'path',
        existingDocument: existingByPath,
        message: `Ya existe un documento con el mismo path: ${path}`,
      };
    }

    // Nivel 2: Verificar por hash de contenido
    const contentHash = this.calculateHash(content);
    const allProjectDocs = await this.documentRepository.find({
      where: { projectId },
    });

    for (const doc of allProjectDocs) {
      if (doc.content) {
        const docHash = this.calculateHash(doc.content);
        if (docHash === contentHash) {
          return {
            isDuplicate: true,
            duplicateType: 'exact',
            existingDocument: doc,
            message: `Ya existe un documento con contenido idéntico: ${doc.path}`,
          };
        }
      }
    }

    return {
      isDuplicate: false,
      message: 'No se encontraron duplicados',
    };
  }

  /**
   * Verifica duplicados para múltiples documentos (sync)
   */
  async checkMultipleDuplicates(
    projectId: string,
    documents: Array<{ path: string; content: string }>,
  ): Promise<{
    duplicates: Array<{ path: string; reason: string; existingPath?: string }>;
    unique: Array<{ path: string; content: string }>;
  }> {
    const duplicates: Array<{ path: string; reason: string; existingPath?: string }> = [];
    const unique: Array<{ path: string; content: string }> = [];

    for (const doc of documents) {
      const result = await this.checkDuplicate(projectId, doc.path, doc.content);

      if (result.isDuplicate) {
        duplicates.push({
          path: doc.path,
          reason: result.message || 'Duplicado',
          existingPath: result.existingDocument?.path,
        });
      } else {
        unique.push(doc);
      }
    }

    return { duplicates, unique };
  }
}
