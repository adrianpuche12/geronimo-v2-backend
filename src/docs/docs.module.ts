import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { Document } from '../entities/document.entity';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { SearchService } from './search.service';
import { FilesystemService } from './filesystem.service';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    SecurityModule,
  ],
  controllers: [DocsController],
  providers: [DocsService, DuplicateDetectionService, SearchService, FilesystemService],
  exports: [DocsService],
})
export class DocsModule {}
