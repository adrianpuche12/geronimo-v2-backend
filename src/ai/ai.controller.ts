import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { RAGService, RAGQueryResult, RAGHealthStatus } from "./rag/rag.service";
import { QueryDto, DirectQueryDto } from "./dto/query.dto";
import { IndexDocumentDto, ReindexDocumentDto } from "./dto/index-document.dto";

@ApiTags("AI")
@Controller("api/ai")
export class AIController {
  private readonly logger = new Logger(AIController.name);
  private readonly defaultTenantId = "tenant_default_001";
  private readonly defaultProjectId = "default";

  constructor(
    private readonly ragService: RAGService,
  ) {}

  @Post("query")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Realizar consulta RAG sobre documentos indexados" })
  @ApiResponse({ status: 200, description: "Respuesta generada exitosamente" })
  async query(@Body() dto: QueryDto): Promise<RAGQueryResult> {
    this.logger.log("Query received: " + dto.question.substring(0, 50) + "...");
    
    const result = await this.ragService.query(
      this.defaultTenantId,
      dto.question,
      {
        projectId: dto.projectId,
        mode: dto.mode as any,
        maxChunks: dto.maxChunks || 5,
        hybridSearch: true,
      }
    );

    return result;
  }

  @Post("query/direct")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Consulta directa al LLM sin contexto RAG" })
  @ApiResponse({ status: 200, description: "Respuesta del LLM" })
  async queryDirect(@Body() dto: DirectQueryDto): Promise<RAGQueryResult> {
    this.logger.log("Direct query: " + dto.question.substring(0, 50) + "...");
    
    const result = await this.ragService.queryDirect(
      dto.question,
      dto.mode as any
    );

    return result;
  }

  @Post("index")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Indexar un documento en ChromaDB" })
  @ApiResponse({ status: 201, description: "Documento indexado exitosamente" })
  async indexDocument(@Body() dto: IndexDocumentDto): Promise<{
    success: boolean;
    documentId: string;
    chunksCreated: number;
  }> {
    this.logger.log("Indexing document: " + dto.documentId);
    
    const projectId = dto.metadata?.projectId || this.defaultProjectId;
    const source = dto.metadata?.source || "unknown";
    
    const result = await this.ragService.indexDocument(
      this.defaultTenantId,
      projectId,
      dto.documentId,
      dto.content,
      source
    );

    return {
      success: result.errors.length === 0,
      documentId: result.documentId,
      chunksCreated: result.chunksCreated,
    };
  }

  @Post("reindex")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reindexar un documento existente" })
  @ApiResponse({ status: 200, description: "Documento reindexado" })
  async reindexDocument(@Body() dto: ReindexDocumentDto): Promise<{
    success: boolean;
    documentId: string;
    chunksCreated: number;
  }> {
    this.logger.log("Reindexing document: " + dto.documentId);
    
    const projectId = dto.metadata?.projectId as string || this.defaultProjectId;
    const source = dto.metadata?.source as string || "unknown";
    
    const result = await this.ragService.reindexDocument(
      this.defaultTenantId,
      projectId,
      dto.documentId,
      dto.content,
      source
    );

    return {
      success: result.errors.length === 0,
      documentId: result.documentId,
      chunksCreated: result.chunksCreated,
    };
  }

  @Delete("index/:projectId/:documentId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Eliminar documento del indice" })
  @ApiResponse({ status: 200, description: "Documento eliminado del indice" })
  async deleteDocument(
    @Param("projectId") projectId: string,
    @Param("documentId") documentId: string
  ): Promise<{
    success: boolean;
    documentId: string;
  }> {
    this.logger.log("Deleting document from index: " + documentId);
    
    const result = await this.ragService.deleteDocument(
      this.defaultTenantId,
      projectId,
      documentId
    );

    return {
      success: result.deleted,
      documentId,
    };
  }

  @Get("health")
  @ApiOperation({ summary: "Health check del sistema AI" })
  @ApiResponse({ status: 200, description: "Estado del sistema AI" })
  async healthCheck(): Promise<RAGHealthStatus> {
    return this.ragService.healthCheck();
  }

  @Get("stats")
  @ApiOperation({ summary: "Estadisticas del indice de documentos" })
  @ApiResponse({ status: 200, description: "Estadisticas del indice" })
  async getStats(): Promise<{
    totalDocuments: number;
    totalChunks: number;
  }> {
    const stats = await this.ragService.getStats(this.defaultTenantId);
    return {
      totalDocuments: stats.totalDocuments,
      totalChunks: stats.totalChunks,
    };
  }
}
