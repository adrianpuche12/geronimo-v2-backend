import { Injectable, Logger } from "@nestjs/common";
import { ChunkingService, Chunk, ChunkOptions } from "./chunking.service";
import { ChromaDBService, VectorDocument } from "../vectorstore/chromadb.service";

export interface IndexingResult {
  documentId: string;
  projectId: string;
  tenantId: string;
  chunksCreated: number;
  vectorsStored: number;
  processingTime: number;
  errors: string[];
}

export interface IndexStats {
  totalDocuments: number;
  totalChunks: number;
  totalTokens: number;
  lastIndexedAt: Date | null;
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);
  private embeddingProvider: EmbeddingProvider | null = null;

  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly chromaDBService: ChromaDBService,
  ) {}

  /**
   * Set the embedding provider to use for generating embeddings
   */
  setEmbeddingProvider(provider: EmbeddingProvider): void {
    this.embeddingProvider = provider;
  }

  /**
   * Generate a simple placeholder embedding (for testing)
   * In production, this should use OpenAI or another embedding model
   */
  private async generatePlaceholderEmbedding(text: string): Promise<number[]> {
    // Generate a simple hash-based embedding for testing
    // This should be replaced with actual embedding generation
    const embedding = new Array(1536).fill(0);
    for (let i = 0; i < text.length && i < 1536; i++) {
      embedding[i % 1536] = (embedding[i % 1536] + text.charCodeAt(i)) / 1000;
    }
    return embedding;
  }

  /**
   * Generate embedding for text content
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    if (this.embeddingProvider) {
      return this.embeddingProvider.generateEmbedding(text);
    }
    // Use placeholder if no provider configured
    return this.generatePlaceholderEmbedding(text);
  }

  /**
   * Index a document - chunk it and store in ChromaDB
   */
  async indexDocument(
    tenantId: string,
    projectId: string,
    documentId: string,
    content: string,
    source: string,
    options?: ChunkOptions
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      this.logger.log("Indexing document " + documentId + " for tenant " + tenantId);

      // Chunk the document
      const chunkResult = this.chunkingService.chunkDocument(
        content,
        { documentId, projectId, tenantId, source },
        options
      );

      if (chunkResult.chunks.length === 0) {
        this.logger.warn("No chunks created for document " + documentId);
        return {
          documentId,
          projectId,
          tenantId,
          chunksCreated: 0,
          vectorsStored: 0,
          processingTime: Date.now() - startTime,
          errors: ["No chunks created - content may be too short"]
        };
      }

      // Prepare documents for ChromaDB with embeddings
      const documents: VectorDocument[] = [];
      for (const chunk of chunkResult.chunks) {
        const embedding = await this.generateEmbedding(chunk.content);
        documents.push({
          id: chunk.id,
          content: chunk.content,
          embedding,
          metadata: {
            documentId: chunk.metadata.documentId,
            projectId: chunk.metadata.projectId,
            tenantId: chunk.metadata.tenantId,
            source: chunk.metadata.source,
            chunkIndex: chunk.index,
            startChar: chunk.startChar,
            endChar: chunk.endChar,
            tokenCount: chunk.tokenCount
          }
        });
      }

      // Store in ChromaDB
      await this.chromaDBService.addDocuments(tenantId, documents, projectId);

      const processingTime = Date.now() - startTime;
      
      this.logger.log(
        "Indexed document " + documentId + ": " + chunkResult.chunks.length + " chunks stored in " + processingTime + "ms"
      );

      return {
        documentId,
        projectId,
        tenantId,
        chunksCreated: chunkResult.chunks.length,
        vectorsStored: chunkResult.chunks.length,
        processingTime,
        errors
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to index document " + documentId + ": " + errorMessage);
      errors.push(errorMessage);

      return {
        documentId,
        projectId,
        tenantId,
        chunksCreated: 0,
        vectorsStored: 0,
        processingTime: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Re-index a document - delete existing and create new
   */
  async reindexDocument(
    tenantId: string,
    projectId: string,
    documentId: string,
    content: string,
    source: string,
    options?: ChunkOptions
  ): Promise<IndexingResult> {
    this.logger.log("Re-indexing document " + documentId);

    // Delete existing chunks for this document
    await this.deleteDocument(tenantId, projectId, documentId);

    // Index fresh
    return this.indexDocument(tenantId, projectId, documentId, content, source, options);
  }

  /**
   * Delete a document from the index
   */
  async deleteDocument(
    tenantId: string,
    projectId: string,
    documentId: string
  ): Promise<{ deleted: boolean; error?: string }> {
    try {
      this.logger.log("Deleting document " + documentId + " from index");

      await this.chromaDBService.deleteByFilter(
        tenantId,
        { documentId },
        projectId
      );

      this.logger.log("Document " + documentId + " deleted from index");
      return { deleted: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to delete document " + documentId + ": " + errorMessage);
      return { deleted: false, error: errorMessage };
    }
  }

  /**
   * Delete all documents for a project
   */
  async deleteProject(
    tenantId: string,
    projectId: string
  ): Promise<{ deleted: boolean; error?: string }> {
    try {
      this.logger.log("Deleting project " + projectId + " from index");

      await this.chromaDBService.deleteCollection(tenantId, projectId);

      this.logger.log("Project " + projectId + " deleted from index");
      return { deleted: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error("Failed to delete project " + projectId + ": " + errorMessage);
      return { deleted: false, error: errorMessage };
    }
  }

  /**
   * Get indexing stats for a tenant/project
   */
  async getIndexStats(
    tenantId: string,
    projectId?: string
  ): Promise<IndexStats> {
    try {
      const stats = await this.chromaDBService.getCollectionStats(tenantId, projectId);

      return {
        totalDocuments: 0, // Would need to track this separately
        totalChunks: stats.count,
        totalTokens: 0, // Would need to aggregate from metadata
        lastIndexedAt: null
      };
    } catch (error) {
      this.logger.error("Failed to get index stats: " + error);
      return {
        totalDocuments: 0,
        totalChunks: 0,
        totalTokens: 0,
        lastIndexedAt: null
      };
    }
  }
}
