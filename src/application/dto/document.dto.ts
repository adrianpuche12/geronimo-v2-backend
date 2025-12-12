import { IsString, IsOptional, MaxLength, MinLength, IsBoolean } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  projectId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  path: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  skipDuplicateCheck?: boolean;
}
