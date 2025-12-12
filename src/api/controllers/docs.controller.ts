import {
  Controller, Get, Post, Delete,
  Param, Body, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { CreateDocumentUseCase } from '../../application/use-cases/create-document.use-case';
import { CreateDocumentDto } from '../../application/dto/document.dto';
import { DocumentRepository } from '../../domain/repositories/document.repository';

@ApiTags('Documents')
@Controller('api/docs')
export class DocsController {
  constructor(
    private createDocumentUseCase: CreateDocumentUseCase,
    private documentRepository: DocumentRepository,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new document (supports file upload)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    console.log('[DocsController] POST /api/docs');
    console.log('[DocsController] DTO:', dto);
    console.log('[DocsController] File:', file ? { 
      originalname: file.originalname, 
      size: file.size, 
      mimetype: file.mimetype 
    } : 'No file');

    // Si viene un archivo, usarlo
    if (file) {
      const documentData = {
        projectId: dto.projectId,
        path: dto.path || `docs/${file.originalname}`,
        title: dto.title || file.originalname,
        content: dto.content,
        file: file, // Pasar el archivo al use case
      };
      
      return await this.createDocumentUseCase.execute(documentData);
    }

    // Si no viene archivo, crear documento solo con metadata
    return await this.createDocumentUseCase.execute(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  async getById(@Param('id') id: string) {
    const doc = await this.documentRepository.findByIdWithContent(id);
    if (!doc) {
      throw new Error('Document not found');
    }
    return doc;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete document' })
  async delete(@Param('id') id: string) {
    await this.documentRepository.delete(id);
  }
}
