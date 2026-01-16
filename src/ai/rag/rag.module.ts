import { Module } from '@nestjs/common';
import { ChunkingService } from './chunking.service';
import { IndexingService } from './indexing.service';
import { RetrievalService } from './retrieval.service';
import { ContextBuilderService } from './context-builder.service';
import { ChromaDBModule } from '../vectorstore/chromadb.module';

@Module({
  imports: [ChromaDBModule],
  providers: [
    ChunkingService,
    IndexingService,
    RetrievalService,
    ContextBuilderService,
  ],
  exports: [
    ChunkingService,
    IndexingService,
    RetrievalService,
    ContextBuilderService,
  ],
})
export class RagModule {}
