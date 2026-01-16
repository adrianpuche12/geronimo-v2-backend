import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChromaClient, Collection } from 'chromadb';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    documentId: string;
    projectId: string;
    tenantId: string;
    source: string;
    chunkIndex?: number;
    [key: string]: any;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, any>;
}

export interface CollectionStats {
  name: string;
  count: number;
  tenant: string;
}

@Injectable()
export class ChromaDBService implements OnModuleInit {
  private readonly logger = new Logger(ChromaDBService.name);
  private client: ChromaClient;
  private readonly chromaUrl: string;
  private collections: Map<string, Collection> = new Map();

  constructor() {
    this.chromaUrl = process.env.CHROMADB_URL || 'http://localhost:8003';
  }

  async onModuleInit() {
    await this.connect();
  }

  async connect(): Promise<void> {
    try {
      this.client = new ChromaClient({
        path: this.chromaUrl,
      });
      const heartbeat = await this.client.heartbeat();
      this.logger.log('ChromaDB conectado: ' + this.chromaUrl);
    } catch (error) {
      this.logger.error('Error conectando a ChromaDB: ' + error.message);
      throw error;
    }
  }

  async getOrCreateCollection(tenantId: string, projectId?: string): Promise<Collection> {
    const collectionName = projectId
      ? 'tenant_' + tenantId + '_project_' + projectId
      : 'tenant_' + tenantId + '_vectors';

    if (this.collections.has(collectionName)) {
      return this.collections.get(collectionName)!;
    }

    try {
      const collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: {
          tenantId,
          projectId: projectId || 'default',
          createdAt: new Date().toISOString(),
        },
      });

      this.collections.set(collectionName, collection);
      this.logger.log('Coleccion obtenida/creada: ' + collectionName);
      return collection;
    } catch (error) {
      this.logger.error('Error obteniendo coleccion ' + collectionName + ': ' + error.message);
      throw error;
    }
  }

  async addDocuments(
    tenantId: string,
    documents: VectorDocument[],
    projectId?: string
  ): Promise<{ added: number; errors: string[] }> {
    const collection = await this.getOrCreateCollection(tenantId, projectId);
    const errors: string[] = [];
    let added = 0;

    try {
      const ids = documents.map((doc) => doc.id);
      const embeddings = documents.map((doc) => doc.embedding);
      const metadatas = documents.map((doc) => ({
        ...doc.metadata,
        content: doc.content.substring(0, 1000),
      }));
      const contents = documents.map((doc) => doc.content);

      await collection.add({
        ids,
        embeddings,
        metadatas,
        documents: contents,
      });

      added = documents.length;
      this.logger.log(added + ' documentos agregados a ' + collection.name);
    } catch (error) {
      errors.push(error.message);
      this.logger.error('Error agregando documentos: ' + error.message);
    }

    return { added, errors };
  }

  async search(
    tenantId: string,
    queryEmbedding: number[],
    options: {
      projectId?: string;
      limit?: number;
      minScore?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<SearchResult[]> {
    const { projectId, limit = 10, minScore = 0.5, filter } = options;
    const collection = await this.getOrCreateCollection(tenantId, projectId);

    try {
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: filter,
      });

      if (!results.ids || !results.ids[0]) {
        return [];
      }

      const searchResults: SearchResult[] = [];

      for (let i = 0; i < results.ids[0].length; i++) {
        const distance = results.distances?.[0]?.[i] ?? 0;
        const score = 1 - distance;

        if (score >= minScore) {
          searchResults.push({
            id: results.ids[0][i],
            content: results.documents?.[0]?.[i] || '',
            score,
            metadata: results.metadatas?.[0]?.[i] || {},
          });
        }
      }

      this.logger.debug('Busqueda retorno ' + searchResults.length + ' resultados');
      return searchResults;
    } catch (error) {
      this.logger.error('Error en busqueda: ' + error.message);
      throw error;
    }
  }

  async deleteDocuments(
    tenantId: string,
    documentIds: string[],
    projectId?: string
  ): Promise<{ deleted: number }> {
    const collection = await this.getOrCreateCollection(tenantId, projectId);

    try {
      await collection.delete({ ids: documentIds });
      this.logger.log(documentIds.length + ' documentos eliminados de ' + collection.name);
      return { deleted: documentIds.length };
    } catch (error) {
      this.logger.error('Error eliminando documentos: ' + error.message);
      throw error;
    }
  }

  async deleteByFilter(
    tenantId: string,
    filter: Record<string, any>,
    projectId?: string
  ): Promise<void> {
    const collection = await this.getOrCreateCollection(tenantId, projectId);

    try {
      await collection.delete({ where: filter });
      this.logger.log('Documentos eliminados con filtro en ' + collection.name);
    } catch (error) {
      this.logger.error('Error eliminando por filtro: ' + error.message);
      throw error;
    }
  }

  async getCollectionStats(tenantId: string, projectId?: string): Promise<CollectionStats> {
    const collection = await this.getOrCreateCollection(tenantId, projectId);

    try {
      const count = await collection.count();
      return { name: collection.name, count, tenant: tenantId };
    } catch (error) {
      this.logger.error('Error obteniendo stats: ' + error.message);
      throw error;
    }
  }

  async listCollections(): Promise<string[]> {
    try {
      const collections = await this.client.listCollections();
      return collections;
    } catch (error) {
      this.logger.error('Error listando colecciones: ' + error.message);
      throw error;
    }
  }

  async deleteCollection(tenantId: string, projectId?: string): Promise<void> {
    const collectionName = projectId
      ? 'tenant_' + tenantId + '_project_' + projectId
      : 'tenant_' + tenantId + '_vectors';

    try {
      await this.client.deleteCollection({ name: collectionName });
      this.collections.delete(collectionName);
      this.logger.log('Coleccion eliminada: ' + collectionName);
    } catch (error) {
      this.logger.error('Error eliminando coleccion: ' + error.message);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; url: string; heartbeat?: number }> {
    try {
      const heartbeat = await this.client.heartbeat();
      return { status: 'healthy', url: this.chromaUrl, heartbeat };
    } catch (error) {
      return { status: 'unhealthy', url: this.chromaUrl };
    }
  }

  async searchByText(
    tenantId: string,
    queryText: string,
    options: {
      projectId?: string;
      nResults?: number;
      minScore?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<SearchResult[]> {
    const { projectId, nResults = 10, minScore = 0.3, filter } = options;
    const collection = await this.getOrCreateCollection(tenantId, projectId);

    try {
      const results = await collection.query({
        queryTexts: [queryText],
        nResults,
        where: filter,
      });

      if (!results.ids || !results.ids[0]) {
        return [];
      }

      const searchResults: SearchResult[] = [];

      for (let i = 0; i < results.ids[0].length; i++) {
        const distance = results.distances?.[0]?.[i] ?? 1;
        const score = 1 - distance;

        if (score >= minScore) {
          searchResults.push({
            id: results.ids[0][i],
            content: results.documents?.[0]?.[i] || '',
            score,
            metadata: results.metadatas?.[0]?.[i] || {},
          });
        }
      }

      this.logger.debug('Busqueda por texto retorno ' + searchResults.length + ' resultados');
      return searchResults;
    } catch (error) {
      this.logger.error('Error en busqueda por texto: ' + error.message);
      throw error;
    }
  }
}
