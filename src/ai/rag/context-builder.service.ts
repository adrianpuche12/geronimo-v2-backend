import { Injectable, Logger } from '@nestjs/common';
import { SearchResult } from './retrieval.service';
import { ChunkingService } from './chunking.service';

export type ContextFormat = 'plain' | 'markdown' | 'structured';

export interface ContextOptions {
  maxTokens?: number;
  format?: ContextFormat;
  includeMetadata?: boolean;
  separator?: string;
}

export interface SourceReference {
  documentId: string;
  source: string;
  chunkIndex: number;
  score: number;
}

export interface BuiltContext {
  context: string;
  sources: SourceReference[];
  tokenCount: number;
  truncated: boolean;
  chunksUsed: number;
}

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);

  constructor(private readonly chunkingService: ChunkingService) {}

  buildContext(chunks: SearchResult[], options?: ContextOptions): BuiltContext {
    const maxTokens = options?.maxTokens || 4000;
    const format = options?.format || 'structured';
    const includeMetadata = options?.includeMetadata ?? true;

    const sources: SourceReference[] = [];
    const formattedChunks: string[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const chunk of chunks) {
      const formattedChunk = this.formatChunk(chunk, format, includeMetadata);
      const chunkTokens = this.chunkingService.estimateTokens(formattedChunk);

      if (totalTokens + chunkTokens > maxTokens) {
        const remainingTokens = maxTokens - totalTokens;
        if (remainingTokens > 100) {
          const truncatedChunk = this.truncateToTokens(formattedChunk, remainingTokens);
          formattedChunks.push(truncatedChunk);
          totalTokens += this.chunkingService.estimateTokens(truncatedChunk);
        }
        truncated = true;
        break;
      }

      formattedChunks.push(formattedChunk);
      totalTokens += chunkTokens;

      sources.push({
        documentId: chunk.metadata.documentId,
        source: chunk.metadata.source,
        chunkIndex: chunk.metadata.chunkIndex,
        score: chunk.score,
      });
    }

    const separator = this.getSeparator(format);
    const context = formattedChunks.join(separator);

    this.logger.log(`Built context: ${sources.length} sources, ${totalTokens} tokens, truncated: ${truncated}`);

    return { context, sources, tokenCount: totalTokens, truncated, chunksUsed: formattedChunks.length };
  }

  mergeContexts(contexts: BuiltContext[], maxTokens?: number): BuiltContext {
    const limit = maxTokens || 4000;
    const allSources: SourceReference[] = [];
    const allChunks: string[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const ctx of contexts) {
      if (totalTokens + ctx.tokenCount <= limit) {
        allChunks.push(ctx.context);
        allSources.push(...ctx.sources);
        totalTokens += ctx.tokenCount;
      } else {
        truncated = true;
        const remainingTokens = limit - totalTokens;
        if (remainingTokens > 100) {
          const truncatedContext = this.truncateToTokens(ctx.context, remainingTokens);
          allChunks.push(truncatedContext);
          totalTokens += this.chunkingService.estimateTokens(truncatedContext);
        }
        break;
      }
    }

    return {
      context: allChunks.join('\n\n---\n\n'),
      sources: allSources,
      tokenCount: totalTokens,
      truncated: truncated || contexts.some(c => c.truncated),
      chunksUsed: allSources.length,
    };
  }

  private formatChunk(chunk: SearchResult, format: ContextFormat, includeMetadata: boolean): string {
    const score = Math.round(chunk.score * 100);
    const source = chunk.metadata.source || 'Unknown';

    switch (format) {
      case 'plain':
        return includeMetadata ? `[Source: ${source}]\n${chunk.content}` : chunk.content;

      case 'markdown':
        return includeMetadata
          ? `### Fuente: ${source}\n*Relevancia: ${score}%*\n\n${chunk.content}`
          : chunk.content;

      case 'structured':
      default:
        if (includeMetadata) {
          return [
            `[DOCUMENTO: ${source}]`,
            `[RELEVANCIA: ${score}%]`,
            `[CONTENIDO]`,
            chunk.content,
            `[/CONTENIDO]`,
          ].join('\n');
        }
        return chunk.content;
    }
  }

  private getSeparator(format: ContextFormat): string {
    switch (format) {
      case 'plain': return '\n\n';
      case 'markdown': return '\n\n---\n\n';
      case 'structured':
      default: return '\n\n';
    }
  }

  private truncateToTokens(content: string, maxTokens: number): string {
    const estimatedChars = maxTokens * 4;
    if (content.length <= estimatedChars) return content;

    const truncated = content.substring(0, estimatedChars);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > estimatedChars * 0.7) {
      return truncated.substring(0, lastSentence + 1) + '\n[...truncated]';
    }

    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > estimatedChars * 0.8) {
      return truncated.substring(0, lastSpace) + '...[truncated]';
    }

    return truncated + '...[truncated]';
  }
}
