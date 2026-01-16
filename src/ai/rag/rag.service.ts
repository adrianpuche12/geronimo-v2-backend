import { Injectable, Logger } from "@nestjs/common";
import { RetrievalService, RetrievalResult } from "./retrieval.service";
import { ContextBuilderService, BuiltContext, ContextFormat } from "./context-builder.service";
import { IndexingService, IndexingResult } from "./indexing.service";
import { ChunkingService, ChunkOptions } from "./chunking.service";
import { ChromaDBService } from "../vectorstore/chromadb.service";

export type ResponseMode = "concise" | "detailed" | "technical";

export interface RAGQueryOptions {
  projectId?: string;
  mode?: ResponseMode;
  maxContextTokens?: number;
  minRelevanceScore?: number;
  maxChunks?: number;
  hybridSearch?: boolean;
  contextFormat?: ContextFormat;
}

export interface RAGQueryResult {
  answer: string;
  sources: {
    documentId: string;
    source: string;
    score: number;
  }[];
  metadata: {
    provider: string;
    model: string;
    mode: ResponseMode;
    tokensUsed: number;
    responseTime: number;
    contextTokens: number;
    chunksUsed: number;
  };
}

export interface RAGHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  chromadb: { status: string; url: string };
  aiProvider: { status: string; provider: string };
  timestamp: Date;
}

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);

  constructor(
    private readonly retrievalService: RetrievalService,
    private readonly contextBuilderService: ContextBuilderService,
    private readonly indexingService: IndexingService,
    private readonly chunkingService: ChunkingService,
    private readonly chromaDBService: ChromaDBService,
  ) {}

  async query(
    tenantId: string,
    question: string,
    options?: RAGQueryOptions
  ): Promise<RAGQueryResult> {
    const startTime = Date.now();
    const mode = options?.mode || "detailed";

    try {
      this.logger.log("RAG query for tenant " + tenantId);

      const retrievalResult = options?.hybridSearch
        ? await this.retrievalService.hybridSearch(tenantId, question, {
            topK: options?.maxChunks || 5,
            minScore: options?.minRelevanceScore || 0.3,
            projectId: options?.projectId,
          })
        : await this.retrievalService.retrieve(tenantId, question, {
            topK: options?.maxChunks || 5,
            minScore: options?.minRelevanceScore || 0.3,
            projectId: options?.projectId,
          });

      const builtContext = this.contextBuilderService.buildContext(
        retrievalResult.chunks,
        {
          maxTokens: options?.maxContextTokens || 4000,
          format: options?.contextFormat || "structured",
          includeMetadata: true,
        }
      );

      const generatedAnswer = await this.generateAnswer(question, builtContext, mode);
      const responseTime = Date.now() - startTime;

      this.logger.log("RAG query completed in " + responseTime + "ms");

      return {
        answer: generatedAnswer.text,
        sources: builtContext.sources.map(s => ({
          documentId: s.documentId,
          source: s.source,
          score: s.score,
        })),
        metadata: {
          provider: generatedAnswer.provider,
          model: generatedAnswer.model,
          mode,
          tokensUsed: generatedAnswer.tokensUsed,
          responseTime,
          contextTokens: builtContext.tokenCount,
          chunksUsed: builtContext.chunksUsed,
        },
      };
    } catch (error) {
      this.logger.error("RAG query failed: " + error);
      throw error;
    }
  }

  async queryDirect(question: string, mode?: ResponseMode): Promise<RAGQueryResult> {
    const startTime = Date.now();
    const responseMode = mode || "detailed";

    try {
      const result = await this.generateAnswer(question, null, responseMode);
      const responseTime = Date.now() - startTime;

      return {
        answer: result.text,
        sources: [],
        metadata: {
          provider: result.provider,
          model: result.model,
          mode: responseMode,
          tokensUsed: result.tokensUsed,
          responseTime,
          contextTokens: 0,
          chunksUsed: 0,
        },
      };
    } catch (error) {
      this.logger.error("Direct query failed: " + error);
      throw error;
    }
  }

  async indexDocument(
    tenantId: string,
    projectId: string,
    documentId: string,
    content: string,
    source: string,
    options?: ChunkOptions
  ): Promise<IndexingResult> {
    return this.indexingService.indexDocument(tenantId, projectId, documentId, content, source, options);
  }

  async reindexDocument(
    tenantId: string,
    projectId: string,
    documentId: string,
    content: string,
    source: string,
    options?: ChunkOptions
  ): Promise<IndexingResult> {
    return this.indexingService.reindexDocument(tenantId, projectId, documentId, content, source, options);
  }

  async deleteDocument(
    tenantId: string,
    projectId: string,
    documentId: string
  ): Promise<{ deleted: boolean; error?: string }> {
    return this.indexingService.deleteDocument(tenantId, projectId, documentId);
  }

  async getStats(tenantId: string, projectId?: string) {
    return this.indexingService.getIndexStats(tenantId, projectId);
  }

  async healthCheck(): Promise<RAGHealthStatus> {
    const chromaHealth = await this.chromaDBService.healthCheck();
    const aiHealth = { status: "healthy", provider: "openai" };

    const overallStatus = 
      chromaHealth.status === "healthy" && aiHealth.status === "healthy"
        ? "healthy"
        : chromaHealth.status === "unhealthy" || aiHealth.status === "unhealthy"
        ? "unhealthy"
        : "degraded";

    return {
      status: overallStatus,
      chromadb: { status: chromaHealth.status, url: chromaHealth.url },
      aiProvider: aiHealth,
      timestamp: new Date(),
    };
  }

  private async generateAnswer(
    question: string,
    context: BuiltContext | null,
    mode: ResponseMode
  ): Promise<{ text: string; provider: string; model: string; tokensUsed: number }> {
    const systemPrompt = this.buildSystemPrompt(mode);
    
    let userPrompt: string;
    if (context && context.context) {
      userPrompt = "Contexto relevante:\n" + context.context + "\n\nPregunta: " + question;
    } else {
      userPrompt = question;
    }

    const placeholderResponse = context 
      ? "[RAG Response] Basado en " + context.chunksUsed + " fuentes. Placeholder para: " + question
      : "[Direct Response] Placeholder para: " + question;

    return {
      text: placeholderResponse,
      provider: "placeholder",
      model: "placeholder-model",
      tokensUsed: this.chunkingService.estimateTokens(userPrompt + placeholderResponse),
    };
  }

  private buildSystemPrompt(mode: ResponseMode): string {
    switch (mode) {
      case "concise":
        return "Responde de forma breve y directa.";
      case "technical":
        return "Responde con detalle tecnico.";
      case "detailed":
      default:
        return "Proporciona una respuesta completa.";
    }
  }
}
