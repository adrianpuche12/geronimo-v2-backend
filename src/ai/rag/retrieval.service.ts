import { Injectable, Logger } from '@nestjs/common';
import { ChromaDBService } from '../vectorstore/chromadb.service';

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    documentId: string;
    projectId: string;
    tenantId: string;
    source: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
    tokenCount: number;
  };
}

export interface RetrievalOptions {
  topK?: number;
  minScore?: number;
  projectId?: string;
  includeKeywords?: boolean;
}

export interface RetrievalResult {
  chunks: SearchResult[];
  query: string;
  totalFound: number;
  searchTime: number;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(private readonly chromaDBService: ChromaDBService) {}

  async retrieve(
    tenantId: string,
    query: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const topK = options?.topK || 5;
    const minScore = options?.minScore || 0.3;

    try {
      this.logger.log(`Retrieving chunks for query: "${query.substring(0, 50)}..."`);

      const searchResults = await this.chromaDBService.searchByText(
        tenantId,
        query,
        {
          nResults: topK * 2,
          projectId: options?.projectId,
        }
      );

      const chunks: SearchResult[] = searchResults
        .filter(result => result.score >= minScore)
        .slice(0, topK)
        .map(result => ({
          id: result.id,
          content: result.content,
          score: result.score,
          metadata: {
            documentId: result.metadata?.documentId || '',
            projectId: result.metadata?.projectId || '',
            tenantId: result.metadata?.tenantId || tenantId,
            source: result.metadata?.source || '',
            chunkIndex: result.metadata?.chunkIndex || 0,
            startChar: result.metadata?.startChar || 0,
            endChar: result.metadata?.endChar || 0,
            tokenCount: result.metadata?.tokenCount || 0,
          },
        }));

      const searchTime = Date.now() - startTime;
      this.logger.log(`Retrieved ${chunks.length} chunks in ${searchTime}ms`);

      return { chunks, query, totalFound: chunks.length, searchTime };
    } catch (error) {
      this.logger.error(`Retrieval failed: ${error}`);
      return { chunks: [], query, totalFound: 0, searchTime: Date.now() - startTime };
    }
  }

  async hybridSearch(
    tenantId: string,
    query: string,
    options?: RetrievalOptions
  ): Promise<RetrievalResult> {
    const startTime = Date.now();

    const semanticResult = await this.retrieve(tenantId, query, {
      ...options,
      topK: (options?.topK || 5) * 2,
    });

    const keywords = this.extractKeywords(query);
    const rerankedChunks = this.rerankByKeywords(semanticResult.chunks, keywords);
    const topK = options?.topK || 5;
    const finalChunks = rerankedChunks.slice(0, topK);
    const searchTime = Date.now() - startTime;

    this.logger.log(`Hybrid search completed: ${finalChunks.length} chunks in ${searchTime}ms`);

    return { chunks: finalChunks, query, totalFound: finalChunks.length, searchTime };
  }

  extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
      'we', 'they', 'what', 'which', 'who', 'whom',
      'como', 'que', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del',
      'en', 'con', 'por', 'para', 'es', 'son', 'fue', 'ser', 'estar',
    ]);

    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)];
  }

  rerankByKeywords(chunks: SearchResult[], keywords: string[]): SearchResult[] {
    if (keywords.length === 0) return chunks;

    return chunks
      .map(chunk => {
        const contentLower = chunk.content.toLowerCase();
        let keywordBoost = 0;

        for (const keyword of keywords) {
          if (contentLower.includes(keyword)) {
            keywordBoost += 0.1;
            const regex = new RegExp(`\b${keyword}\b`, 'gi');
            const matches = contentLower.match(regex);
            if (matches) keywordBoost += matches.length * 0.05;
          }
        }

        return { ...chunk, score: Math.min(chunk.score + keywordBoost, 1.0) };
      })
      .sort((a, b) => b.score - a.score);
  }
}
