import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { SecretsDetectorService } from '../security/secrets-detector.service';

export interface SearchFilters {
  query: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  fileType?: string;
  isAdmin?: boolean;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private secretsDetectorService: SecretsDetectorService,
  ) {}

  async search(filters: SearchFilters) {
    const { query, projectId, dateFrom, dateTo, fileType, isAdmin = false } = filters;

    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.project', 'project');

    if (query && query.trim()) {
      const escapedQuery = query.replace(/[%_]/g, '$&');
      
      queryBuilder.andWhere(
        '(document.path ILIKE :startsWith OR document.path ILIKE :wordStart OR document.title ILIKE :startsWith OR document.title ILIKE :wordStart OR document.content ILIKE :wordStart)',
        { 
          startsWith: `${escapedQuery}%`,
          wordStart: `% ${escapedQuery}%`
        },
      );
    }

    if (projectId) {
      queryBuilder.andWhere('document.projectId = :projectId', { projectId });
    }

    if (dateFrom) {
      queryBuilder.andWhere('document.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      queryBuilder.andWhere('document.createdAt <= :dateTo', { dateTo });
    }

    if (fileType) {
      queryBuilder.andWhere('document.path ILIKE :fileType', {
        fileType: `%.${fileType}`,
      });
    }

    queryBuilder.limit(100);

    const results = await queryBuilder.getMany();

    const sortedResults = this.sortByRelevance(results, query);

    const highlightedResults = sortedResults.map((doc) => {
      let content = doc.content;

      // Censurar contenido si NO es admin y tiene secretos
      if (!isAdmin && doc.metadata?.hasSecrets && content) {
        content = this.secretsDetectorService.censorByConfidence(content, 'medium');
        console.log(`[SECURITY] Censored search result for document ${doc.path} (non-admin user)`);
      }

      let snippet = '';
      if (content && query && query.trim()) {
        const wordStartRegex = new RegExp(`\b${query}\w*`, 'i');
        const match = content.match(wordStartRegex);
        
        if (match && match.index !== undefined) {
          const index = match.index;
          const start = Math.max(0, index - 100);
          const end = Math.min(content.length, index + match[0].length + 100);
          snippet = content.substring(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < content.length) snippet = snippet + '...';
        } else {
          snippet = content.substring(0, 200) + '...';
        }
      }

      return {
        id: doc.id,
        path: doc.path,
        title: doc.title,
        projectId: doc.projectId,
        projectName: doc.project?.name,
        createdAt: doc.createdAt,
        snippet,
        matchType: this.getMatchType(doc, query),
        hasSecrets: doc.metadata?.hasSecrets || false,
      };
    });

    return {
      results: highlightedResults,
      total: highlightedResults.length,
      query: query || '',
      filters: {
        projectId,
        dateFrom,
        dateTo,
        fileType,
      },
    };
  }

  private sortByRelevance(docs: Document[], query: string): Document[] {
    if (!query) return docs;

    const lowerQuery = query.toLowerCase();

    return docs.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, lowerQuery);
      const scoreB = this.calculateRelevanceScore(b, lowerQuery);
      return scoreB - scoreA;
    });
  }

  private calculateRelevanceScore(doc: Document, lowerQuery: string): number {
    let score = 0;

    const pathLower = doc.path?.toLowerCase() || '';
    const titleLower = doc.title?.toLowerCase() || '';
    
    if (pathLower.startsWith(lowerQuery)) {
      score += 1000;
    }
    if (titleLower.startsWith(lowerQuery)) {
      score += 900;
    }

    const pathWords = pathLower.split(/[\s\/\-_\.]+/);
    const titleWords = titleLower.split(/[\s\/\-_\.]+/);
    
    if (pathWords.some(word => word.startsWith(lowerQuery))) {
      score += 500;
    }
    if (titleWords.some(word => word.startsWith(lowerQuery))) {
      score += 400;
    }

    if (doc.content) {
      const contentLower = doc.content.toLowerCase();
      const wordStartRegex = new RegExp(`\b${lowerQuery}\w*`, 'i');
      if (wordStartRegex.test(contentLower)) {
        score += 200;
      }
    }

    if (pathLower === lowerQuery || titleLower === lowerQuery) {
      score += 2000;
    }

    return score;
  }

  private getMatchType(doc: Document, query: string): string {
    if (!query) return 'all';
    const lowerQuery = query.toLowerCase();
    const pathLower = doc.path?.toLowerCase() || '';
    const titleLower = doc.title?.toLowerCase() || '';
    
    if (pathLower.startsWith(lowerQuery) || pathLower.split(/[\s\/\-_\.]+/).some(w => w.startsWith(lowerQuery))) {
      return 'path';
    }
    if (titleLower.startsWith(lowerQuery) || titleLower.split(/[\s\/\-_\.]+/).some(w => w.startsWith(lowerQuery))) {
      return 'title';
    }
    if (doc.content) {
      const wordStartRegex = new RegExp(`\b${lowerQuery}\w*`, 'i');
      if (wordStartRegex.test(doc.content)) {
        return 'content';
      }
    }
    return 'none';
  }
}
