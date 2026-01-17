import { IsString, IsOptional, IsObject } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class IndexDocumentDto {
  @ApiProperty({ description: "ID del documento a indexar" })
  @IsString()
  documentId: string;

  @ApiProperty({ description: "Contenido del documento" })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: "Metadata adicional del documento" })
  @IsOptional()
  @IsObject()
  metadata?: {
    source?: string;
    projectId?: string;
    title?: string;
    [key: string]: any;
  };
}

export class ReindexDocumentDto {
  @ApiProperty({ description: "ID del documento a reindexar" })
  @IsString()
  documentId: string;

  @ApiProperty({ description: "Nuevo contenido del documento" })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: "Metadata actualizada" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
