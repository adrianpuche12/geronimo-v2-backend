import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum ResponseMode {
  DETAILED = "detailed",
  CONCISE = "concise",
  TECHNICAL = "technical",
}

export class QueryDto {
  @ApiProperty({ description: "La pregunta a realizar sobre los documentos" })
  @IsString()
  question: string;

  @ApiPropertyOptional({ description: "ID del proyecto para filtrar documentos" })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: "Modo de respuesta", enum: ResponseMode })
  @IsOptional()
  @IsEnum(ResponseMode)
  mode?: ResponseMode;

  @ApiPropertyOptional({ description: "Numero maximo de chunks a usar como contexto", default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxChunks?: number;
}

export class DirectQueryDto {
  @ApiProperty({ description: "La pregunta directa al LLM (sin contexto RAG)" })
  @IsString()
  question: string;

  @ApiPropertyOptional({ description: "Modo de respuesta", enum: ResponseMode })
  @IsOptional()
  @IsEnum(ResponseMode)
  mode?: ResponseMode;
}
